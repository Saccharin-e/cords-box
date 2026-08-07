# Software Design Document (SDD)
## Advanced Guitar Crafting Sandbox

### 1. System Architecture

The sandbox maintains a robust, decoupled three-tier architecture:

1. **UI / Presentation Layer** — React 19 + TypeScript application utilizing Konva.js (`react-konva`) for high-performance 2D rendering. Provides dual physical body layout and electrical schematic canvas views, space-reclaiming retractable toolbars, interactive playable fretboard, component inspector, and custom PDF/PNG crop region export.
2. **State Management Layer** — Single source of truth netlist (circuit graph) managed via Zustand stores (`useCircuitStore`, `useSlotStore`, `useAudioStore`). Graph solver logic remains pure and headless to support decoupled testing and rendering.
3. **Audio DSP Layer** — Web Audio API audio graph integrated with a dedicated `AudioWorkletNode` (`guitar-processor` running in `src/audio/processor.js`). Calculates sample-by-sample Wave Digital Filter (WDF) netlist parameters, paired with Karplus-Strong string synthesis, CC0 DI guitar sample bank playback, tube amp waveshaping curves, cabinet IR convolution, and room ambience.

### 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 19 + TypeScript 6 | Type safety for graph nodes/edges, modular component architecture, strict linting via Oxlint. |
| Canvas Rendering | Konva.js (`react-konva`) | Layered 2D canvas rendering with 60FPS optimizations (`React.memo`, `perfectDraw={false}`, cached wire paths). |
| Audio DSP Core | Web Audio API + AudioWorklet + Rust WebAssembly | `AudioWorkletNode` running off-thread per-sample WDF solver; Rust WASM core for heavy physical modeling calculations without main-thread GC pauses. |
| State Management | Zustand | Lightweight atomic store subscriptions shared between canvas UI, inspector, audio pipeline, and layout slot persistence. |
| Circuit Validation | Custom Linter + Zod | Schema validation and graph connectivity verification (shorts, open circuits, same-pole jumper conflicts, truth-table generation). |
| Testing | Vitest | Fast headless execution of graph, solver, audio, lint, store, and UI component test suites. |

### 3. Data Schema — Circuit Graph

The circuit graph schema abstracts components, nodes, and edges while enforcing `instrument_family` tagging for multi-instrument extensibility.

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
      "id": "volume_pot_wiper",
      "type": "potentiometer_lug",
      "componentId": "volume_pot",
      "role": "wiper"
    }
  ],
  "edges": [
    {
      "id": "wire_1",
      "source": "pickup_neck_hot",
      "target": "switch_a_pos1",
      "resistance": 0,
      "wireColor": "#e74c3c",
      "connectionType": "solder",
      "wireType": "vintage_cloth_pushback"
    }
  ]
}
```

### 4. Audio Pipeline & WDF Integration

```
Synthesized String (Karplus-Strong) ─┐
                                    ├─► WDF AudioWorkletNode ─► Tube Preamp ─► Cabinet IR ─► Room IR ─► Output
Recorded DI Samples (SampleBank)    ─┘   ('guitar-processor')    Waveshapers     Convolution   Reverb
```

- **WDF Parameter Extraction**: On topology updates or pot changes, `extractWorkletParams()` calculates solved pickup resistance, inductance, tone capacitance, cable capacitance, and volume/tone wiper positions, posting parameters live via `wdfNode.port.postMessage({ type: 'wdf-update', params })`.
- **Race Condition Guarding**: `AudioEngine` maintains a subscriber notification system that dynamically instantiates and splices `wdfWorkletNode` into active signal chains as soon as the worklet module script finishes loading.
- **Polyphony Protection**: Polyphonic sample playback utilizes a dynamic chord-aware gain floor (`0.3 / Math.sqrt(chordSize)`) preventing peak clipping during multi-note strums.