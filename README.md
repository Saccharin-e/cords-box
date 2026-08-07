# Cords Box — Advanced Guitar Crafting Sandbox

A sophisticated, web-based guitar wiring simulator and physical modeling workbench. Assemble guitar wiring circuits from real components (pickups, switches, potentiometers, capacitors, resistors, output jacks), visualize synchronized physical and schematic canvas views, and experience the live signal path via a real-time DSP audio engine powered by Wave Digital Filters (WDF) and Karplus-Strong physical modeling.

## Features

- **Dual-View Synchronized Canvas**: Real-time physical guitar layout and schematic view powered by Konva.js with 60FPS rendering optimizations.
- **Wave Digital Filter (WDF) Audio Worklet**: Live audio processing thread running custom WDF netlist solvers for real-time passive guitar circuit simulation.
- **Physical Modeling & DI Sample Engine**: Karplus-Strong string synthesis paired with a CC0 Black & Green Guitars DI sample bank and Rust WebAssembly acceleration.
- **Interactive Playable Fretboard**: On-screen playable fretboard for instant sound triggering and polyphonic strumming.
- **Circuit Linter & Truth-Table Export**: Automated circuit validation flagging dead shorts, open connections, and same-pole jumper conflicts, with exportable truth tables.
- **CAD Canvas & Export Tools**: Snap-to-grid, customizable canvas themes, space-reclaiming retractable toolbars, and high-resolution PNG & PDF export with custom crop region selection.
- **Layout Slot Saving**: Save and restore custom canvas layouts instantly.
- **Preset Library**: Shipped with classic and custom guitar wiring presets (Stratocaster, Telecaster, Les Paul, 4-way series/parallel mods, phase reversal).

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

## Architecture

Three-tier decoupled architecture:

1. **UI / Presentation Layer** — React 19 + TypeScript + Konva.js for performant 2D physical & schematic canvas rendering, CAD toolbars, and interactive fretboard.
2. **State Management Layer** — Zustand stores as the single source of truth for circuit graph state, layout slots, preset selections, and UI preferences.
3. **Audio DSP Layer** — Web Audio API + dedicated AudioWorklet (`guitar-processor`) running real-time WDF circuit solves, tube preamp waveshaping, cabinet/room impulse responses, and optional Rust WebAssembly physical modeling.

See [docs/SDD.md](docs/SDD.md) for full software design specifications.

## Project Structure

```
├── dsp/            # Rust WebAssembly physical modeling engine
├── docs/           # Software requirements, architecture & DSP diagnosis reports
├── public/         # Static assets & Black & Green Guitars sample bank
├── src/
│   ├── audio/      # Audio DSP layer, AudioWorklet processor, WDF solver & pipeline
│   ├── graph/      # Pure netlist circuit graph engine & solver logic
│   ├── lint/       # Circuit validator & truth-table exporter
│   ├── store/      # Zustand state management (circuit, slot, audio stores)
│   ├── ui/         # React components (canvas, library, inspector, fretboard, CAD toolbars)
│   └── styles/     # Modern CSS design system & dynamic themes
└── tests/          # Vitest suite (graph, audio, lint, store, and UI unit tests)
```

## Tech Stack

- **Frontend Framework**: React 19 + TypeScript 6
- **Build Tool**: Vite 8
- **Canvas Engine**: Konva.js (`react-konva`)
- **State Management**: Zustand
- **Audio Processing**: Web Audio API, AudioWorklet (`src/audio/processor.js`), WDF Engine, Rust WebAssembly (`dsp/`)
- **Validation**: Zod + Oxlint + Prettier
- **Testing**: Vitest (10/10 test files passing)

## Building the WASM DSP Core (optional)

The Rust WebAssembly physical modeling engine (`dsp/src/lib.rs`) requires:

- [Rust toolchain](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
npm run build:wasm
```

Pre-compiled WASM artifacts are committed for convenience — you only need this if modifying `dsp/src/lib.rs`.

## License

This project is licensed under the GNU General Public License v2.0 (GPL-2.0-only). See the [LICENSE](LICENSE) file for details.
