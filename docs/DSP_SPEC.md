# Technical Specification: Cords Box Physical Modeling Synthesis Engine

_Tailored from a generic Digital Waveguide synthesis spec to describe what
actually exists in `Saccharin-e/cords-box` (`develop` branch) as of this
writing. Sections below follow the source document's shape; content is
rewritten against the real codebase, not aspirational. Where the source
document assumed tooling or architecture this repo doesn't have — a separate
C++/Python split, a MOTU/MAS/Digital Performer plugin target, an
"Antigravity IDE" with `GEMINI.md`/`AGENTS.md` agent-orchestration files,
`ag-*` CLI tooling, PCA/NLPCA excitation trained from recordings — that's
called out explicitly rather than carried over. None of that exists in this
repo and inventing it here would just be fiction._

---

## 1. Project Context & High-Level Directives

Cords Box is a browser-based guitar wiring simulator and tab player. Its
synthesis engine already **is** a physical-modeling engine, not sample
playback — the "Builder vs. Player" framing in the source document doesn't
map cleanly because there's no separate offline authoring tool: the
Rust/WASM engine _is_ the player, and its physical constants (string
material properties, WDF component values, tone-stack topologies) are
hand-derived from real-world electronics/physics values and tuned via
Vitest, not learned from a training pipeline. If an ML-driven "Builder"
(PCA over real pluck recordings, à la the source doc's `generator.py`) is
something you actually want, that's a genuinely new capability, not
something to describe as already present — see §4.

### 1.1 Core Purpose

Two coupled physical models drive the sound, both real-time in the browser:

1. A **digital waveguide string model** (Rust, compiled to WASM) — dual
   H/V polarization delay lines, a cascaded dispersion allpass filter
   derived from each string's actual diameter/tension (Fletcher
   inharmonicity, not a generic frequency-only heuristic), first-order
   Lagrange/Farrow fractional-delay interpolation, a loop filter
   with fundamental-gain compensation, per-string persistent excitation
   noise (not a fixed seed — each pluck is independently random), a
   `bend()`/glide path for pitch bends, and a `damp()` path for note-off/
   release. The six strings are rendered independently; a shared-bridge
   sympathetic-coupling path is not currently present.
2. A **Wave Digital Filter (WDF) passive circuit solver** (TypeScript,
   duplicated into the AudioWorklet since worklets can't import external
   modules) — a real adaptor-tree solution of the pickup R/L/C network,
   the volume/tone pot network, and a per-amp-model passive tone stack
   (Fender/Marshall/Mesa/Vox topologies), not an EQ approximation.

This is domain-appropriate: guitar is a single excitation-and-resonator
system, not the exciter/non-linear-resonator/feedback loop the source
document describes for winds. There's no separate "feedback loop
(non-linear for winds)" concept to port — drop it, it doesn't apply here.

### 1.2 Domain Architecture (actual signal chain)

```
[ EXCITATION ]        [ STRING RESONATOR ]         [ PICKUP / HARNESS ]         [ AMP / CAB ]
per-string PRNG   →   Digital Waveguide       →    WDF passive circuit    →    Tube waveshaper
noise burst,           (H/V planes, cascaded         solver (pickup R/L/C,       + per-model passive
pick position,         dispersion allpass,           volume/tone pots)           tone stack (WDF) +
bend()/damp() as       loop filter w/ gain                                       modal-resonance
external control        compensation)                                             cabinet IR
```

(`dsp/src/lib.rs` → `src/audio/processor.js` `WdfCircuit`/`WdfToneStack` →
`src/audio/pipeline.ts` tube/cabinet stages.)

### 1.3 Operational Goals (real constraints, not arbitrary numbers)

- **Real-time computation**: the actual budget is the AudioWorklet's
  render quantum — 128 samples, ≈2.7ms at 48kHz — not a generic "<1ms"
  figure. `DspEngine::process_chunk()` must stay well under that per call
  across however many strings are active plus the WDF/tone-stack solve.
- **Sample-accurate tuning**: `dsp/src/lib.rs` reads delay lines with a
  **first-order Lagrange/Farrow fractional-delay interpolator**. It is
  continuous across the circular-buffer boundary and avoids the pitch
  quantization of integer-delay reads. This is the implementation to preserve
  and test; it is not a Thiran allpass.
- **Energy conservation**: this one _does_ map directly and is already
  correctly implemented — the WDF adaptors in `wdfNodes.ts` /
  `processor.js` (`WdfSeriesAdaptor`, `WdfParallelAdaptor`) are
  reflection-free by construction when port resistances are correctly
  computed, which is the WDF equivalent of the source doc's
  `|Reflection| + |Transmission| ≤ 1` guard. Nothing to add here, just
  worth stating explicitly as a design invariant to preserve — don't let
  future circuit topology changes break port-resistance matching.

