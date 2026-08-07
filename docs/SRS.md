# Software Requirements Specification (SRS)
## Advanced Guitar Crafting Sandbox

### 1. Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| FR-1 | Component library: drag-and-drop pickups (single-coil, humbucker), 3/4/5-way switches, push-pull/push-push pots, concentric pots, capacitors, resistors, and output jacks. Selectable wire colors, gauges, and connection methods (soldered vs quick-connect). | Implemented |
| FR-2 | Dual-view rendering: synchronized physical guitar-body layout + node-based electrical schematic canvas. | Implemented |
| FR-3 | Real-time graph solving: automatic netlist solver recomputes active signal path and topology state on every switch/pot interaction without manual simulation steps. | Implemented |
| FR-4 | Audio processing: accept recorded DI guitar sample bank or synthesized Karplus-Strong string input, applying WDF circuit filtering, tube saturation, cabinet IR, and room ambience derived from graph state. | Implemented |
| FR-5 | State validation (linter): flag dead shorts to ground, open circuits, and same-pole jumper chains that transitively tie isolated switch positions together. | Implemented |
| FR-6 | Editable component values: capacitor (pF/µF), resistor (Ω), pickup resistance/inductance, and potentiometer (kΩ plus linear/log taper). Real-time propagation to audio worklet engine. | Implemented |
| FR-7 | Truth-table export: output resolved connectivity matrix and truth tables for all switch positions as human-readable documents or JSON/PDF export. | Implemented |
| FR-8 | Interactive Playable Fretboard: multi-string interactive fretboard UI allowing manual note plucking, chord strumming, speed control, and pitch-shifted audio playback. | Implemented |
| FR-9 | Saveable Layout Slots: persistent local storage slots for saving and recalling canvas positions, component configurations, and custom wire routing. | Implemented |
| FR-10 | High-Resolution Canvas Export: export physical layout and schematic views to high-DPI PNG or vector PDF with custom canvas crop region selection indicators. | Implemented |
| FR-11 | CAD Viewport Controls: snap-to-grid alignment, grid background rendering, space-reclaiming retractable toolbars, dark/light canvas themes, and customizable keyboard shortcuts. | Implemented |
| FR-12 | Rust WebAssembly DSP Core: optional WASM-compiled physical modeling engine for low-latency string vibration calculations. | Implemented |

### 2. Non-Functional Requirements

| ID | Requirement | Status |
|---|---|---|
| NFR-1 | Extensibility: Data schemas require an `instrument_family` tag (e.g. "Guitar") allowing seamless future adaptation to bass guitars, mandolins, or synth wiring without core rewrites. | Verified |
| NFR-2 | Audio performance: Audio round-trip latency < 20ms with zero main-thread GC stutter by utilizing off-thread `AudioWorkletNode` execution. | Verified |
| NFR-3 | Browser & OS compatibility: Fully verified on modern Chrome and Firefox across Linux, Windows, and macOS. | Verified |
| NFR-4 | Headless graph decoupling: Circuit graph engine and linter are completely decoupled from React DOM / Konva canvas, running headlessly in Vitest. | Verified (10/10 test files passing) |
| NFR-5 | Preset validation: Every shipped default preset (Stratocaster, Telecaster, Les Paul, 4-Way Series/Parallel, Phase Mod) passes the FR-5 linter with zero errors. | Verified |

### 3. Reference Circuit — Validation Dataset

Hand-verified reference circuit implemented in `tests/graph/solver.test.ts` and `tests/lint/linter.test.ts`:

**Components:**
* 2 single-coil pickups (neck, bridge)
* 1 push-pull DPDT phase-reversal switch (neck only) + 470pF/1kV treble-bleed cap
* 1 volume pot (250K–500K range)
* 1 concentric tone+blend pot: tone side (500K linear + 470K resistor across outer lugs, paired with a 0.022–0.033µF cap), blend side (500K linear, tapped from the 4-way switch's *common*)
* 1 two-pole 4-way switch (10 lugs: common + 4 positions × 2 poles)
* 1 output jack

**Required truth table** (positions 1–4, both phase states):
* **Position 1:** Single pickup A. Fully isolated — zero leakage from pickup B.
* **Position 2:** A + B, parallel. Combined only via both poles reaching a shared node outside the switch.
* **Position 3:** Single pickup B. Fully isolated from A.
* **Position 4:** A + B, series. One pickup's ground redirected to the other's hot at one specific lug pair only.