---
name: canvas-rendering
description: Builds the physical and schematic canvas views in src/ui/canvas using Konva.js / react-konva, plus the component library and inspector panels. Use when adding draggable components, wiring visuals, or working on drag-and-drop canvas interaction.
---

# Canvas Rendering (src/ui/canvas, library, inspector)

Two views render the same underlying circuit graph:

- **Physical view** — a tactile, drag-and-drop layout of components as if wiring a real guitar
  cavity.
- **Schematic view** — a symbolic wiring diagram of the same circuit.

Both must stay in sync because they're two projections of one graph, not two separate states.

## react-konva conventions

- Prefer declarative `Layer`/`Group`/`Shape` components over imperative Konva API calls
  (`node.to()`, manual `.draw()`) inside render. Reach for the imperative Konva API only inside
  refs/`useEffect` for things React can't express declaratively (e.g. an animation tween).
- Keep expensive layers (many wires/components) on separate Konva `Layer`s from frequently
  redrawn ones (e.g. a drag-in-progress wire preview) so Konva only repaints what changed.
- Drag handlers should compute the new position and dispatch a store action — don't let a
  component's on-screen position live only in local React state, or the schematic view and the
  audio layer will drift out of sync with what's on screen.

## Component library & inspector

- `src/ui/library` provides draggable component templates (pickups, switches, pots) — adding a
  new draggable component means both a library entry and a corresponding node/edge shape in the
  graph schema (see `circuit-graph-engine`).
- `src/ui/inspector` edits a selected component's values (resistance, taper, wiring color, etc.).
  Inspector edits should go through the same store actions that canvas drag-and-drop uses, not a
  separate update path — one way to mutate the graph, many UI entry points into it.

## Testing

- Prefer testing canvas-adjacent logic (coordinate math, hit-testing helpers, drag-to-graph-update
  mapping) as plain functions with Vitest rather than trying to assert on rendered Konva pixels.
- For component behavior that does need rendering, use React Testing Library against the
  component tree, not pixel/canvas snapshots.
