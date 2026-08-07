# cords-box audio pipeline: diagnosis report (v4 — Final Resolution)

Final findings and verification status across [`Saccharin-e/cords-box`](https://github.com/Saccharin-e/cords-box) (`develop` branch), covering commits `17aa4fb` through `ced002a`, `be0c7af`, and `01d881a`.

## Status Summary

| Issue | Status | Resolution / Fix Commit |
| --- | --- | --- |
| WDF solver never processes audio | **Fixed** | `ced002a` & `be0c7af` — `AudioWorkletNode` instantiated and spliced into signal chain |
| Worklet readiness race condition | **Fixed** | `be0c7af` — `AudioEngine` subscriber callback dynamically creates & connects worklet when ready |
| Synthesized string & sample path routing | **Fixed** | `be0c7af` — Both `rawStringMix` (Karplus-Strong) and `sampleInputNode` (DI samples) route through worklet |
| Live parameter sync & graph component extraction | **Fixed** | `01d881a` — Real graph component parameters extracted and posted via `wdf-update` |
| Recorded samples double-filtered through synthetic pickup network | **Fixed** | `8c3fdcb` |
| Cabinet IR built from pure sine tones | **Fixed** | `8c3fdcb` — Replaced with noise-based broadband impulse response |
| Room IR built from pure sine tones | **Fixed** | `ced002a` — Replaced with dense stereo noise impulse response |
| Three cascaded `DynamicsCompressorNode`s | **Fixed** | `pipeline.ts` — Compressor bypass logic & pristine 1:1 linear passthrough when disabled |
| Tube waveshaper curves linearity | **Fixed** | `ced002a` & `pipeline.ts` — Dynamic tube gain staging and overdrive saturation control |

## Technical Details of Resolutions

### 1. Worklet Instantiation & Readiness Race Condition

In early iterations, `wdfWorkletNode` creation was gated on a synchronous check of `audioEngine.isWorkletReady()`, which evaluated to `false` during initial context creation. 

**Resolution (`be0c7af`)**:
In `pipeline.ts`, `AudioEngine` subscribe callbacks handle asynchronous worklet readiness:
```ts
audioEngine.subscribe(() => {
  if (ctx && audioEngine.isWorkletReady() && !this.wdfWorkletNode) {
    this.createWdfWorkletNode(ctx);
    this.topologyRouted = false;
    this.routeInputThroughTopology(ctx, 1.0);
  }
});
```

### 2. Dual Signal Path Routing

Both physical modeling string synthesis (`rawStringMix`) and recorded DI guitar samples (`sampleInputNode`) are routed through `wdfWorkletNode`:

```ts
if (this.wdfWorkletNode) {
  this.sampleInputNode.connect(this.wdfWorkletNode);
  rawStringMix.connect(this.wdfWorkletNode);
  this.wdfWorkletNode.connect(this.masterGain);
}
```

### 3. Graph Component Parameter Extraction

`extractWorkletParams()` parses active circuit graph state (pickup resistance, inductance, tone cap, volume/tone wipers, cable capacitance) and sends live updates to the worklet:

```ts
this.wdfWorkletNode.port.postMessage({
  type: 'wdf-update',
  params: extractWorkletParams(graph, solverResult),
});
```

## Summary

All core audio pipeline diagnostic issues are fully resolved and verified. Both synthetic and recorded audio paths process through the live Wave Digital Filter AudioWorklet thread.
