# Future Implementation Roadmap
## Cords Box — Browser-Based Guitar Circuit, DSP & Tab Simulator

---

## 0. Current State (Baseline — August 2026)

The project has shipped a production-quality foundation across all architectural tiers, backed by 90 passing Vitest tests across 19 test files:

### UI / Canvas Layer ✅
- Dual-view synchronized canvas: **physical guitar body layout + node-based schematic** (`DualCanvas`, `PhysicalView`, `SchematicView`)
- Component library with drag-and-drop: single-coil, humbucker, P90 pickups; 3/4/5-way & DPDT switches; concentric/push-pull/blend pots; capacitors, resistors, output jacks, shape tools, project cards
- Drag-to-wire canvas interaction with wire layer overlay (`WireLayer`, `wireUtils`)
- Configurable canvas themes (dark/light), snap-to-grid, viewport CAD controls
- Retractable toolbars with full space reclaiming and smooth transitions
- Interactive playable fretboard panel (`PlayableFretboardPanel`)
- Amp/pedalboard control panel (`AmpPedalboardPanel`)
- High-DPI PNG & PDF region export (`ExportBoxOverlay`, `jspdf`)
- Layout slot persistence (save/recall 9 slots, `slotStore`)
- Customizable keyboard shortcuts (`keybindingsStore`)

### State Management Layer ✅
- Zustand stores: `circuitStore`, `canvasStore`, `slotStore`, `keybindingsStore`, `useAudioStore`
- Full Zod schema validation (`types.ts`): `CircuitGraph`, `CircuitNode`, `CircuitEdge`, `Component`, `SwitchState`
- `instrument_family` tag (Guitar, Bass, Mandolin, Ukulele, Other) for future multi-instrument extensibility (NFR-1)
- Headless Graph engine (`Graph.ts`, `solver.ts`) with netlist traversal, path-finding, switch state resolution, and potentiometer taper curves

### Audio DSP Layer ✅
- **Digital Waveguide Physical Modeling Engine (Rust / WASM)**: Dual H/V polarization delay lines, cascaded dispersion allpass filter with Fletcher inharmonicity, fundamental-gain compensation loop filter, per-string persistent PRNG noise excitation, and `bend()` / `damp()` control APIs (`dsp/src/lib.rs`). Shared-bridge sympathetic coupling remains future work.
- **Wave Digital Filter (WDF) AudioWorklet**: Off-thread per-sample circuit solver (`src/audio/processor.js`, `src/audio/wdf/wdfNodes.ts`, `wdfCircuitSolver.ts`) running real adaptor trees for pickup R/L/C, volume/tone networks, and per-amp-model passive tone stacks (Fender, Marshall, Mesa, Vox topologies) with makeup gain and live parameter sync via `'wdf-update'`.
- **Hybrid Sound Engine**: Physical modeling string synthesis paired with CC0 Black & Green Guitars DI sample bank (48kHz 24-bit, `sampleBank.ts`).
- **Guitar Tablature Engine**: Headless ASCII tab parser (`tabParser.ts`), time-accurate lookahead playback scheduler (`tabScheduler.ts`), and articulation handling (hammer-on, pull-off, slide, bend, release, vibrato, palm-mute).
- **MIDI Integration**: MIDI file parser (`midiParser.ts`), MIDI Type 1 file exporter (`midiExporter.ts`), and live Web MIDI controller input manager (`webMidiManager.ts`).
- **Amp & FX Pipeline**: Tube preamp chain with 3 cascaded waveshaper stages (`preampTube`, `secondTube`, `powerAmpTube`), pedal chain (compressor, overdrive/distortion, chorus, delay), modal-resonance cabinet IRs (`1x12_open`, `2x12_tweed`, `4x12_stack`, `4x12_metal`), and room ambience IR.
- **Polyphony Protection**: Power-normalized gain floor (`0.3 / Math.sqrt(chordSize)`) preventing clipping during multi-note chords.

