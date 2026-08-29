---
name: audio-dsp-engine
description: Implements the audio DSP layer in src/audio — Web Audio API / AudioWorklet code that turns live circuit-graph state into filter and gain stages. Use when adding or modifying audio nodes, AudioWorklet processors, or real-time signal-path logic.
---

# Audio DSP Layer (src/audio)

This layer turns the current circuit graph into live audio processing: pickups → switches → tone
pots → volume → output, rendered as a real Web Audio graph the user can hear.

## Real-time thread rules

- Code running inside an `AudioWorkletProcessor.process()` runs on the **audio rendering thread**
  and must never allocate, trigger garbage collection, or block:
  - No object/array literals, closures, or string concatenation inside `process()` — allocate
    buffers once in the constructor and reuse them.
  - No `console.log`, no `Promise`, no DOM/store access inside `process()`.
- Communicate between the main thread and the worklet with `port.postMessage` /
  `MessageChannel` (or a `SharedArrayBuffer` for parameter automation), never by closing over a
  mutable JS object shared with the main thread.
- If a computation is genuinely too heavy for JS on the audio thread, that's what the C++ → WASM
  DSP core is for — don't try to force a heavy computation into plain JS inside the worklet as a
  workaround.

## Mapping graph → audio graph

- The audio graph should be **derived from** circuit-graph state (see the
  `circuit-graph-engine` skill), not maintained as a separate hand-edited structure. When the
  store's graph changes (a wire added/removed, a pot value changed), rebuild or patch only the
  affected Web Audio nodes rather than tearing down the whole audio graph.
- Map electrical properties on graph edges/nodes (e.g. `resistance`) to the corresponding Web
  Audio param (filter cutoff, gain) explicitly and in one place, so the mapping is easy to find
  and adjust as more component types are added.
- This layer subscribes to the Zustand store (see `state-store` skill) for graph state; it should
  not reach into `src/ui` or Konva at all — the dependency direction is store → audio, store → ui,
  never audio → ui.

## Testing

- Pure mapping logic (graph property → audio param value) can and should be unit-tested with
  Vitest outside of an actual `AudioContext`.
- Anything that genuinely requires a live `AudioContext`/`AudioWorklet` is harder to test
  headlessly — keep that surface as thin as possible so most logic stays in plain, testable
  functions.
