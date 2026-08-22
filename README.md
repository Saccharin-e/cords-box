# Cords Box — Advanced Guitar Crafting Sandbox & Physical Modeling Engine

A sophisticated, web-based guitar wiring simulator, digital waveguide synthesizer, and tab player. Assemble guitar wiring circuits from real components (pickups, switches, potentiometers, capacitors, resistors, output jacks), visualize synchronized physical and schematic canvas views, parse and play guitar tabs, and experience the live signal path via a real-time DSP audio engine powered by Wave Digital Filters (WDF) and Rust/WASM Digital Waveguide physical modeling.

## Features

- **Dual-View Synchronized Canvas**: Real-time physical guitar layout and schematic view powered by Konva.js with 60FPS rendering optimizations.
- **Digital Waveguide Physical Modeling Engine**: Rust WebAssembly engine with dual H/V polarization delay lines, Fletcher inharmonicity dispersion allpass filters, fundamental-gain compensation, per-string persistent PRNG excitation, `bend()`/`damp()` control APIs, and sympathetic string coupling.
- **Wave Digital Filter (WDF) Audio Worklet**: Live audio processing thread running custom WDF netlist solvers for passive guitar circuits and per-amp-model passive tone stacks (Fender, Marshall, Mesa, Vox topologies) with makeup gain.
- **Guitar Tablature & Lookahead Scheduler**: Headless ASCII tab parser (`tabParser.ts`) supporting hammer-on, pull-off, slide, bend, release, vibrato, and palm-mute articulations, paired with a sample-accurate lookahead Web Audio scheduler (`tabScheduler.ts`).
- **MIDI Integration**: Standard MIDI file import/export and live Web MIDI hardware controller support.
- **Interactive Playable Fretboard**: On-screen playable fretboard for instant sound triggering and polyphonic strumming.
- **Circuit Linter & Truth-Table Export**: Automated circuit validation flagging dead shorts, open connections, and same-pole jumper conflicts, with exportable truth tables.
- **CAD Canvas & Export Tools**: Snap-to-grid, customizable canvas themes, space-reclaiming retractable toolbars, and high-resolution PNG & PDF export with custom crop region selection.
- **Layout Slot Saving**: Save and restore custom canvas layouts instantly.
- **Preset Library**: Shipped with classic and custom guitar wiring presets (Stratocaster HSS, Indie-Rock Telecaster, 50s Telecaster, Les Paul, 4-way series/parallel mods, phase reversal).

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check and build production bundle |
| `npm run test` | Run headless Vitest test suite |
| `npm run test:watch` | Run tests in interactive watch mode |
| `npm run lint` | Lint source files with Oxlint |
| `npm run format` | Format source files with Prettier |
| `npm run typecheck` | Type-check without emitting |
| `npm run build:wasm` | Compile Rust DSP core to WebAssembly via wasm-pack |

## Architecture

Three-tier decoupled architecture:

1. **UI / Presentation Layer** — React 19 + TypeScript + Konva.js for performant 2D physical & schematic canvas rendering, CAD toolbars, tab player, and interactive fretboard.
2. **State Management Layer** — Zustand stores as the single source of truth for circuit graph state, layout slots, preset selections, and UI preferences.
3. **Audio DSP Layer** — Web Audio API + dedicated AudioWorklet (`guitar-processor`) running real-time WDF circuit solves, per-model WDF tone stacks, tube preamp waveshaping, modal cabinet impulse responses, tab scheduler, and Rust WebAssembly digital waveguide physical modeling.

See [docs/SDD.md](docs/SDD.md) and [docs/DSP_SPEC.md](docs/DSP_SPEC.md) for full design and physical modeling specifications.

## Project Structure

```
├── dsp/            # Rust WebAssembly Digital Waveguide engine (lib.rs)
├── docs/           # Specifications (DSP_SPEC.md, SDD.md, SRS.md, Roadmap, Charter)
├── public/         # Static assets & Black & Green Guitars sample bank
├── src/
│   ├── audio/      # Audio DSP layer, AudioWorklet processor, WDF solver & pipeline
│   │   ├── tab/    # ASCII tab parser, lookahead scheduler, tab types
│   │   ├── midi/   # MIDI parser, MIDI exporter, Web MIDI manager
│   │   └── wdf/    # WDF nodes, circuit solver, and tone-stack topologies
│   ├── graph/      # Pure netlist circuit graph engine & solver logic
│   ├── lint/       # Circuit validator & truth-table exporter
│   ├── store/      # Zustand state management (circuit, slot, audio stores)
│   ├── ui/         # React components (canvas, library, inspector, fretboard, CAD toolbars)
│   └── styles/     # Modern CSS design system & dynamic themes
└── tests/          # Vitest suite (audio, graph, lint, store, presets, tab, and UI tests)
```

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript 6
- **Build Tool**: Vite 8
- **Canvas Engine**: Konva.js (`react-konva`)
- **State Management**: Zustand
- **Audio Processing**: Web Audio API, AudioWorklet (`src/audio/processor.js`), WDF Engine, Rust WebAssembly (`dsp/`)
- **Validation**: Zod + Oxlint + Prettier
- **Testing**: Vitest (19/19 test files, 90/90 tests passing)

## Building the WASM DSP Core (optional)

The Rust WebAssembly physical modeling engine (`dsp/src/lib.rs`) requires:

- [Rust toolchain](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
npm run build:wasm
```

Pre-compiled WASM artifacts are committed in `src/audio/wasm-pkg/` for convenience — you only need this if modifying `dsp/src/lib.rs`.

## License

This project is licensed under the GNU General Public License v2.0 or later (GPL-2.0-or-later). See the [LICENSE](LICENSE) file for details.
