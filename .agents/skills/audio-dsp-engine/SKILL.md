---
name: audio-dsp-engine
description: Implements the audio DSP layer in src/audio and dsp — the Rust/WASM string engine plus Web Audio and AudioWorklet processing that turns live circuit and performance state into the complete instrument, amplifier, cabinet, and effects signal path. Use when adding or modifying DSP, audio nodes, AudioWorklet processors, or real-time signal-path logic.
---

# Audio DSP Layer (src/audio)

This layer turns string excitation, the current circuit graph, amplifier settings, and pedal state
into the complete live signal path. It is not just a thin mapping of pickup and pot properties:
the path includes the Rust/WASM physical string model, the pickup and guitar-harness WDF solve,
compressor and overdrive, cascaded tube-preamp waveshaping, a WDF-solved passive tone stack for
the selected amp model, power-amp processing, a modal-resonance cabinet impulse response, and the
chorus, delay, and room-reverb stages before final output.

## Real-time thread rules

- Code running inside an `AudioWorkletProcessor.process()` runs on the **audio rendering thread**
  and must never allocate, trigger garbage collection, or block:
  - No object/array literals, closures, or string concatenation inside `process()` — allocate
    buffers once in the constructor and reuse them.
  - No `console.log`, no `Promise`, no DOM/store access inside `process()`.
- Communicate between the main thread and the worklet with `port.postMessage` /
  `MessageChannel` (or a `SharedArrayBuffer` for parameter automation), never by closing over a
  mutable JS object shared with the main thread.
- If a computation is genuinely too heavy for JS on the audio thread, that's what the Rust → WASM
  DSP core (`dsp/src/lib.rs`, built with `wasm-pack` / `npm run build:wasm`) is for — don't try to
  force a heavy computation into plain JS inside the worklet as a
  workaround.

## Mapping graph → audio graph

- Keep the full processing topology in mind when changing graph-to-audio mapping:
  `Rust/WASM strings → pickup/harness WDF → compressor/overdrive → tube preamp → per-amp WDF tone
  stack → power amp → modal cabinet IR → chorus/delay/reverb → output`. Circuit properties directly
  drive the pickup/harness portion, while amp, cabinet, and pedal state configure the downstream
  stages; a change near the front of the chain can materially affect every later nonlinear stage.
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
