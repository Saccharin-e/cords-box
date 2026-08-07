# Future Implementation Roadmap
## Cords Box — Browser-Based Guitar Circuit & Tab Simulator

---

## 0. Current State (Baseline — August 2026)

The project has shipped a strong, production-quality v1 foundation across all three architectural tiers:

### UI / Canvas Layer ✅
- Dual-view synchronized canvas: **physical guitar body layout + node-based schematic** (`DualCanvas`, `PhysicalView`, `SchematicView`)
- Component library with drag-and-drop: single-coil, humbucker, P90 pickups; 3/4/5-way & DPDT switches; concentric/push-pull/blend pots; capacitors, resistors, output jacks, shape tools, project cards
- Drag-to-wire canvas interaction with wire layer overlay (`WireLayer`, `wireUtils`)
- Configurable canvas themes (dark/light), snap-to-grid, viewport CAD controls
- Retractable toolbars with full space reclaiming and smooth transitions
- Interactive playable fretboard panel (`PlayableFretboardPanel`)
- Amp/pedalboard control panel (`AmpPedalboardPanel`)
- High-DPI PNG & PDF region export (`ExportBoxOverlay`)
- Layout slot persistence (save/recall 9 slots, `slotStore`)
- Customizable keyboard shortcuts (`keybindingsStore`)

### State Management Layer ✅
- Zustand stores: `circuitStore`, `canvasStore`, `slotStore`, `keybindingsStore`
- Full Zod schema validation (`types.ts`): `CircuitGraph`, `CircuitNode`, `CircuitEdge`, `Component`, `SwitchState`
- `instrument_family` tag (Guitar, Bass, Mandolin, Ukulele, Other) for future multi-instrument extensibility (NFR-1)
- Graph engine (`Graph.ts`, `solver.ts`) with netlist traversal, path-finding, switch state resolution, and potentiometer taper curves

### Audio DSP Layer ✅
- **Wave Digital Filter (WDF) AudioWorklet**: `guitar-processor` off-thread per-sample solver (`processor.js`, `wdfNodes.ts`, `wdfCircuitSolver.ts`) with real-time live parameter sync via `wdf-update` postMessage protocol
- **Rust WebAssembly DSP core**: Karplus-Strong physical modeling engine (`dsp/`, `dsp.js`, `dsp_bg.wasm`) with `DspEngine.pluck()` / `process_chunk()` API
- **Hybrid signal path**: synthesized Karplus-Strong strings + CC0 Black & Green Guitars DI sample bank (48kHz 24-bit, `sampleBank.ts`)
- Tube preamp chain: 3 cascaded waveshaper stages (`preampTube`, `secondTube`, `powerAmpTube`), preamp gain, tone stack (bass/mid/treble/presence)
- Pedal chain: compressor, overdrive/distortion (dry-wet mix), chorus, delay
- Cabinet IR convolution (broadband noise-based IR, `1x12_open`, `2x12_tweed`, `4x12_stack`, `4x12_metal`)
- Room ambience IR (dense stereo noise + early reflections)
- Polyphony-aware sample bus gain compensation (`updateSampleBusGain`, `1/√N` power normalization)
- Formant highpass/lowpass pitch-shift filters for natural fretboard playback
- Demo song playback system across 5 genres (Rock, Blues, Hard Rock, Alternative Rock, Dream Pop)
- 4-preset circuit library (Stratocaster HSS, Indie-Rock Telecaster, 50s Telecaster, Les Paul)

### Circuit Validation Layer ✅
- Linter: dead shorts to ground, open circuits, same-pole DPDT jumper chains (`linter.ts`)
- Truth-table export (`truthTable.ts`)
- 39 passing Vitest tests (10 test files): graph solver, WDF nodes, WDF circuit solver, audio pipeline, sample bank, lint, preset library, slot store, UI fretboard

---

## 1. Short-Term — DSP & Signal Path Hardening
> **Target:** v1.1 – v1.3 | Focus: stabilize and complete the DSP layer before expanding scope.

### 1.1 Retire the `WdfPassiveCircuit` Approximation & Wire the Real WDF Tree

**Current state**: `WdfPassiveCircuit` inside `processor.js` uses a single-pole RC lowpass with hardcoded `250kΩ / 47nF / 6.5kΩ` values as a placeholder. The real multi-element WDF tree (`WdfResistor`, `WdfCapacitor`, `WdfInductor`, `WdfPotentiometer`, `WdfSeriesAdaptor`, `WdfParallelAdaptor` — all correct in `src/audio/wdf/wdfNodes.ts`) is never called from the audio thread.