### Circuit Validation Layer ✅
- Linter: dead shorts to ground, open circuits, same-pole DPDT jumper chains (`linter.ts`)
- Truth-table export (`truthTable.ts`)
- Preset library: Stratocaster HSS, Indie-Rock Telecaster, 50s Telecaster, Les Paul, 4-way series/parallel, phase reversal.
- Automated tests: 19 test files (90 tests passing) across audio, DSP worklet parity, graph solver, presets, linter, tab, MIDI, and UI components.

---

## 1. Short-Term — DSP Precision & Tab Engine Refinement
> **Target:** v1.1 – v1.3 | Reconciled against [docs/DSP_SPEC.md](DSP_SPEC.md) Task Matrix.

### 1.1 Fractional Delay Precision — Completed
- **Current state**: `dsp/src/lib.rs` uses first-order Lagrange/Farrow fractional-delay interpolation with circular-buffer wrapping. `wasmProduction.test.ts` verifies production-WASM pitch accuracy; this is not a Thiran allpass implementation.
- **Remaining follow-up**: Add a standalone swept magnitude/flatness test if the interpolation order or topology changes.

### 1.2 Tab Scheduler Damping & Articulation — Completed
- **Current state**: `tabScheduler.ts` issues smooth `damp()` events for release, rests, and mutes; `tabParser.ts` accepts fret 0 as a hammer/pull/slide target and supports pinch-harmonic notation and damping.

### 1.3 Whammy Bar / Global Pitch Modulation
- **Current state**: The Rust engine exports `set_whammy(semitones)` and the AudioWorklet accepts the corresponding `whammy` message, applying the bend across active strings.
- **Remaining task**: Connect whammy modulation to a UI control and MIDI pitch wheel events in `webMidiManager.ts`.

### 1.4 WDF Topology Invariant Assertions & Non-Linear Pickup Stage
- **Current state**: The pickup RLC solve and its current output path are linear; adaptor port resistances must strictly match their children. Tube and pedal saturation downstream do not substitute for a magnetic pickup-response model.
- **Tasks**:
  - Add debug-mode invariant checks ensuring `WdfSeriesAdaptor` / `WdfParallelAdaptor` port resistances never drift.
  - Add an optional post-solve polynomial magnetic-saturation stage without placing nonlinearity inside the passive adaptor tree.

---

## 2. Mid-Term — Instrument Breadth & Interactivity
> **Target:** v1.4 – v2.0 | Expanding musical capabilities and UI workflow.

### 2.1 Alternate Tunings & Dynamic String Frequencies
- **Tasks**:
  - Define `TuningPreset` records: Standard E, Drop D, DADGAD, Open G, Open D, Open E, Eb Standard, Half-Step Down.
  - Move string base frequencies from static constants to store-driven values in `circuitStore` / `instrumentStore`.
  - Update `PlayableFretboardPanel` and `TabScheduler` to dynamically calculate fret pitches based on the active tuning.

### 2.2 Bass Guitar & Multi-Instrument Support
- **Tasks**:
  - Add Bass components to library: split-coil (P-Bass), dual single-coil (J-Bass), humbucker (Music Man style).
  - Add bass string tunings: B0 (5-string), E1, A1, D2, G2.
  - Add dedicated bass cabinet IRs (1x15, 4x10 profiles) in `pipeline.ts`.
  - Ship standard bass wiring presets (P-Bass volume/tone, J-Bass V/V/T, active preamp boost).

### 2.3 Interactive Tab Score UI Panel
- **Tasks**:
  - Integrate a dedicated Tab Player panel with ASCII tab paste, timeline scrolling, tempo controls, and loop toggles.
  - Connect parsed `TabScore` playback with real-time fretboard note highlight visualization.

### 2.4 Complex Circuit Topology Expansion
- **Tasks**:
  - Implement WDF R-type (scattering) adaptors for multi-branch junctions.
  - Model treble-bleed circuits (resistor + cap in parallel with volume pot) and blend-pot cross-fading directly within the WDF netlist.

---

## 3. Long-Term — Intelligence, Sharing & Platform Scale
> **Target:** v2.0+ | Advanced tools, sharing, and deep platform capabilities.

