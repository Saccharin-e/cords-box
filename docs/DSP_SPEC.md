# Technical Specification: Cords Box Physical Modeling Synthesis Engine

*Tailored from a generic Digital Waveguide synthesis spec to describe what
actually exists in `Saccharin-e/cords-box` (`develop` branch) as of this
writing. Sections below follow the source document's shape; content is
rewritten against the real codebase, not aspirational. Where the source
document assumed tooling or architecture this repo doesn't have — a separate
C++/Python split, a MOTU/MAS/Digital Performer plugin target, an
"Antigravity IDE" with `GEMINI.md`/`AGENTS.md` agent-orchestration files,
`ag-*` CLI tooling, PCA/NLPCA excitation trained from recordings — that's
called out explicitly rather than carried over. None of that exists in this
repo and inventing it here would just be fiction.*

---

## 1. Project Context & High-Level Directives

Cords Box is a browser-based guitar wiring simulator and tab player. Its
synthesis engine already **is** a physical-modeling engine, not sample
playback — the "Builder vs. Player" framing in the source document doesn't
map cleanly because there's no separate offline authoring tool: the
Rust/WASM engine *is* the player, and its physical constants (string
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
   inharmonicity, not a generic frequency-only heuristic), a loop filter
   with fundamental-gain compensation, per-string persistent excitation
   noise (not a fixed seed — each pluck is independently random), a
   `bend()`/glide path for pitch bends, a `damp()` path for note-off/
   release, and light sympathetic coupling between strings via a shared
   bridge term.
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
[ EXCITATION ]        [ STRING RESONATOR ]         [ PICKUP / TONE-STACK ]      [ AMP / CAB ]
per-string PRNG   →   Digital Waveguide       →    WDF passive circuit    →    Tube waveshaper
noise burst,           (H/V planes, cascaded         solver (pickup R/L/C,       + per-model tone
pick position,         dispersion allpass,           volume/tone pots,           stack (WDF) +
bend()/damp() as       loop filter w/ gain            per-model tone stack)      modal-resonance
external control        compensation, sympathetic                                cabinet IR
                        string coupling)
```
(`dsp/src/lib.rs` → `src/audio/processor.js` `WdfCircuit`/`WdfToneStack` →
`src/audio/pipeline.ts` tube/cabinet stages.)

### 1.3 Operational Goals (real constraints, not arbitrary numbers)

* **Real-time computation**: the actual budget is the AudioWorklet's
  render quantum — 128 samples, ≈2.7ms at 48kHz — not a generic "<1ms"
  figure. `DspEngine::process_chunk()` must stay well under that per call
  across however many strings are active plus the WDF/tone-stack solve.
* **Sample-accurate tuning**: `dsp/src/lib.rs` currently reads delay lines
  with **linear interpolation** (`idx1*(1-fract) + idx2*fract`,
  ~line 368-382), not a Thiran allpass or Lagrange FIR interpolator. Linear
  interpolation is simpler but has more high-frequency smearing than either
  of those — this is a real, honest gap versus the source document's
  fractional-delay rigor, and a legitimate thing to fix (see §4).
* **Energy conservation**: this one *does* map directly and is already
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

* **Rust (edition 2021)** — the DWG engine, compiled with `wasm-bindgen`
  to a `cdylib` WASM target. This is the source doc's "Player," but
  there's no separate "Builder" runtime — no Python, no offline ML
  pipeline exists in this repo today.
* **TypeScript / React 19** — UI, orchestration, and the canonical WDF
  circuit-solver source (`src/audio/wdf/`).
* **Vitest** — the test runner for everything, DSP included (there's no
  separate C++ test harness or `ag-verify`/`ag-bench` — Vitest specs under
  `tests/audio/` fill that role, e.g. `wdfResonance.test.ts`,
  `toneStackWdf.test.ts`, `tabParser.test.ts`, `midiParser.test.ts`).

### 2.2 Dependencies (actual, from `package.json` / `Cargo.toml`)

* Rust: `wasm-bindgen`, `js-sys` — no linear-algebra library is needed or
  present, since there's no PCA/NLPCA step. If a future ML-based
  excitation model is genuinely wanted, that would need to be scoped and
  added as new work, not assumed.
* JS/TS: `react`, `konva` (canvas rendering), `lucide-react` (icons),
  `jspdf` (export), `vite` + `vitest` (build/test).
* No `Eigen`, no `Accelerate`/`vDSP` — this is a browser target, not a
  native iPad/MAS plugin, so hardware-vector-library bindings don't apply.

### 2.3 There is no MCP orchestration configuration in this repo

The source document's `filesystem`/`git`/`terminal` MCP section describes
autonomous multi-agent tooling that isn't part of this project. Standard
`git` operations against `github.com/Saccharin-e/cords-box` are how changes
actually land here — no persistent task-lock registry exists. If that's
something you want to add, it's a new decision to make explicitly, not
something to assume is already configured.

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
pub fn damp(&mut self, string_idx: usize, amount: f32)
pub fn bend(&mut self, string_idx: usize, target_freq: f32, duration_ms: f32)
pub fn set_pickup_position(&mut self, string_idx: usize, position: f32)
pub fn set_all_pickup_positions(&mut self, position: f32)
pub fn set_drive(&mut self, drive: f32)
pub fn process_chunk(&mut self)
pub fn output_ptr(&self) -> *const f32
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
class WdfResistor { portResistance: number; waveReflect(a): number; step(a): void; }
class WdfCapacitor { portResistance: number; /* state-based, per sampleRate */ }
class WdfInductor  { portResistance: number; /* state-based, per sampleRate */ }
class WdfPotentiometer { portResistance: number; setPosition(pos: number): void; }
class WdfSeriesAdaptor { portResistance: number; waveReflect(a): number; step(a): void; }
class WdfParallelAdaptor { portResistance: number; waveReflect(a): number; step(a): void; }
```

