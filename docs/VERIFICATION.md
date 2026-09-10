# Reproducible verification

The release checks live in [verify.yml](../.github/workflows/verify.yml). Current issue dispositions are in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Clean setup

Use Node 24, npm, Rust with the `wasm32-unknown-unknown` target, and `wasm-pack` 0.15.0. The dependency lockfiles define JavaScript/Rust dependencies; do not update them during verification.

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-pack --version 0.15.0 --locked
npm run build
npm test
npm run test:tooling
npm run typecheck
npm run lint
npm run format:check
npx puppeteer browsers install chrome --install-deps
npm run test:browser
```

`build:wasm` accepts `WASM_BINDGEN_PATH` for an explicit executable; its version must match `dsp/Cargo.lock`. Otherwise it looks on PATH and in existing platform wasm-pack caches, then uses wasm-pack's normal installation behavior when no matching tool exists. Cache reuse uses [wasm-pack's no-install mode](https://wasm-bindgen.github.io/wasm-pack/book/commands/build.html). Build staging honors `TMPDIR`; failed compilation/packaging leaves the existing WASM package intact.

Set `PUPPETEER_EXECUTABLE_PATH` to use an existing Chrome installation, as supported by [Puppeteer configuration](https://pptr.dev/api/puppeteer.configuration). The local run used `/opt/google/chrome/chrome`. Environments that cannot launch Chrome's sandbox can explicitly set `BROWSER_NO_SANDBOX=1`; the default retains the sandbox. The test runner needs permission to launch subprocesses and listen on localhost. CI runs that opt-out only for its isolated test browser.

Generated WASM files are excluded from Prettier; regenerating them must not break the source format gate. Formatting changes in the M0 batch are mechanical source cleanup, distinct from the startup/build fixes.

## Browser audio scenarios and artifacts

`npm run test:browser` starts a local Vite server, runs the real worklet, builds a separate production harness under `artifacts/browser/site`, repeats the scenarios against that bundle, and closes browser/servers. It does not add test pages to the application release. Worker dependency bundling follows [Vite's worker asset support](https://vite.dev/guide/assets#importing-script-as-a-worker) with ES-module output.

Versioned parameters: [audio-fixtures.json](../tests/browser/audio-fixtures.json).

| Scenario                          | Input/reference                                                                                                                                                    | Acceptance                                                                                          | Interpretation                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Passive WDF parity, 44.1/48 kHz   | Deterministic 220 Hz, amplitude 0.2 sine; specified pickup R/L/C, volume/tone, bleed, cable, and input impedance. TS solver consumes the exact same float32 input. | Maximum sample error <= `1e-7`, finite and non-silent output.                                       | Tests browser integration/parity; the TS solver is not an independent physical reference.                       |
| Scheduled WASM pluck, 44.1/48 kHz | 220 Hz, velocity 0.7, articulated pluck at 0.1 s and full damp at 0.6 s, real guitar and tone-stack processors.                                                    | Before-pluck peak <= `1e-8`; attack RMS >= `1e-6`; late-tail/attack RMS <= 0.1; all samples finite. | Timing/release checks, not calibrated gain or tone claims. Ordinary worklet excitation retains its random seed. |
| Production bundle                 | Same cases after Vite production bundling.                                                                                                                         | Same checks, no page/resource failures.                                                             | Detects omitted worklet dependencies and scope-incompatible initialization.                                     |

The `1e-7` parity tolerance allows float32 rounding while catching meaningful divergence. The silence/attack limits detect early events and silent failures with a large separation. The tail ratio requires at least 20 dB RMS attenuation after damping. These are functional acceptance thresholds, not asserted pickup voltage calibrations. Existing `wasmProduction.test.ts` uses explicit seeds for reproducible physical-engine comparisons; ordinary live excitation is not changed to a fixed seed.

Outputs in `artifacts/browser/` include `report.json` (commit, dirty flag, browser, Node, WASM hash, sample rates, results/errors) and mono float32 `.f32` renders named by build mode and sample rate. CI uploads these plus Vitest JSON and toolchain versions even if a check fails. OfflineAudioContext renders cannot establish real-time CPU headroom; real-device deadline measurements remain M6.4.

## Preset references

[referenceScenarios.test.ts](../tests/presets/referenceScenarios.test.ts) specifies the authored neck-first selector truth tables independently of solver output:

| Preset                    | Selector positions                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard Tele / Les Paul  | Neck; neck + bridge parallel; bridge.                                                                                                                                                             |
| SSS / HSS Strat           | Neck; neck + middle; middle; middle + bridge; bridge.                                                                                                                                             |
| Indie Tele — M1 extension | Specify four-way selection together with phase and concentric blend state before adding acceptance assertions. A blended neck path may intentionally change the simple selector-only expectation. |

These references establish intended connectivity, not measured pickup response. Independently derived/circuit-simulator transfer curves, actual preset pickup locations, and complete stage-gain calibration remain open M1.1–M1.3 tasks. Supported automation in this batch is Chromium on Linux at 44.1/48 kHz; Firefox, Safari, touch devices, hardware MIDI, and real-time performance remain unverified targets.

## Local acceptance record

Date: 2026-09-09. Base commit: `15cd1e6` with the M0 working-tree changes. Node 26.7.0, npm 12.0.2, Rust 1.97.1, wasm-bindgen 0.2.126, Chrome 152.0.7977.64. Hosted CI uses Node 24; its first remote run remains to be observed.

| Check                       | Result                                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/parity suite           | **174 passed across 27 files**, including 16 preset selector scenarios and 12 UTF-8 decoder cases.                                          |
| Build-tool regressions      | **2 passed**: failure preserves the production package; incompatible explicit bindgen is rejected.                                          |
| Typecheck                   | Passed.                                                                                                                                     |
| Lint                        | Passed with eight existing Fast Refresh warnings.                                                                                           |
| Source/tooling format check | Passed. 43 existing source files were independently verified to contain only Prettier changes; startup and preset edits are separate.       |
| Production build            | Passed, including Rust compilation, WASM optimization/packaging, TypeScript, and Vite. Existing large-chunk/dynamic-import warnings remain. |
| Browser audio               | **8 scenarios passed**: two sample rates, two scenarios, development and production bundles.                                                |
| Browser sample parity       | Maximum absolute error **0** at both sample rates/build modes.                                                                              |
| Scheduled onset             | Pre-pluck peak **0** in every rendered case.                                                                                                |
| Scheduled release           | Maximum late-tail/attack RMS ratio **9.86e-10**, below the 0.1 acceptance limit.                                                            |
| Hosted CI                   | Workflow added; no remote run has been triggered in this session.                                                                           |

The rebuilt WASM hash was `ac1a8066e1a8ed6ab48359a2b0f2d95d62a8e9456d52ce6dd4e689ed0af943ec`. Rendered metrics and raw audio are in `artifacts/browser/`. Native subprocess/browser checks needed execution outside the local restricted sandbox; normal CI runners are expected to provide that capability.

No physical-gain calibration, complete amp/cab/limiter browser acceptance, real-time deadline benchmark, or user listening assessment is claimed by these results.