**Tasks:**
- Build a **dedicated worklet bundle entry point** (`src/audio/workletEntry.ts`) using Vite's `new URL('./workletEntry.ts', import.meta.url)` or a small manual Rollup step so the worklet can import TypeScript modules (Vite supports `type: 'module'` worklet scripts in modern Chrome/Firefox).
- Migrate `WdfGuitarCircuitSolver` topology-building logic (`buildFromGraph()`) into the worklet thread, receiving serialized graph parameters via `wdf-update`.
- Replace `WdfPassiveCircuit.processSample()` with `WdfGuitarCircuitSolver.processSample()` running the real adaptor tree per sample.
- Validate correctness by comparing frequency-response output against LTspice simulations of the reference Stratocaster/Telecaster/Les Paul topologies.

**Files affected**: `src/audio/processor.js`, `src/audio/wdf/wdfCircuitSolver.ts`, `src/audio/pipeline.ts`

---

### 1.2 Cable Capacitance & Pickup Loading Model

**Current state**: Pickup → wiring → cable → amp input are treated as independent cascaded filters. The loaded RLC resonance (where pickup inductance, tone cap, cable cap, and amp input impedance form a single network) is not modeled.

**Tasks:**
- Extend `extractWorkletParams()` in `pipeline.ts` to include a `cableCapFarads` field (default ~500pF for a 6m cable, configurable in the inspector).
- In the WDF tree topology inside the worklet, add a `WdfCapacitor` representing cable capacitance in parallel with the pickup output node, properly loaded by the amp input impedance (typically 1MΩ, modeled as a `WdfResistor`).
- Expose a cable length / capacitance control in the inspector panel or amp UI.

---

### 1.3 Tube Waveshaper Curves — Real Saturation

**Current state**: `createCleanTubeCurve()` generates a curve that stays near-linear below ~0.85 amplitude, contributing negligible harmonic coloration at normal playing levels. Only hard clips near the ceiling.

**Tasks:**
- Redesign waveshaper curves to model the characteristic soft-knee knee of a triode preamp stage: soft asymmetric compression beginning below 0.5 input, transitioning smoothly to saturation rather than hard clipping.
- Reference triode grid-conduction clipping equations from existing DSP literature (e.g. Yeh/Abel/Smith waveshaper papers). The asymmetric folding (positive half clips before negative) is essential for second-harmonic generation.
- Parameterize the curve by bias point so different `ampModel` settings (`clean_twin`, `crunch_800`, `high_gain`, `vox_chime`) produce meaningfully different saturation characters.
- Add per-model tone stack curve shapes (Fender: mid-scoop, Marshall: aggressive mid bump, Vox: treble-cut character) using the published passive network transfer function coefficients rather than generic 3-band EQ.

---

### 1.4 Compressor Consolidation

**Current state**: Three `DynamicsCompressorNode`s are stacked (`pedalCompressor` → `powerSag` → final `compressorNode`). Cascaded browser compressors with different time constants risk audible pumping artefacts.

**Tasks:**
- Audit each compressor's role in isolation (use `OfflineAudioContext` unit tests).
- Collapse to two: one musical pedalboard compressor (CS-80/Orange Squeezer style slow attack) + one fast headroom limiter immediately before the waveshaper chain to prevent any overshoot from reaching the hard-clamp zone.
- Remove `powerSag` as an independent `DynamicsCompressorNode` and instead model power sag as an envelope-follower gain reduction applied directly to `preampGain`'s gain parameter (more accurate, cheaper, no cascaded compressor click).

---

### 1.5 AudioWorklet WASM Build Pipeline

**Current state**: `dsp.js` / `dsp_bg.wasm` are pre-compiled artifacts committed to the repo. Changes to the Rust DSP core require a manual `wasm-pack build` step.

**Tasks:**
- Add a `build:wasm` npm script using `wasm-pack build --target web dsp/` (or `wasm-bindgen`) with output directed to `src/audio/` so the Vite build pipeline picks it up automatically.
- Add `dsp/pkg/` to `.gitignore` and commit only `dsp/src/` + `dsp/Cargo.toml`.
- Wire into `npm run build` as a pre-step so CI always regenerates WASM from source.
- Document the Rust toolchain requirement (`rustup target add wasm32-unknown-unknown`) in the README.

---

## 2. Mid-Term — Circuit Intelligence & Realism
> **Target:** v1.4 – v2.0 | Focus: making the wiring simulator's behavior fully circuit-accurate.

### 2.1 Full Multi-Element WDF Circuit Topology Builder

