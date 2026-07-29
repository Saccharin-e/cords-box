# Software Requirements Specification (SRS)
## Advanced Guitar Crafting Sandbox

### 1. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Component library: drag-and-drop pickups, 3/4/5-way switches, push-pull/push-push pots, concentric pots, capacitors, resistors, and output jacks. Users must also be able to select specific wire types (e.g., vintage cloth push-back, modern vinyl, varying gauges) and connection methods (e.g., soldered joints vs. quick-connect terminals). |
| FR-2 | Dual-view rendering: physical guitar-body layout + node-based electrical schematic, kept in sync. |
| FR-3 | Real-time graph solving: recompute the active signal path on every switch or pot interaction, providing real-time graph solving without requiring a manual "simulate" step. |
| FR-4 | Audio processing: accept a DI sample or mic input, and apply EQ, phase-inversion, and filtering strictly derived from the current graph state. |
| FR-5 | State validation (linter): flag dead shorts to ground, open circuits, and specifically same-pole jumper chains that transitively tie two "isolated" positions together. |
| FR-6 | Editable component values: capacitor (pF/µF), resistor (Ω), and potentiometer (kΩ plus taper). Changes must propagate to both the schematic and the audio engine immediately. |
| FR-7 | Truth-table export: output the resolved connectivity as a human-readable truth-table for any given switch/pot configuration, allowing users to cross-check their work against hand-derived or manufacturer reference diagrams. |

### 2. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-1 | Extensibility: Data schemas must be abstracted so that the root object requires an `instrument_family` tag (e.g., "Guitar") to ensure the database and UI can effortlessly adapt to bass guitars, mandolins, or other instruments in later versions without rewriting the core logic. |
| NFR-2 | Audio round-trip latency < 20ms; no thermal throttling or UI stutter on mid-range ultrabook-class hardware. |
| NFR-3 | Verified on Chrome + Firefox; Linux (Wayland/KDE Plasma), Windows, and macOS. |
| NFR-4 | Circuit-solving logic fully decoupled from UI rendering — must run headless for CI testing. |
| NFR-5 | Every shipped default preset must pass the FR-5 linter with zero flags before merge. |

### 3. Reference Circuit — Validation Dataset

This is the specific, hand-verified circuit the FR-5/FR-7 test suite should be built against first. 

**Components:**
*   2 single-coil pickups (neck, bridge)
*   1 push-pull DPDT phase-reversal switch (neck only) + 470pF/1kV treble-bleed cap
*   1 volume pot (250K–500K range)
*   1 concentric tone+blend pot: tone side (500K linear + 470K resistor across outer lugs, paired with a 0.022–0.033µF cap), blend side (500K linear, tapped from the 4-way switch's *common* — not a raw position lug)
*   1 two-pole 4-way switch (10 lugs: common + 4 positions × 2 poles)
*   1 output jack

**Required truth table** (positions 1–4, both phase states):
*   **Position 1:** Single pickup A. Must be fully isolated — zero leakage from pickup B.
*   **Position 2:** A + B, parallel. Combined only via both poles reaching a shared node outside the switch, never via a same-pole jumper between A's and B's dedicated lugs.
*   **Position 3:** Single pickup B. Fully isolated from A.
*   **Position 4:** A + B, series. One pickup's ground redirected to the other's hot at one specific lug pair only.