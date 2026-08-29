---
name: state-store
description: Implements the six Zustand stores in src/store for circuit data, canvas/UI state, keybindings, projects, saved slots, and tuning. Use when adding store state, actions, or selectors, coordinating circuit and canvas updates, or wiring a new consumer to a store.
---

# State Stores (src/store)

State is divided among six Zustand stores, each with a distinct owner:

- `canvasStore.ts` owns canvas instances and presentation state: layout, pan/zoom, selection,
  wiring interaction, panels, grid/theme settings, clipboard, and canvas history.
- `circuitStore.ts` owns the electrical graph/netlist, solver result, diagnostics, graph selection,
  graph history, and circuit import/export operations.
- `keybindingsStore.ts` owns customizable keyboard shortcuts, shortcut settings, and recording
  state, persisted in local storage.
- `projectStore.ts` owns the active project and editor/home lifecycle, project metadata, and
  tutorial state, and coordinates project-level loading and saving.
- `slotStore.ts` owns the six saved circuit/layout slots, the active slot, and slot save, load,
  rename, and reset operations persisted in local storage.
- `tuningStore.ts` owns the selected tuning preset and the corresponding per-string frequencies.

`circuitStore` and `canvasStore` are the pair most likely to require coordinated updates: the
electrical graph and its visual representation have separate state and history. Be careful to
update or restore both through the existing synchronization paths; do not silently assume a change
to either store is mirrored automatically.

## Conventions

- **Actions, not direct mutation**: every graph change (add/remove node, add/remove edge, update a
  component's value) goes through a named store action, not a component reaching in and mutating
  the graph object directly. This keeps the graph consistent for every subscriber and keeps
  changes traceable.
- **Narrow selectors**: components should select only the slice of state they need
  (`useStore(s => s.nodes[id])`, not the whole store), so dragging one component doesn't
  re-render the entire canvas or unrelated inspector panels.
- **Validate before committing**: run new/changed graph data through the project's Zod schema
  before it lands in the store, so nothing downstream (audio, export, lint) ever has to handle a
  malformed graph.
- **Explicit ownership**: stores are upstream of their consumers. Do not add shadow state in the
  audio or UI layers, and do not put one concern into a convenient but unrelated store.

## Adding state

- Put new state in the store that owns that concern. If it spans the electrical graph and visual
  layout, define the synchronization and history behavior explicitly rather than growing an
  implicit cross-store dependency.
- If a new slice needs to be read by the audio layer (see `audio-dsp-engine`), expose it via a
  selector rather than having the audio code import store internals directly.

## Testing

- Store actions are plain functions and should be tested directly with Vitest (dispatch an
  action, assert on the resulting state) without needing to render any UI.