**Current state**: `WdfGuitarCircuitSolver.buildFromGraph()` constructs a simplified two-element RC/RLC approximation. The adaptor tree doesn't fully represent complex topologies like concentric pots with separate tone and blend sides, series-wired pickups, or treble-bleed networks.

**Tasks:**
- Extend `WdfGuitarCircuitSolver` to support arbitrary pickup→switch→pot→cap→jack topologies by traversing the circuit graph's netlist rather than using hardcoded element positions.
- Implement WDF **R-type (scattering) adaptors** for junctions with more than two branches (required for concentric pot and blend tap modeling).
- Model the **treble-bleed network** (resistor + cap in parallel with volume pot, `treble_bleed` component type already in `types.ts`) as a separate WDF branch.
- Test accuracy against SPICE (LTspice/ngspice) simulated frequency responses for each preset.

---

### 2.2 Guitar Tab Parsing Engine

**Goal**: Structured tab ingestion as a first-class feature, enabling scheduled multi-note playback from human-readable notation.

**Tasks:**
- Define a `TabNote` schema (string index 0–5, fret 0–24, duration in beats, articulation flags).
- Define a `TabScore` schema (bpm, time signature, array of `TabNote` with time offsets in beats).
- Implement a plain-text ASCII tablature parser supporting:
  - Standard 6-line format
  - Fret numbers (0–24), open strings
  - Basic articulation: `h` (hammer-on), `p` (pull-off), `/` `\` (slides), `b` (bend), `r` (release), `~` (vibrato), `x` (muted)
  - Timing inference from note density and blank characters as rests
- Export `parseTab(text: string): TabScore` — fully headless, no audio dependency.
- Add Vitest tests with real-world tab examples (smoke tests for accuracy + malformed input rejection).

---

### 2.3 Tab Playback Scheduler

**Goal**: Tight, deterministic Web Audio API timeline scheduling of parsed tab events.

**Tasks:**
- Build `TabScheduler` class:
  - Takes `TabScore` + `AudioContext`
  - Converts beat offsets to `AudioContext.currentTime` values based on BPM
  - Calls `audioPipeline.triggerPluck(freq, velocity, stringIndex)` using `ctx.currentTime + scheduledOffset` for sample-accurate timing
  - Lookahead buffer (standard Web Audio scheduling pattern: schedule 100ms ahead, flush every 50ms via `setInterval` or `requestAnimationFrame`)
- Expose transport controls: `play()`, `pause()`, `stop()`, `setTempo(bpm)`, `seek(beat)`
- Support looping and one-shot playback modes

---

### 2.4 Tab UI Integration

**Tasks:**
- Add a **Tab Panel** to the main UI alongside the existing `GuitarSoundTestPanel` and `PlayableFretboardPanel`.
- Text input area for raw ASCII tab paste.
- Parsed note timeline visualization (scrollable, highlights current playback position).
- Transport controls (play / pause / stop / tempo slider / loop toggle).
- Connect parsed `TabScore` to `TabScheduler` for live playback.
- Wire fretboard visual note highlights to match `TabScheduler` lookahead events.

---

### 2.5 Articulation Engine

**Goal**: Eliminate robotic playback by modeling real playing physics.

**Tasks:**
- **Hammer-on / pull-off**: Rapid pitch glide without re-triggering pluck excitation — achieved by adjusting playback rate on a ringing `BufferSourceNode` or updating Karplus-Strong delay line length mid-ring without re-exciting.
- **Slides**: Pitch interpolation between two frets over a specified duration (linear and logarithmic glide modes).
- **String bends**: Pitch raise from a starting fret via `playbackRate.linearRampToValueAtTime()` or Rust DSP engine pitch modulation.
- **Vibrato**: Low-frequency oscillation on pitch (`playbackRate` LFO at 4–7Hz, ±25 cents depth).
- **Palm mute**: Short decay envelope + heavy low-pass cutoff (< 1kHz) applied to per-note gain and a `BiquadFilterNode`.
- **Fret noise / string squeak**: Optional CC0 noise sample triggered at legato transitions above a velocity threshold.
- **Strum timing variation**: Currently linear 35ms stagger — replace with a user-controlled strum speed (10–100ms spread) with ±5ms random Gaussian offset per string.

---

### 2.6 Alternate Tunings

**Tasks:**
- Define a `TuningPreset` record: name, string open-note frequencies (E2/A2/D3/G3/B3/E4 standard → any 6 frequencies).
- Ship built-in presets: Standard E, Eb Standard, Drop D, Open G, Open E, DADGAD, Open D, Open A.
- Update `GUITAR_STRINGS` from a static constant to a store-driven value (`circuitStore` or new `instrumentStore`).
- Update `PlayableFretboardPanel` to render tuning names above each string and compute all fret frequencies from open-string base + semitone formula `2^(fret/12)`.
- Update `TabScheduler` to resolve string+fret pairs using active tuning rather than hardcoded standard frequencies.

---

### 2.7 Additional Instrument Families (Bass, Ukulele)

**Current state**: `InstrumentFamily` enum already includes `Bass`, `Mandolin`, `Ukulele`, `Other`. `CircuitGraph` requires `instrument_family` tag.

**Tasks:**
- Add **bass guitar** component types: pickup types (split-coil P-Bass, J-Bass neck/bridge, humbucker), bass-specific switch/pot configurations.
- Add **bass string frequencies**: B0 (if 5-string), E1, A1, D2, G2.
- Add bass-specific cabinet IRs (deeper, boomy 1x15 / 4x10 bass cab profiles).
- Extend `PlayableFretboardPanel` to render 4/5/6-string bass layout.
- Extend `presetLibrary.ts` with classic bass wirings (Jazz Bass standard, Precision Bass, MM Stingray).
- Define `InstrumentConfig` schema encoding string count, tuning, scale length — sourced per `instrument_family`.

---

## 3. Long-Term — Intelligence, Sharing & Scale
> **Target:** v2.0+ | Focus: advanced features, collaboration, and AI-assisted tools.

### 3.1 OMR (Optical Music Recognition: Image → Tab)

**Goal**: Automated tab ingestion from scanned sheet music or photographs.

**Phases:**

**Phase 1 — Symbol detection (MVP classifier):**
- Train a CNN (MobileNet / EfficientNet-Lite) on labeled guitar tab datasets to detect tab line grids, fret numbers (0–24), and articulation symbols.
- Export to ONNX and run inference in-browser via `onnxruntime-web` + WebGPU acceleration.
- Produce a set of candidate `{line, column, symbol}` detections.

**Phase 2 — Sequence reconstruction:**
- Build a structured parser on top of Phase 1 detections: assign string indices to detected rows, order events left-to-right, infer timing from column positions relative to measure lines.
- Resolve ambiguous detections (low-confidence fret numbers) with a beam-search decoder weighted by music-grammar priors.

**Phase 3 — Deployment:**
- Primary: client-side ONNX + WebGPU (no server round trip).
- Fallback: FastAPI backend with PyTorch inference for browsers without WebGPU.
- Progressive enhancement: offer "offline OMR" as an installed PWA feature (with model cached in IndexedDB).

---

### 3.2 MIDI Import / Export

**Tasks:**
- **MIDI import**: Parse `.mid` files (MIDI Type 0/1) using a lightweight JS MIDI parser. Map MIDI note numbers to guitar string+fret assignments using a configurable pitch-to-fret mapper (lowest available string, or explicit voice assignment). Feed into `TabScheduler`.
- **MIDI export**: Convert a `TabScore` to MIDI Type 1 with one track per string. Note-on velocity from `gainVal` calculations, note-off from duration.
- **Live MIDI input**: Connect `navigator.requestMIDIAccess()` to trigger `audioPipeline.triggerPluck()` directly from a MIDI guitar or keyboard controller in real time.

---

### 3.3 Performance Optimization

**Tasks:**
- **SharedArrayBuffer + Atomics**: Enable `COOP` / `COEP` response headers (requires server config or custom Vite dev server middleware). Use `SharedArrayBuffer` to pass audio parameters between main thread and worklet without postMessage serialization latency.
- **WASM SIMD**: Enable SIMD intrinsics in Rust DSP core (`target-feature = +simd128` for WASM). Profile Karplus-Strong delay line loop for SIMD acceleration.
- **Worker thread graph solving**: Move `GraphSolver.solve()` to a `Worker` thread to avoid blocking the main thread during large circuit rebuilds.
- **Bundle splitting**: Lazy-load `PlayableFretboardPanel`, `AmpPedalboardPanel`, and `OMR` modules via React `lazy()` + `Suspense`.
- **Model caching**: Cache WASM binary and OMR ONNX models in `IndexedDB` for offline use and instant subsequent loads.

---

### 3.4 Preset Sharing & Cloud Sync

**Tasks:**
- **Circuit URL export**: Serialize the current `CircuitGraph` + `CanvasStore` to a compact base64 URL hash. Paste or share the URL to restore the exact circuit on any device (no server required).
- **File-based preset export**: Export circuit as `.cordsbox` (JSON envelope with schema version, graph, canvas layout, audio state).
- **Preset marketplace (optional)**: User-uploadable preset library with likes/forks (requires backend — FastAPI or Supabase). Not required for core desktop-first experience.
- **Cloud sync**: Optional sign-in (OAuth via GitHub) for syncing slot store and preset library across devices via a lightweight Supabase / Firebase backend.

---

### 3.5 Advanced Synthesis Features

**Tasks:**
- **Dual-polarization string model**: Add a second Karplus-Strong delay line with a slightly different delay time (modeling the second plane of string vibration) and sum both lines with a short relative delay (0.3–1.5ms). Produces the subtle beating/chorusing that real strings exhibit during sustain.
- **Dispersion / inharmonicity filter**: All-pass filter in the Karplus-Strong feedback loop to reproduce the slightly sharp upper harmonics of real strings (inharmonicity coefficient B varies by string gauge and scale length).
- **Commuted synthesis**: Move body resonance coloring from a per-string stage into the excitation signal (since linear systems commute — cheaper per polyphonic note).
- **Body resonance IR**: Per-guitar-body-shape impulse response (dreadnought acoustic body, Stratocaster maple/alder slab, Les Paul carved maple top) convolved with the excitation to give each preset its correct body character, even when DI samples are in use.
- **Hexaphonic pickup simulation**: Model all 6 strings as independent outputs routed to independent pickup input channels — enables true hexaphonic wiring simulation (Roland GK, Fishman TriplePlay style multi-channel output jacks).

---

### 3.6 Visual & UX Enhancements

**Tasks:**
- **Component photorealism mode**: Replace SVG component shapes with high-fidelity raster renders (or 3D-rendered sprites) of real hardware — CTS pots, Switchcraft jacks, Fender switch wafers, Sprague capacitors.
- **3D guitar body canvas**: Add an optional WebGL/Three.js physical view showing the component positions overlaid on a 3D guitar body model with routing cavities visible. Connects to existing `PhysicalView` dual-view system.
- **Wire routing assistant**: Smart auto-routing algorithm (based on A* or force-directed routing) that suggests clean non-crossing wire paths between selected terminals.
- **Mobile / touch support**: Multi-touch drag, pinch-to-zoom, and touch-friendly inspector controls for tablet use.
- **Dark-mode audio spectrum overlay**: Live FFT spectrum analyzer overlay rendered on the fretboard canvas, coloring strings/frets by their harmonic energy in real time.

---

## 4. Engineering Priorities

### Sequencing (No shortcuts)

1. **Real WDF tree wiring** (1.1) — core signal path accuracy, everything else depends on it
2. **Tube waveshaper correction** (1.3) — needed before amp model differentiation makes sense
3. **Tab parsing + scheduler** (2.2, 2.3) — unlocks structured music playback
4. **Articulation engine** (2.5) — removes robotic character before adding UI features
5. **Alternate tunings + bass** (2.6, 2.7) — broadens instrument scope after single-guitar path is solid
6. **MIDI import/export** (3.2) — connects to the broader music production ecosystem
7. **OMR** (3.1) — treated as an independent sub-project, high complexity, not a blocker

---

## 5. Risks & Reality Check

| Risk | Likelihood | Mitigation |
|---|---|---|
| WDF worklet TypeScript bundling complexity (import resolution in AudioWorklet context) | Medium | Prototype with `type: 'module'` worklet in Chrome; fallback: manual Rollup bundle step |
| Real WDF tree is CPU-heavy for complex topologies at 44.1/48kHz | Medium | Profile on mid-range hardware early; keep the simplified `WdfPassiveCircuit` as a lightweight fallback mode |
| OMR model accuracy on low-quality scans | High | Scope Phase 1 strictly; set user expectations with a confidence score UI |
| SharedArrayBuffer COOP/COEP header conflicts with third-party assets | Medium | Test header requirements early in the dev server config; CDN assets may need CORS proxy |
| Rust WASM SIMD — browser compatibility (Safari 16.4+ only) | Low | Feature-detect via `WebAssembly.validate()` and fall back to scalar path automatically |
| Tab parsing edge cases (non-standard formatting, multi-column headers) | High | Invest in a large test fixture corpus before shipping; fail gracefully with a clear parse error message |

---

## 6. Guiding Principles

Build it like real hardware:

- **Signal path must be clear and modular** — every stage works independently before chaining
- **Each layer has one job** — graph engine doesn't know about audio, audio doesn't know about rendering
- **No shortcuts in timing or audio stability** — the AudioWorklet thread must never block
- **Test circuits against physical reality** — LTspice frequency-response comparisons are the ground truth for DSP accuracy
- **Prefer correct over fast; then optimize** — placeholder approximations are technical debt that compounds when features stack on top of them

If the audio engine isn't circuit-accurate, nothing else matters.