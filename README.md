# Cords Box — Advanced Guitar Crafting Sandbox

A sophisticated, web-based guitar wiring simulator. Build circuits from real components, see the live signal path as a schematic, and hear the result via a DSP-driven audio engine.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint source files |
| `npm run format` | Format source files with Prettier |
| `npm run typecheck` | Type-check without emitting |

## Architecture

Three-tier decoupled architecture:

1. **UI/Presentation Layer** — React + TypeScript + Konva.js for rendering
2. **State Management Layer** — Zustand store as single source of truth
3. **Audio DSP Layer** — Web Audio API + AudioWorklet for live processing

See [docs/SDD.md](docs/SDD.md) for full design document.

## Project Structure

```
src/
├── graph/          # Circuit graph engine (pure logic, headless)
├── audio/          # Audio DSP layer
├── store/          # Zustand state management
├── ui/             # React components
│   ├── canvas/     # Physical + schematic views
│   ├── library/    # Draggable component library
│   ├── inspector/  # Component value editor
│   └── toolbar/    # Top toolbar
├── lint/           # Circuit validation & truth-table export
└── styles/         # CSS design system
```

## Tech Stack

- React 19 + TypeScript 6
- Vite 8
- Konva.js (react-konva) for 2D canvas rendering
- Zustand for state management
- Zod for runtime schema validation
- Vitest for testing
- Web Audio API for audio processing

## License

Private — All rights reserved.
