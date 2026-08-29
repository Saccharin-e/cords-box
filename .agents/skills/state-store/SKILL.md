---
name: state-store
description: Implements the Zustand state store in src/store — the single source of truth for the circuit graph, subscribed by both the UI and audio layers. Use when adding store slices, actions, or selectors, or when wiring a new consumer to the store.
---

# State Store (src/store)

One Zustand store holds the circuit graph (netlist) and is the single source of truth that the
canvas, inspector, and audio DSP layer all read from.

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
- **One direction of truth**: the store is upstream of both the audio layer and the UI layer —
  neither should maintain its own shadow copy of graph state that can drift from the store.

## Adding a new slice

- Keep new slices scoped to one concern (e.g. "selection state" separate from "graph data")
  rather than growing a single flat store object — this keeps selectors narrow and makes it
  obvious what a given piece of state is for.
- If a new slice needs to be read by the audio layer (see `audio-dsp-engine`), expose it via a
  selector rather than having the audio code import store internals directly.

## Testing

- Store actions are plain functions and should be tested directly with Vitest (dispatch an
  action, assert on the resulting state) without needing to render any UI.