### 1.4 Actual repository layout

```
/cords-box
├── docs/                          # SRS.md, SDD.md, charter.md, Future Implementation Roadmap.md, DSP_SPEC.md
├── dsp/                           # Rust "Player" — the actual DWG engine
│   ├── Cargo.toml                 # wasm-bindgen, js-sys only — no Eigen/NumPy equivalent needed
│   └── src/lib.rs                 # GuitarString + DspEngine, ~824 lines
├── src/
│   ├── audio/
│   │   ├── processor.js           # AudioWorkletProcessor; inlines WdfCircuit/WdfToneStack
│   │   ├── pipeline.ts            # Main-thread orchestration, tube/cabinet stages
│   │   ├── karplusStrong.ts       # JS fallback string renderer (pre-worklet-ready path)
│   │   ├── wdf/                   # wdfNodes.ts, wdfCircuitSolver.ts, wdfToneStack.ts —
│   │   │                          #   canonical WDF source; processor.js keeps its own
│   │   │                          #   inlined copy since worklets can't import modules
│   │   ├── tab/                   # tabParser.ts, tabScheduler.ts, tabTypes.ts
│   │   └── midi/                  # midiParser.ts, midiExporter.ts, webMidiManager.ts
│   ├── ui/                        # React panels (toolbar, tab player, inspector, canvas)
│   └── store/                     # Zustand-style state (canvasStore, circuitStore, etc.)
├── tests/                         # Vitest — audio/, ui/, store/, graph/, presets/, lint/
└── package.json                   # vite, vitest, wasm-pack — see §2
```

No `GEMINI.md`, `AGENTS.md`, or agent-lock/task-registry files exist in
this repo, and there's no multi-agent orchestration layer configured. The
closest equivalent to the source doc's "high-level orchestration
directives" is `docs/charter.md` and `docs/Future Implementation
Roadmap.md`, which are plain project docs, not machine-read agent state.

---

## 2. Tech Stack, Tools & Build Commands

### 2.1 Runtimes & Frameworks (actual)

- **Rust (edition 2021)** — the DWG engine, compiled with `wasm-bindgen`
  to a `cdylib` WASM target. This is the source doc's "Player," but
  there's no separate "Builder" runtime — no Python, no offline ML
  pipeline exists in this repo today.
- **TypeScript / React 19** — UI, orchestration, and the canonical WDF
  circuit-solver source (`src/audio/wdf/`).
- **Vitest** — the test runner for everything, DSP included (there's no
  separate C++ test harness or `ag-verify`/`ag-bench` — Vitest specs under
  `tests/audio/` fill that role, e.g. `wdfResonance.test.ts`,
  `toneStackWdf.test.ts`, `tabParser.test.ts`, `midiParser.test.ts`).

### 2.2 Dependencies (actual, from `package.json` / `Cargo.toml`)

- Rust: `wasm-bindgen`, `js-sys` — no linear-algebra library is needed or
  present, since there's no PCA/NLPCA step. If a future ML-based
  excitation model is genuinely wanted, that would need to be scoped and
  added as new work, not assumed.
- JS/TS: `react`, `konva` (canvas rendering), `lucide-react` (icons),
  `jspdf` (export), `vite` + `vitest` (build/test).
- No `Eigen`, no `Accelerate`/`vDSP` — this is a browser target, not a
  native iPad/MAS plugin, so hardware-vector-library bindings don't apply.

### 2.3 Agent tooling configuration

The repository includes `.mcp.json`, `.cursor/mcp.json`, and
`.agents/mcp_config.json` for development tooling. These are separate from the
application runtime; they do not establish a persistent task-lock registry.
Git and the repository verification commands remain the implementation handoff.

### 2.4 Actual CLI commands

```bash
# Install deps
npm install

# Build the Rust/WASM engine into src/audio/wasm-pkg/
npm run build:wasm

# Dev server
npm run dev

# Full test suite (includes DSP correctness specs)
npm run test
npm run test:coverage

# Typecheck / lint / format
npm run typecheck
npm run lint
npm run format
```

There is no `ag-init-synth`, `ag-verify`, or `ag-bench` — those are the
source document's tooling for a different project. The equivalent
verification today is `npm run test` plus, for anything DSP-numeric,
writing a small offline probe script the way the earlier realism/gain
audits in this project did (measure RMS/spectral content directly rather
than relying on a bespoke `--filter thiran --order 6` style harness that
doesn't exist here).

---

## 3. Domain Schemas & API Contracts (actual)

### 3.1 Core DSP interface — the real WASM surface

```rust
// dsp/src/lib.rs, #[wasm_bindgen] impl DspEngine
pub fn new(sample_rate: f32, seed: u32) -> Self
pub fn pluck(&mut self, string_idx: usize, freq: f32, velocity: f32)
pub fn pluck_articulated(&mut self, string_idx: usize, freq: f32, velocity: f32,
                        pick_position: f32, pick_hardness: f32)
