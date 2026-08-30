# Project Charter & Design — Advanced Guitar Crafting Sandbox

## 1. Objective

Build a sophisticated, web-based guitar-making sandbox, starting with an intuitive wiring simulator and real-time physical modeling synthesizer. The tool lets users assemble a guitar wiring circuit from real components, see the live signal path as a schematic, parse and play guitar tabs, and hear the result via a DSP-driven audio engine powered by Wave Digital Filters (WDF) and Digital Waveguide string synthesis. While initial development focuses on electric guitars, the underlying architecture is instrument-agnostic to support other stringed instruments (such as bass or ukulele) in future releases.

## 2. Enhanced User Experience (UI/UX)

* **Component Library:** Drag-and-drop library for pickups (single-coil, humbucker, P90), 3/4/5-way switches, push-pull/push-push pots, concentric pots, capacitors, resistors, and output jacks.
* **Dual-View Rendering:** Konva.js dual-view canvas keeping a physical guitar-body layout and a node-based electrical schematic in sync at all times.
* **Advanced Wiring & Connections:** Wire selection with customizable colors, wire types (e.g. vintage cloth push-back, modern vinyl, varying gauges), and connection methods (soldered joints vs quick-connect terminals).
* **Real-Time Interactivity & Playable Fretboard:** Instant graph solving on every switch or pot interaction, paired with an interactive on-screen fretboard for plucking notes and auditioning strummed chords.
* **CAD Canvas & Layout Slots:** Grid snapping, customizable theme choices, space-reclaiming retractable toolbars, layout slot persistence, and high-DPI PNG / vector PDF region export.
* **Guitar Tablature & MIDI Support:** In-browser ASCII tab parser, time-accurate lookahead playback scheduler, MIDI import/export, and live Web MIDI hardware controller support.

## 3. Scope & Accomplishments (Delivered Foundation)

* **Guitar Topology Simulation:** Complete graph solver supporting arbitrary component connections, editable capacitor µF/pF, resistor Ω, and potentiometer kΩ values + tapers.
* **WDF AudioWorklet Engine:** Off-thread Web Audio API processor (`guitar-processor` in `src/audio/processor.js`) running real-time wave-digital circuit solves and per-amp passive tone stacks (Fender, Marshall, Mesa, Vox) with live parameter sync (`'wdf-update'`).
* **Digital Waveguide Physical Modeling Core:** Rust WebAssembly physical modeling engine (`dsp/src/lib.rs`) featuring dual H/V polarization delay lines, Fletcher inharmonicity dispersion allpass, fundamental-gain compensated loop filter, per-string persistent PRNG excitation, `bend()`/`damp()` APIs, and sympathetic string coupling.
* **Tab & MIDI Music Engine:** Headless plain-text ASCII tab parser, lookahead Web Audio scheduler with multi-articulation handling (hammer, pull, slide, bend, release, vibrato), and Web MIDI I/O.
* **Hybrid Sound Generator:** Physical modeling string synthesis paired with CC0 Black & Green Guitars DI sample bank playback.
* **Instrument Agnostic Schemas:** Data schemas enforce an `instrument_family` tag (e.g. `"Guitar"`), allowing seamless future extension to bass guitars or custom instruments.

## 4. System Architecture

The sandbox maintains a three-tier decoupled architecture:

* **Frontend & Rendering:** React 19 + TypeScript + Konva.js (`react-konva`) for performant layered 2D rendering.
* **Audio Performance:** Audio processing runs in an `AudioWorklet` with Rust WebAssembly DSP core to avoid main-thread garbage collection pauses.
* **Expanded Data Schema:** Circuit graph manages nodes, edges, and visual metadata (wire colors, solder types, gauge).

## 5. Validation & Quality Assurance

* **State Validator (Linter):** Automated linter flagging dead shorts to ground, open circuits, and same-pole jumper chains.
* **Truth-Table Export:** Exportable connectivity truth tables for any switch/pot configuration to cross-check against reference diagrams.
* **Automated Test Coverage:** 100% passing Vitest test suite (19 test files, 90 tests) covering graph solving, WDF adaptors, tone stacks, worklet parity, lint rules, preset libraries, tab parser, MIDI, slot storage, audio pipeline, and UI fretboard components.
