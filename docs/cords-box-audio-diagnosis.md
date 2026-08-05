# cords-box audio pipeline: diagnosis report

Findings from two inspections of [`Saccharin-e/cords-box`](https://github.com/Saccharin-e/cords-box) (`develop` branch), covering the original state and commit `8c3fdcb` ("fix(audio): wire WDF solver into AudioWorklet and upgrade speaker cabinet IR").

## Status summary

| Issue | Status |
| --- | --- |
| WDF solver never processes audio | **Still open** — moved into the AudioWorklet, still not instantiated/connected |
| Recorded samples double-filtered through synthetic pickup network | **Fixed** in `8c3fdcb` |
| Cabinet IR built from pure sine tones | **Fixed** in `8c3fdcb` (now noise-based broadband IR) |
| Room IR built from pure sine tones | Still open |
| Three cascaded `DynamicsCompressorNode`s | Still open |
| Tube waveshaper curves ~linear below 0.85 input | Still open |

## Root issue: the WDF circuit still never touches the audio

### Original state

`pipeline.ts` called `this.wdfSolver.buildFromGraph(graph, result)` on every rebuild, which correctly constructed a Wave Digital Filter tree from the graph's pot/cap/pickup values (`src/audio/wdf/wdfCircuitSolver.ts`, `wdfNodes.ts`). But `processSample()`/`processBuffer()` on that solver were never called anywhere. The actual pickup coloring came from `detectActiveTopology()` — hardcoded `resonantFreq`/`resonantQ` values keyed off crude neck/bridge string-matching, completely disconnected from the graph's real component values.

`src/audio/processor.js` (an AudioWorklet) and `src/audio/dsp.js` / `dsp_bg.wasm` (a WASM DSP module) existed in the repo but were never registered via `audioWorklet.addModule()` or referenced anywhere — fully orphaned.

### After commit 8c3fdcb

The fix commit:
- registers the worklet module (`context.ts`, `audioWorklet.addModule(...)`)
- adds a working `WdfPassiveCircuit` class inside `processor.js` with a real per-sample WDF solve
- adds a `port.onmessage` handler in the worklet for `'wdf-update'` parameter changes
- registers the processor: `registerProcessor('guitar-processor', GuitarProcessor)`

But grepping the full `src` tree shows `AudioWorkletNode` never appears outside the registration itself, and `postMessage`/`'wdf-update'` never gets called from the main thread. **No `new AudioWorkletNode(ctx, 'guitar-processor')` is ever created**, so the class is loaded into the audio thread and never instantiated. The live signal path in `pipeline.ts` still runs entirely through the old heuristic `pickupResonance` peaking-filter chain — unchanged by this commit.

There are now two independent, unused WDF implementations in the repo: the original `src/audio/wdf/` (`WdfResistor`/`WdfCapacitor`/`WdfInductor`/`WdfPotentiometer` + adaptors) and the simplified `WdfPassiveCircuit` inside `processor.js`. Neither is wired to actual playback.

### Side effect of 8c3fdcb

Removing `piezoFlatFilter` also disconnected recorded DI samples from the pickup-resonance branch entirely — `sampleInputNode` now connects straight to `masterGain`, skipping `directPosition`/`delayNode`/`pickupResonance`. Correct for avoiding double-filtering, but it means recorded playback and synthesized-string playback now take inconsistent paths: recorded samples get zero pickup/wiring coloring, synthesized strings still get the old heuristic one. Neither reflects the real circuit.

## Remaining fix

Three pieces still missing to actually finish the wiring:

1. **Instantiate the node** (mono in/out) in `updatePipeline()`:
   ```ts
   const wdfNode = new AudioWorkletNode(ctx, 'guitar-processor', {
     numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
   });
   ```
2. **Splice it into the chain**, replacing the heuristic `pickupResonance` filter — between the string source and the pedal/amp stages.
3. **Push live parameter updates** on every volume/tone pot change (the worklet already listens for this, nothing sends it):
   ```ts
   wdfNode.port.postMessage({ type: 'wdf-update', params: { volumePos, tonePos } });
   ```
   Best hooked into `applyLiveTopologyParams()`, which already runs on every knob change.

## Other open issues (from the first inspection, not yet addressed)

- **Room IR is still sine-based** (`createRoomImpulseResponse()`) — a handful of discrete sine "reflections" plus two sine "ambience" tones, rather than dense broadband noise. Same class of problem the cabinet IR had before `8c3fdcb`; worth the same noise-based rebuild.
- **Three cascaded `DynamicsCompressorNode`s** (`pedalCompressor`, `powerSag`, final `compressorNode`) — stacked generic browser compressors are prone to audible pumping/breathing, especially the final one's fast 5ms attack + 4:1 ratio. Worth collapsing to one or two and listening in isolation.
- **Tube waveshaper curves are ~linear below 0.85 input amplitude** (`createCleanTubeCurve()`) — three stages (`preampTube`, `secondTube`, `powerAmpTube`) contribute almost no harmonic coloration at normal playing levels, only engaging near clipping.