These satisfy the source document's energy-conservation intent by
construction (adaptor port resistance is derived from the children's port
resistances each sample; reflection coefficients sum correctly) — no
separate stability guard needs to be bolted on, just preserved when adding
new topologies.

### 3.3 Pickup model — currently linear, no non-linearity modeled

The source document's polynomial magnetic-flux non-linearity (Horner-scheme,
25dB+ V/H ratio guard) does **not** exist here yet. The actual pickup model
(`WdfCircuit` in `processor.js`) is a fully **linear** R/L/C network solve —
physically accurate for the electronics, but it doesn't model the pickup's
nonlinear response to large string excursion (magnetic saturation at high
displacement). This was flagged as a real, if minor, realism gap earlier in
this project's audit. If pursued, it should slot in as a post-linear-solve
polynomial stage in `processor.js`/`wdfNodes.ts` — see §4.

### 3.4 Actual stability/error constraints worth guarding

* **WDF port-resistance matching**: any new adaptor topology must compute
  `portResistance` consistently with its children every sample, or the
  reflection math silently produces an unstable/incorrect solve with no
  explicit error — there's no runtime assertion for this today. Worth
  adding a debug-mode check, not currently present.
* **Fractional delay bounds**: `base_delay_samples` in `dsp/src/lib.rs`
  must stay large enough that the linear interpolation read never indexes
  before the write head — this is handled implicitly by the existing delay
  line sizing, but there's no explicit `D > N - 1`-style guard the way the
  source document mandates for Thiran filters, since a different
  interpolation method is in use (see §4 if that changes).

---

## 4. Task Matrix — actual open work, prioritized

| Item | Where | Status |
|---|---|---|
| Cascaded dispersion allpass, Fletcher inharmonicity | `dsp/src/lib.rs` | ✅ Done |
| Loop filter fundamental-gain compensation | `dsp/src/lib.rs` | ✅ Done |
| Subtractive pickup-position comb, pitch-tracked | `processor.js` | ✅ Done |
| WDF-solved passive tone stack, per-model makeup gain | `processor.js` / `wdfToneStack.ts` | ✅ Done |
| Sympathetic string coupling | `dsp/src/lib.rs` | ✅ Done |
| Per-string persistent PRNG (decorrelated pick attacks) | `dsp/src/lib.rs` | ✅ Done |
| Bend/glide + note damping API | `dsp/src/lib.rs` (`bend`, `damp`) | ✅ Done |
| Modal-resonance cabinet IR | `pipeline.ts` | ✅ Done |
| **Upgrade linear interpolation → allpass/Lagrange fractional delay** | `dsp/src/lib.rs` (~line 368-382) | 🔲 Open — this is the source doc's Thiran emphasis, honestly applicable here |
| **Non-linear pickup response (polynomial flux stage)** | `processor.js` / `wdfNodes.ts` | 🔲 Open, low priority |
| **Whammy bar / global pitch bend across all active strings at once** | `dsp/src/lib.rs`, no method exists | 🔲 Open — `bend()` is per-string only; a real trem bar moves every string's pitch together via the bridge |
| **Open-string (fret 0) as a valid hammer/pull/slide target** | `tabParser.ts` | 🔲 Open — confirm `targetFret: 0` isn't treated as "no target" |
| **Tab scheduler → `damp()` wiring** | `tabScheduler.ts` | 🔲 Open — the API exists now (see above); the scheduler doesn't call it yet for note-off/rests |
| Pinch-harmonic notation support | `tabParser.ts` | 🔲 Open, nice-to-have |

## 5. Rejected Patterns & Guards (adapted)

* **No fixed/hardcoded PRNG seeds for excitation** — already fixed
  (per-string persistent state); don't regress this by reintroducing a
  constant seed for "reproducibility" anywhere in the live audio path.
  Tests that need determinism should seed explicitly, not rely on a
  hardcoded engine-wide constant.
* **No note-off via abrupt sample-to-zero cut** — `damp()` must ramp, not
  step, or it reintroduces the click problems the crossfade/retrigger path
  was built to avoid.
* **No new tone-stack or pickup topology without port-resistance
  verification** — every WDF adaptor's `portResistance` must be derived
  correctly from its children each sample; an incorrect topology won't
  throw, it'll just quietly attenuate or color wrong (see the tone-stack
  makeup-gain regression from earlier in this project — that class of bug
  ships silently unless you measure RMS in/out directly).

## 6. Verification & Test Harness (actual)

* `npm run test` runs the full Vitest suite — `wdfNodes.test.ts`,
  `wdfCircuitSolver.test.ts`, `wdfResonance.test.ts`,
  `wdfWorkletParity.test.ts`, `toneStackWdf.test.ts`, `tabParser.test.ts`,
  `karplusStrong.test.ts`, `pickupComb.test.ts`, `tubeCurve.test.ts`,
  `pipeline.test.ts`, `midiParser.test.ts` cover the DSP surface.
* There's no built-in magnitude/flatness assertion harness for the
  interpolator (nothing plays the role of the source doc's `ag-verify
  --filter thiran --order 6 --omega 0`) — if the linear-interpolation
  upgrade in §4 happens, add a Vitest spec that checks interpolated pitch
  accuracy and high-frequency rolloff directly, the same pattern the
  existing `wdfResonance.test.ts` already uses for the circuit side.
* For anything level/gain-related, measure RMS in vs. out directly with a
  small offline script (Node, no browser needed) rather than trusting ear
  alone — that's exactly how the tone-stack makeup-gain and cabinet-IR
  issues earlier in this project were confirmed and fixed.