pub fn set_pick_position(&mut self, string_idx: usize, position: f32)
pub fn set_pick_hardness(&mut self, string_idx: usize, hardness: f32)
pub fn damp(&mut self, string_idx: usize, amount: f32)
pub fn apply_harmonic_damping(&mut self, string_idx: usize, node_ratio: f32, strength: f32)
pub fn bend(&mut self, string_idx: usize, target_freq: f32, duration_ms: f32)
pub fn set_whammy(&mut self, semitones: f32)
pub fn set_all_pickup_positions(&mut self, position: f32)
pub fn set_drive(&mut self, drive: f32)
pub fn begin_chunk(&mut self)
pub fn process_frames(&mut self, frame_count: usize)
pub fn process_chunk(&mut self)
pub fn output_ptr(&self) -> *const f32
pub fn string_output_ptr(&self) -> *const f32
pub fn active_voice_count(&self) -> usize
pub fn string_energy(&self, string_idx: usize) -> f32
```

This is the real contract — there's no `IFractionalDelay`/
`IWaveguideJunction` TypeScript interface layer in front of it (the WASM
bindings generated by `wasm-bindgen` are the interface), and there's no
Pydantic `PCAExcitation` model anywhere since there's no Python side at
all. Excitation today is a per-string persistent PRNG noise burst shaped
by pick position and velocity, hand-tuned in Rust — not a `z1`/`z2`
articulation-space coordinate learned from recordings.

### 3.2 WDF node interface — the real passive-circuit primitives

```typescript
// src/audio/wdf/wdfNodes.ts (canonical) — mirrored inline in processor.js
class WdfResistor {
  portResistance: number;
  waveReflect(a): number;
  step(a): void;
}
class WdfCapacitor {
  portResistance: number; /* state-based, per sampleRate */
}
class WdfInductor {
  portResistance: number; /* state-based, per sampleRate */
}
class WdfPotentiometer {
  portResistance: number;
  setPosition(pos: number): void;
}
class WdfSeriesAdaptor {
  portResistance: number;
  waveReflect(a): number;
  step(a): void;
}
class WdfParallelAdaptor {
  portResistance: number;
  waveReflect(a): number;
  step(a): void;
}
```

These satisfy the source document's energy-conservation intent by
construction (adaptor port resistance is derived from the children's port
resistances each sample; reflection coefficients sum correctly) — no
separate stability guard needs to be bolted on, just preserved when adding
new topologies.

### 3.3 Pickup model — currently linear

`WdfCircuit` models the pickup's R/L/C electronics as a linear passive solve,
and `processor.js` currently sends that result downstream without a separate
pickup-response waveshaper. The tube and pedal stages later in `pipeline.ts`
are nonlinear, but they are not a magnetic pickup-saturation model. A
post-solve polynomial response remains open work; it should stay outside the
passive adaptor tree so the WDF port-resistance invariants remain intact.

### 3.4 Actual stability/error constraints worth guarding

- **WDF port-resistance matching**: any new adaptor topology must compute
  `portResistance` consistently with its children every sample, or the
  reflection math silently produces an unstable/incorrect solve with no
  explicit error — there's no runtime assertion for this today. Worth
  adding a debug-mode check, not currently present.
- **Fractional delay bounds**: `base_delay_samples` in `dsp/src/lib.rs`
  must remain within the circular delay-line capacity. The current
  first-order Lagrange/Farrow read wraps both neighboring samples explicitly;
  Thiran order constraints do not apply because this is not a Thiran filter.

---

## 4. Task Matrix — actual open work, prioritized

| Item                                                                           | Where                                             | Status                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Cascaded dispersion allpass, Fletcher inharmonicity                            | `dsp/src/lib.rs`                                  | ✅ Done                                                                                             |
| Loop filter fundamental-gain compensation                                      | `dsp/src/lib.rs`                                  | ✅ Done                                                                                             |
| Subtractive pickup-position comb, pitch-tracked                                | `processor.js`                                    | ✅ Done                                                                                             |
| WDF-solved passive tone stack, per-model makeup gain                           | `processor.js` / `wdfToneStack.ts`                | ✅ Done                                                                                             |
| **Sympathetic string coupling through a shared bridge term**                   | `dsp/src/lib.rs`                                  | 🔲 Open — strings are currently processed independently                                             |
| Per-string persistent PRNG (decorrelated pick attacks)                         | `dsp/src/lib.rs`                                  | ✅ Done                                                                                             |
| Bend/glide + note damping API                                                  | `dsp/src/lib.rs` (`bend`, `damp`)                 | ✅ Done                                                                                             |
| Modal-resonance cabinet IR                                                     | `pipeline.ts`                                     | ✅ Done                                                                                             |
| Fractional-delay interpolation (first-order Lagrange/Farrow; not Thiran)       | `dsp/src/lib.rs`                                  | ✅ Done                                                                                             |
| **Non-linear pickup response (polynomial saturation stage)**                   | `processor.js` / `wdfNodes.ts`                    | 🔲 Open — the current pickup/harness path is linear                                                 |
| Whammy bar / global pitch bend API and worklet message (`set_whammy`)          | `dsp/src/lib.rs` / `processor.js`                 | ✅ Done                                                                                             |
| Open-string (fret 0) hammer/pull/slide targets                                 | `tabParser.ts`                                    | ✅ Done                                                                                             |
| Tab scheduler → `damp()` wiring for release, rests, and mutes                  | `tabScheduler.ts`                                 | ✅ Done                                                                                             |
| Pinch-harmonic notation and harmonic damping                                   | `tabParser.ts` / `dsp/src/lib.rs`                 | ✅ Done                                                                                             |
| Articulated plucks (`pluck_articulated`, pick position, pick hardness)         | `dsp/src/lib.rs` / `processor.js`                 | ✅ Done                                                                                             |
| Per-string WASM output separation (`string_output_ptr`) for pickup sensing     | `dsp/src/lib.rs` / `processor.js`                 | ✅ Done                                                                                             |
| Voice/energy telemetry (`active_voice_count`, `string_energy`) feeding amp sag | `dsp/src/lib.rs` / `processor.js` / `pipeline.ts` | ✅ Done                                                                                             |
| **Expose `set_whammy` through a UI control and MIDI pitch wheel**              | `src/ui/` / `webMidiManager.ts`                   | 🔲 Open — the engine/worklet path is complete, but no producer sends the message                    |
| **Keep the reachable JS fallback behavior in parity with WASM articulation**   | `karplusStrong.ts` / `pipeline.ts`                | 🔲 Open — articulated hardness, harmonic damping, per-string PRNG, and whammy behavior still differ |
| **External six-channel hexaphonic routing**                                    | `processor.js` / `pipeline.ts`                    | 🔲 Open — per-string WASM buffers exist internally, but Web Audio output is still mixed             |

## 5. Rejected Patterns & Guards (adapted)

- **No fixed/hardcoded PRNG seeds for excitation** — already fixed
  (per-string persistent state); don't regress this by reintroducing a
  constant seed for "reproducibility" anywhere in the live audio path.
  Tests that need determinism should seed explicitly, not rely on a
  hardcoded engine-wide constant.
- **No note-off via abrupt sample-to-zero cut** — `damp()` must ramp, not
  step, or it reintroduces the click problems the crossfade/retrigger path
  was built to avoid.
- **No new tone-stack or pickup topology without port-resistance
  verification** — every WDF adaptor's `portResistance` must be derived
  correctly from its children each sample; an incorrect topology won't
  throw, it'll just quietly attenuate or color wrong (see the tone-stack
  makeup-gain regression from earlier in this project — that class of bug
  ships silently unless you measure RMS in/out directly).

## 6. Verification & Test Harness (actual)

- `npm run test` runs the full Vitest suite — `wdfNodes.test.ts`,
  `wdfCircuitSolver.test.ts`, `wdfResonance.test.ts`,
  `wdfWorkletParity.test.ts`, `toneStackWdf.test.ts`, `tabParser.test.ts`,
  `karplusStrong.test.ts`, `pickupComb.test.ts`, `tubeCurve.test.ts`,
  `pipeline.test.ts`, `midiParser.test.ts` cover the DSP surface.
- `wasmProduction.test.ts` exercises the production WASM engine, including
  fractional-delay pitch accuracy, articulated plucks, per-string output,
  whammy behavior, and voice/energy telemetry. There is still no standalone
  swept magnitude/flatness harness comparable to the source document's
  `ag-verify` example; add one if interpolation order or topology changes.
- For anything level/gain-related, measure RMS in vs. out directly with a
  small offline script (Node, no browser needed) rather than trusting ear
  alone — that's exactly how the tone-stack makeup-gain and cabinet-IR
  issues earlier in this project were confirmed and fixed.

Current CI, real-browser worklet checks, build setup, and verification limits are
documented in [VERIFICATION.md](VERIFICATION.md). The browser harness executes
the development and production-bundled processors at 44.1 and 48 kHz; it does
not replace independent physical calibration or real-time device benchmarks.
