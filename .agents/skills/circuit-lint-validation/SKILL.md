---
name: circuit-lint-validation
description: Implements circuit validation rules and truth-table/schematic export in src/lint, plus their Vitest fixtures. Use when adding a new validation rule for invalid or incomplete circuits, or when exporting a circuit's truth table or documentation (e.g. via jsPDF).
---

# Circuit Validation & Export (src/lint)

This layer checks whether a circuit graph is well-formed/valid, and can export a validated
circuit's truth table or schematic as a document.

## Validation rules

- Write each rule as a **pure function**: `(graph) => Issue[]`. Never throw for an invalid
  circuit — an invalid or incomplete circuit is an expected state while a user is still wiring
  things up, not an exceptional one. The UI decides how to surface issues (warnings, blocking
  errors, etc.); the rule just reports them.
- Keep one rule per concern (e.g. "no dangling terminal", "output reaches the jack", "no
  hot/ground short") rather than one large validator function — easier to test and to enable/
  disable individually later.
- Reuse the same fixture graphs that `circuit-graph-engine` tests use where possible, so a "known
  good" and "known bad" circuit are defined once and exercised by both layers.

## Truth-table export

- Truth-table generation walks a **validated** graph and enumerates output states (e.g. per
  switch position) — keep this generation logic separate from validation itself; export code
  should assume it's given a graph that already passed validation, not re-derive validity.
- PDF/document export (via `jspdf`) should be a thin formatting step on top of already-computed
  truth-table data — if you find export code recomputing circuit logic, that logic likely belongs
  back in the graph or lint layer instead.

## Testing

- This is the layer best suited to **table-driven Vitest tests**: input graph fixture → expected
  list of issues (for validation) or expected truth table (for export). Store fixtures under
  `tests/` as data, not inline literals buried in the test body, so new fixtures are easy to add
  and diff.
- When you add a new validation rule, add both a fixture that should pass and one that should
  trip the new rule — a rule with only a passing fixture hasn't actually been tested.