### 3.1 Optical Music Recognition (OMR: Image → Tab)
- **Goal**: Automated tab extraction from photos or scanned sheet music.
- **Architecture**:
  - **Phase 1**: CNN symbol detector (MobileNet/EfficientNet) running client-side via ONNX Runtime Web + WebGPU.
  - **Phase 2**: Beam-search sequence decoder mapping detected symbols to string/fret coordinates.
  - **Phase 3**: Offline PWA caching with IndexedDB model storage.

### 3.2 Preset Sharing, Cloud Sync & E-Commerce Bill of Materials (BOM)
- **Tasks**:
  - **URL Hash Sharing**: Compact base64 serialization of `CircuitGraph` + `CanvasStore` for instant link sharing without backend dependencies.
  - **File Format**: Standardized `.cordsbox` JSON envelope for project import/export.
  - **Interactive BOM Drawer**: Automatic Bill of Materials generator with affiliate links (Sweetwater, StewMac, Thomann) for 1-click component ordering.
  - **Cloud Sync**: Optional user profiles with cloud layout persistence via lightweight backend.

### 3.3 Hexaphonic Pickup Simulation & 3D Cavity Visualization
- **Tasks**:
  - **Hexaphonic routing**: 6-channel isolated string processing for polyphonic guitar synths (Roland GK / Fishman TriplePlay).
  - **3D Canvas**: Optional Three.js physical view showing components inside a 3D guitar cavity with smart non-crossing wire auto-routing.

---

## 4. Prioritized Task Matrix (Sync with DSP_SPEC.md)

| Priority | Task | Location | Status |
|---|---|---|---|
| P0 | Cascaded dispersion allpass (Fletcher inharmonicity) | `dsp/src/lib.rs` | ✅ Shipped |
| P0 | Fundamental-gain compensated loop filter | `dsp/src/lib.rs` | ✅ Shipped |
| P0 | WDF passive circuit & tone stack solver in AudioWorklet | `src/audio/processor.js` | ✅ Shipped |
| P0 | Guitar Tab parser & lookahead scheduler | `src/audio/tab/` | ✅ Shipped |
| P0 | Web MIDI manager, parser, and exporter | `src/audio/midi/` | ✅ Shipped |
| P1 | Fractional-delay interpolation (first-order Lagrange/Farrow) | `dsp/src/lib.rs` | ✅ Shipped |
| P1 | Tab scheduler damping, fret 0 targets, and pinch harmonics | `src/audio/tab/` | ✅ Shipped |
| P1 | Whammy/global bridge pitch-bend engine and worklet API | `dsp/src/lib.rs`, `src/audio/processor.js` | ✅ Shipped |
| P1 | **Whammy UI and MIDI pitch-wheel control** | `src/ui/`, `src/audio/midi/` | 🔲 Open |
| P2 | **Alternate tunings & Bass instrument family presets** | `src/store/`, `src/ui/` | 🔲 Open |
| P2 | **Sympathetic string coupling through a shared bridge term** | `dsp/src/lib.rs` | 🔲 Open |
| P2 | **Non-linear pickup response (polynomial saturation stage)** | `src/audio/wdf/` | 🔲 Open |
| P2 | **JS fallback parity with WASM articulation and whammy behavior** | `src/audio/karplusStrong.ts` | 🔲 Open |
| P2 | **External six-channel hexaphonic routing** | `src/audio/processor.js`, `src/audio/pipeline.ts` | 🔲 Open |
| P3 | **OMR (Optical Tab Recognition) WebGPU inference** | `src/omr/` | 🔲 Planned |
| P3 | **Interactive BOM & 1-click affiliate cart generator** | `src/ui/` | 🔲 Planned |

---

## 5. Guiding Principles & Verification Rules

- **Circuit-Accurate Ground Truth**: Verify WDF stage responses against LTspice netlist simulations and measured RMS transfer levels.
- **Real-Time Worklet Invariants**: Zero heap allocations, zero console logs, and strictly reflection-free WDF adaptors during `process()`.
- **Decoupled Headless Engine**: Core graph, linter, tab parser, and DSP models must run 100% headless under Vitest with zero DOM or UI dependencies.
- **Physical Pluck Realism**: Preserve per-string persistent PRNG excitation state and smooth `damp()` release curves without sample-to-zero stepping.
