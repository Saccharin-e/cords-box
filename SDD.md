# Software Design Document (SDD)
## Advanced Guitar Crafting Sandbox

### 1. System Architecture

The sandbox will maintain a robust, three-tier decoupled architecture:

1.  **UI/Presentation Layer** — rendering, interaction, and drag-and-drop canvas featuring tactile-feeling workflows.
2.  **State Management Layer** — the unified netlist (graph); single source of truth for both UI and audio engine.
3.  **Audio DSP Layer** — translates current graph state into live filter/gain stages.

### 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript | Type safety for graph objects; modular components. |
| Canvas | Konva.js (react-konva) | Performant layered 2D rendering for the physical and schematic views. |
| Audio | Web Audio API + AudioWorklet, DSP core in C++ → WASM | Avoids JavaScript garbage collection pauses on the audio thread. |
| Testing | Vitest | Headless execution of truth-table fixtures. |
| State | Zustand or Redux | Single graph store, subscribed by both UI and audio layers. |

### 3. Data Schema — Circuit Graph

The schema expands upon the original circuit graph to include instrument tagging and visual properties for connections.

```json
{
  "instrument_family": "Guitar",
  "nodes": [
    {
      "id": "pickup_neck_hot",
      "type": "terminal",
      "componentId": "pickup_neck",
      "signalState": "active"
    },
    {
      "id": "switch_a_common",
      "type": "switch_lug",
      "componentId": "switch_4way",
      "role": "common_output"
    },
    {
      "id": "blend_pot_ref",
      "type": "potentiometer_lug",
      "componentId": "blend_pot",
      "connectedTo": "switch_a_common"
    }
  ],
  "edges": [
    {
      "id": "wire_1",
      "source": "pickup_neck_hot",
      "target": "phase_switch_in",
      "resistance": 0,
      "wireColor": "yellow",
      "connectionType": "solder",
      "wireType": "vintage_cloth_pushback"
    }
  ]
}