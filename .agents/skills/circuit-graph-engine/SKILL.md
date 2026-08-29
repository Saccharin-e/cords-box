---
name: circuit-graph-engine
description: Implements and edits the circuit graph engine in src/graph — the pure, headless netlist model behind cords-box's guitar wiring circuits (nodes, edges, components). Use when adding node/edge types, wiring/traversal logic, or the circuit graph schema.
---

# Circuit Graph Engine (src/graph)

The graph is the single source of truth for a circuit: a netlist of components (pickups,
switches, pots, jacks) connected by wires. Both the UI layer and the audio DSP layer read from
this graph, so it must stay a **pure, headless** module — no React, no DOM, no Web Audio calls.

## Data shape

- **Nodes** represent terminals/lugs on a component: `id`, `type` (`terminal`, `switch_lug`,
  `potentiometer_lug`, etc.), `componentId` it belongs to, and role/state fields relevant to that
  type (e.g. `signalState`, `role: "common_output"`, `connectedTo`).
- **Edges** represent wires between two node ids: `id`, `source`, `target`, plus physical/electrical
  metadata (`resistance`, `wireColor`, `connectionType`, `wireType`).
- Graphs carry an `instrument_family` tag (e.g. `"Guitar"`) so the schema can extend to other
  instruments later without breaking existing circuits.

## Conventions

- **Headless first**: nothing in `src/graph` should import from `src/ui` or `src/audio`. If a
  function needs canvas coordinates or audio params, that belongs in the layer that consumes the
  graph, not in the graph itself.
- **Validate at the boundary**: use the project's Zod schemas to parse/validate any graph coming
  from outside (loaded file, store hydration, import) before it's treated as trusted data
  internally.
- **Exhaustive type handling**: node/edge `type` fields are discriminated unions — when adding a
  new type, update every `switch`/lookup that handles them and let TypeScript's exhaustiveness
  checking (`never` in a default case) catch the ones you miss.
- **New component types**: adding a new component (e.g. a new pot taper, a new switch style) means
  extending the node/edge schema plus any graph-traversal helpers (signal path tracing, lint
  rules) that pattern-match on node/edge `type` — grep for existing `type` switches before adding
  a new one.

## Testing

- This layer is the easiest to test headlessly with Vitest — prefer small, explicit fixture
  graphs (a few nodes/edges) over giant realistic circuits when testing a single traversal rule.
- Fixtures used for truth-table validation (see the `circuit-lint-validation` skill) should live
  in `tests/`, not be duplicated inline, so both the graph engine tests and the lint tests can
  reference the same known-good/known-bad circuits.
