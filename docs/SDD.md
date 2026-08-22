# Software Design Document (SDD)
## Cords Box — Advanced Guitar Crafting Sandbox & Physical Modeling Engine

### 1. System Architecture

The application maintains a decoupled, high-performance three-tier architecture:

1. **UI / Presentation Layer** — React 19 + TypeScript application utilizing Konva.js (`react-konva`) for 60FPS 2D canvas rendering. Provides synchronized physical guitar-body and electrical schematic views, space-reclaiming retractable toolbars, interactive playable fretboard, tab score player, component inspector, and vector PDF/PNG region export.
2. **State Management Layer** — Single source of truth netlist (circuit graph) managed via Zustand stores (`useCircuitStore`, `useSlotStore`, `useAudioStore`, `useKeybindingsStore`). All graph solving, netlist path-finding, and switch resolution logic remain pure and headless to ensure decoupled testing and rendering.
3. **Audio DSP Layer** — Web Audio API graph integrated with a dedicated `AudioWorkletNode` (`guitar-processor` running in `src/audio/processor.js`) and a Rust WebAssembly physical modeling engine (`dsp/src/lib.rs`). Runs real-time sample-by-sample Wave Digital Filter (WDF) passive circuit and tone-stack calculations, digital waveguide string synthesis with dispersion allpass and fundamental-gain compensation, DI sample playback, tube preamp waveshaping, modal-resonance cabinet IR convolution, ASCII tab scheduling, and Web MIDI I/O.

### 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend Framework | React 19 + TypeScript 6 | Strict type safety for graph nodes/edges, modular component architecture, Oxlint + Prettier enforcement. |
| Canvas Rendering | Konva.js (`react-konva`) | Layered 2D canvas rendering with 60FPS optimizations (`React.memo`, `perfectDraw={false}`, cached wire paths). |
| Physical Modeling Core | Rust (edition 2021) + WASM | Low-latency digital waveguide string synthesis (dual H/V planes, Fletcher inharmonicity, fundamental-gain compensation, sympathetic coupling, bend/damp API). |
| Circuit DSP Engine | Web Audio API + AudioWorklet (WDF) | Off-thread per-sample Wave Digital Filter (WDF) passive circuit solver and per-amp tone stack (Fender, Marshall, Mesa, Vox topologies) with makeup gain. |
| Tablature & MIDI | Headless TS Modules (`src/audio/tab/`, `src/audio/midi/`) | Plain-text ASCII tab parser, sample-accurate lookahead scheduler, MIDI file import/export, and live Web MIDI controller input. |
| State Management | Zustand | Lightweight atomic store subscriptions shared between canvas UI, inspector, audio pipeline, and layout slot persistence. |
| Circuit Validation | Custom Linter + Zod | Schema validation and graph connectivity verification (dead shorts, open circuits, same-pole jumper conflicts, truth-table generation). |
| Testing & Verification | Vitest | 19 test files (90 unit tests) covering graph solving, WDF nodes, tone stacks, worklet parity, tab parsing, MIDI, and UI components. |

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

### 4. Audio Pipeline & DSP Architecture

```
[ Tab Scheduler / MIDI / Fretboard UI ]
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│  Rust WebAssembly Core (dsp/src/lib.rs)                     │
│  - Per-string persistent PRNG excitation noise              │
│  - Dual H/V polarization digital waveguide                  │
│  - Cascaded dispersion allpass (Fletcher inharmonicity)     │
│  - Fundamental-gain compensated loop filter                 │
│  - Sympathetic string coupling via shared bridge term       │
│  - Real-time bend() glide and smooth damp() release         │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │ (Synthesized DWG output)
            ▼                                     ▼
┌─────────────────────────────────────────────────────────────┐
│  WDF AudioWorklet ('guitar-processor')                      │
│  - Dynamic pickup-position comb filtering                   │
│  - WDF passive circuit solver (pickup RLC, volume/tone pots)│
│  - WDF per-model tone stack (Fender, Marshall, Mesa, Vox)   │
│  - Model-specific makeup gain compensation                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Post-Processing FX Pipeline (src/audio/pipeline.ts)        │
│  - 3-stage asymmetric tube preamp waveshapers               │
│  - Pedalboard FX (compressor, overdrive, chorus, delay)     │
│  - Modal-resonance cabinet IR convolution                   │
│  - Stereo room ambience IR convolution                      │
│  - Master gain & polyphonic chord-aware gain limiter        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
                        [ Audio Output ]
```

- **WDF Parameter Extraction**: On topology updates or pot changes, `extractWorkletParams()` calculates solved pickup resistance, inductance, tone capacitance, cable capacitance, and volume/tone wiper positions, posting parameters live via `wdfNode.port.postMessage({ type: 'wdf-update', params })`.
- **WDF Adaptor Invariant**: Series and parallel adaptors compute port resistances dynamically, maintaining reflection-free boundary conditions ($|R| + |T| \le 1$).
- **Dynamic Worklet Splicing**: `AudioEngine` maintains a reactive state subscriber system that dynamically instantiates and splices `wdfWorkletNode` into active signal chains as soon as the worklet module script finishes loading.
- **Polyphony Protection**: Multi-note sample and waveguide rendering utilizes a dynamic chord-aware gain floor (`0.3 / Math.sqrt(chordSize)`) preventing peak clipping during polyphonic strums.
- **Detailed DSP Specs**: For exact physical modeling equations, allpass dispersion filters, and WDF adaptor schemas, see [docs/DSP_SPEC.md](DSP_SPEC.md).