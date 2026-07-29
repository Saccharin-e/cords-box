# Project Charter & Design — Advanced Guitar Crafting Sandbox

## 1. Objective

Build a sophisticated, web-based guitar-making sandbox, starting with an intuitive wiring simulator. The tool will let a user assemble a guitar wiring circuit from real components, see the live signal path as a schematic, and hear the result via a DSP-driven audio engine. While the initial build will focus exclusively on guitars, the underlying architecture will be modular to support sandboxing other stringed instruments (like bass or ukulele) in future updates.

## 2. Enhanced User Experience (UI/UX)

To ensure the sandbox is highly intuitive and user-friendly, the interface will prioritize visual feedback and tactile-feeling workflows:

*   **Component Library:** The UI will feature a drag-and-drop library for pickups, 3/4/5-way switches, push-pull/push-push pots, concentric pots, capacitors, resistors, and output jacks.
*   **Dual-View Rendering:** The canvas will utilize a dual-view system to keep a physical guitar-body layout and a node-based electrical schematic in sync at all times.
*   **Advanced Wiring & Connections:** Users will be able to select specific wire types (e.g., vintage cloth push-back, modern vinyl, varying gauges) and connection methods (e.g., soldered joints vs. quick-connect terminals). These will act as visual cues to help users map their physical builds.
*   **Real-Time Interactivity:** The system will recompute the active signal path on every switch or pot interaction, providing real-time graph solving without requiring a manual "simulate" step.

## 3. Scope & Extensibility

The scope maintains the core functionality of the original wiring simulator while structuring the database for future growth.

*   **In-Scope (v1 - Guitar Focus):** The application will feature single-guitar-topology simulation with editable component values for capacitor µF/pF, resistor Ω, and potentiometer kΩ plus taper. Changes will propagate to both the schematic and the audio engine immediately.
*   **Future Scope (Instrument Agnostic):** Data schemas will be abstracted so that the root object requires an `instrument_family` tag (e.g., "Guitar"). This ensures the database and UI can effortlessly adapt to bass guitars, mandolins, or other instruments in later versions without rewriting the core logic.
*   **Audio Engine:** The audio processing will accept a DI sample or mic input and apply EQ, phase-inversion, and filtering strictly derived from the current graph state.

## 4. System Architecture

The sandbox will maintain a robust, three-tier decoupled architecture: a UI/Presentation Layer, a State Management Layer, and an Audio DSP Layer.

*   **Frontend & Rendering:** The application will use React and TypeScript for type safety, alongside Konva.js for performant layered 2D rendering of the physical and schematic views.
*   **Audio Performance:** To avoid JavaScript garbage collection pauses on the audio thread, the DSP core will be written in C++ and compiled to WebAssembly (WASM), interfacing with the Web Audio API.
*   **Expanded Data Schema:** The data schema for the circuit graph will manage nodes and edges. To support the enhanced user flow, the `edges` schema will be expanded to include visual properties (e.g., `"wireColor": "yellow"`, `"connectionType": "solder"`).

## 5. Validation & Quality Assurance

To prevent frustrating real-world build errors, the sandbox will include robust automated validation.

*   **State Validator (Linter):** The system will feature a linter to flag dead shorts to ground, open circuits, and specifically same-pole jumper chains that transitively tie two "isolated" positions together.
*   **Truth-Table Export:** Users will be able to export the resolved connectivity as a human-readable truth-table for any given switch/pot configuration, allowing them to cross-check their work against hand-derived or manufacturer reference diagrams.