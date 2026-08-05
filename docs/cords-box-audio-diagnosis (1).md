# cords-box audio pipeline: diagnosis report (v3)

Findings across three inspections of [`Saccharin-e/cords-box`](https://github.com/Saccharin-e/cords-box) (`develop` branch): the original state (`17aa4fb`), the first fix (`8c3fdcb`), and the current head (`ced002a` — "instantiate WDF AudioWorkletNode and resolve diagnosis report").

## Status summary

| Issue | Status |
| --- | --- |
| WDF solver never processes audio | **Partially fixed** in `ced002a` — node now exists, but only reachable on part of the signal path (see below) |
| Recorded samples double-filtered through synthetic pickup network | Fixed in `8c3fdcb` |
| Cabinet IR built from pure sine tones | Fixed in `8c3fdcb` |
| Room IR built from pure sine tones | Fixed in `ced002a` |
| Three cascaded `DynamicsCompressorNode`s | Still open |
| Tube waveshaper curves ~linear below 0.85 input | **Still open** — commit message claims this was updated; `createCleanTubeCurve()` is byte-for-byte unchanged |
| Worklet readiness race condition | **New in `ced002a`** |
| Only the recorded-sample path routes through the worklet | **New in `ced002a`** |
| Worklet circuit ignores real graph component values | **New in `ced002a`** |

## What `ced002a` actually did

- Rewrote `createRoomImpulseResponse()` to dense stereo noise + early reflections — real fix, same treatment the cabinet IR got in `8c3fdcb`.
- Added `this.wdfWorkletNode: AudioWorkletNode | null` and instantiates it in `updatePipeline()` (`pipeline.ts:473-483`), gated on `audioEngine.isWorkletReady()`.
- Connects `sampleInputNode → wdfWorkletNode → masterGain` in `routeInputThroughTopology()` (`pipeline.ts:1111-1119`), falling back to a direct connection if the node doesn't exist.
- Posts `{ type: 'wdf-update', params: { volumePos, tonePos } }` to the worklet from `applyLiveTopologyParams()` (`pipeline.ts:996-1003`).

This is real progress — the node is finally created — but three gaps mean it doesn't reliably do anything yet, and the commit message describes work that isn't in the diff.

## New problems introduced by `ced002a`

### 1. Worklet readiness race condition

`wdfWorkletNode` is only created when `audioEngine.isWorkletReady()` is already `true` (`pipeline.ts:474`). But `workletReady` flips to `true` asynchronously, after `context.audioWorklet.addModule(...)` resolves (`context.ts:43-50`) — and `updatePipeline()` is called from `triggerPluck()` fire-and-forget, immediately after context creation:

```ts
if (!ctx) {
  void audioEngine.initialize();   // not awaited
  ctx = audioEngine.getContext();  // context exists synchronously, worklet doesn't yet
}
```

`initialize()` creates the `AudioContext` synchronously (before its first `await`), so `getContext()` returns a live context immediately — but `addModule()` hasn't resolved yet, so `isWorkletReady()` is almost always still `false` on this first call. That means on a typical first pluck, `wdfWorkletNode` stays `null`.

The bigger issue: the whole routing decision only runs once. `routeInputThroughTopology()` early-returns via `if (this.topologyRouted) return;`, and `updatePipeline()` itself is only called from `triggerPluck()` when `!this.masterGain` — i.e. once per session, unless a structural circuit change forces `cleanupNodes()` and a rebuild. So if the worklet isn't ready at that one moment, **the WDF worklet is silently skipped for the rest of the session**, with no retry when it finishes loading moments later.

### 2. Only the recorded-sample path is routed through the worklet

The diff only touches `sampleInputNode` (`pipeline.ts:1111`). `rawStringMix` / `this.inputNode` — the synthesized Karplus-Strong string used by `triggerSynthesizedGuitar()`, and the fallback whenever `useSamples` is off or the sample bank hasn't loaded yet — still flows into the old heuristic branch (`directPosition` / `delayNode` / `pickupResonance`, `pipeline.ts` further down in the same function), completely untouched by this fix. The commit message says it "connects sampleInputNode and inputNode through wdfWorkletNode" — only the first half is actually in the diff.

### 3. No initial parameter sync

`wdf-update` is only posted from `applyLiveTopologyParams()`, which only runs on the "topology unchanged, knob moved" branch (`pipeline.ts:499`) — never right after the node is created. So a freshly created worklet runs with its constructor defaults (`volumePos: 1.0, tonePos: 1.0`) regardless of what the volume/tone pots are actually set to, until the user nudges a knob and a same-structure `updatePipeline()` call happens to fire.

## Still true from the first inspection: the worklet's circuit is a simplified stand-in

`WdfPassiveCircuit` inside `processor.js` isn't the WDF tree that was built earlier — it's a single-pole RC lowpass blended by tone position, plus a voltage-divider-style volume attenuation, with **hardcoded** pickup resistance (6.5kΩ), tone cap (47nF), and pot range (250kΩ):

```js
const R_vol = 250000 * Math.pow(this.volumePos, 2.5);
const R_tone = 250000 * Math.pow(this.tonePos, 2.0);
const R_cap = T / (2 * 47e-9);
```

None of these reflect the graph's actual solved values — the pickup inductance, whatever cap or pot value the user actually placed, or cable capacitance. The real multi-element implementation (`WdfResistor` / `WdfCapacitor` / `WdfInductor` / `WdfPotentiometer` + series/parallel adaptors in `src/audio/wdf/`) is still never touched. Also worth flagging: `R_cap` is a WDF-domain port-resistance term (`T / 2C`, meaningful only inside a wave-digital adaptor), and it's being fed directly into a continuous-time RC cutoff formula (`toneCutoff = 1 / (2π(R_tone + R_cap) · 47e-9)`) — the two formalisms don't mix like that; it happens to produce *a* filter, just not a physically meaningful one.

## How to properly implement it

In priority order — 1 and 2 are what's actually breaking things right now; 3 and 4 are what makes it "real" once it's reliably connected.

### 1. Fix the readiness race

Don't gate node creation on a snapshot of `isWorkletReady()` taken once per session. Two ways to do it, pick one:

- **Simplest**: make `initialize()` fully awaited before the pipeline is ever built, so the worklet module is guaranteed loaded by the time `updatePipeline()` runs:
  ```ts
  // triggerPluck()
  if (!this.masterGain) {
    await audioEngine.initialize(); // await instead of fire-and-forget in updatePipeline
    this.updatePipeline(useCircuitStore.getState().graph, useCircuitStore.getState().solverResult);
  }
  ```
- **More resilient**: subscribe to `audioEngine`'s state-change event and re-run the worklet-node creation + reconnect step whenever `workletReady` flips true after the fact, rather than only checking it once:
  ```ts
  audioEngine.subscribe(() => {
    if (audioEngine.isWorkletReady() && !this.wdfWorkletNode) {
      this.createWdfWorkletNode(ctx);
      this.topologyRouted = false; // force routeInputThroughTopology to re-run and pick it up
      this.routeInputThroughTopology(ctx, 1.0);
    }
  });
  ```
  The second approach is worth doing regardless, since sample-bank loading has the same kind of race (see `initializeSampleBank`) and the codebase already has a retry path for that one (`triggerPluck` awaits `bankPromise` and retries) — the worklet deserves the same treatment.

### 2. Route both input paths through the same node

In `routeInputThroughTopology()`, connect `rawStringMix` (i.e. `this.inputNode`) through `wdfWorkletNode` the same way `sampleInputNode` is, instead of leaving it on the old `directPosition`/`delayNode`/`pickupResonance` branch:

```ts
if (this.wdfWorkletNode) {
  this.sampleInputNode.connect(this.wdfWorkletNode);
  rawStringMix.connect(this.wdfWorkletNode);
  this.wdfWorkletNode.connect(this.masterGain);
} else {
  // existing heuristic fallback for both, unchanged
}
```
This also means the `directPosition`/`delayNode`/`pickupResonance` heuristic block becomes the *fallback-only* path (worklet unavailable), not a permanent second path that runs in parallel with the worklet for synthesized strings.

### 3. Sync parameters immediately on node creation

Right after `this.wdfWorkletNode = new AudioWorkletNode(...)` succeeds, post the current topology's values before any audio reaches it — don't wait for the first knob turn:

```ts
this.wdfWorkletNode = new AudioWorkletNode(ctx, 'guitar-processor', { /* ... */ });
this.wdfWorkletNode.port.postMessage({
  type: 'wdf-update',
  params: { volumePos: topology.masterVolume, tonePos: topology.masterTone },
});
```

### 4. Feed the worklet real circuit values instead of hardcoded ones

Two viable levels of effort:

- **Pragmatic**: extend the `wdf-update` message to include the actual solved values instead of just pot positions — pickup resistance/inductance, tone cap farads, cable capacitance — computed the same way `WdfGuitarCircuitSolver.buildFromGraph()` already does (`wdfCircuitSolver.ts:57-83`). Have `WdfPassiveCircuit.updateParams()` use those instead of the literals `250000`, `47e-9`, `6500`. This keeps the worklet's simplified single-pole model but makes it actually reflect the user's wiring.
- **Correct**: retire the duplicate `WdfPassiveCircuit` and run the real `WdfResistor`/`WdfCapacitor`/`WdfInductor`/`WdfPotentiometer` + adaptor tree (already correct in `src/audio/wdf/wdfNodes.ts`) inside the worklet, calling `WdfGuitarCircuitSolver.processSample()` per-sample. This needs the worklet's build step to bundle those TS modules into plain JS the same way `dsp.js` gets loaded — Vite can target a dedicated worklet entry point for this (`new URL('./workletEntry.ts', import.meta.url)`-style build, or a small manual bundle step), since AudioWorklet module scripts do support `import`. Worth doing once the pragmatic fix above is stable and you want the actual multi-element circuit driving playback rather than an approximation of it.

## Still open, unrelated to the worklet

- **Three cascaded `DynamicsCompressorNode`s** (`pedalCompressor`, `powerSag`, final `compressorNode`) — stacked generic browser compressors risk audible pumping, especially the final one's fast 5ms attack + 4:1 ratio.
- **Tube waveshaper curves are ~linear below 0.85 input amplitude** (`createCleanTubeCurve()`) — despite the `ced002a` commit message claiming an update, the function is unchanged from `8c3fdcb`. Three stages (`preampTube`, `secondTube`, `powerAmpTube`) still contribute almost no harmonic coloration at normal playing levels.
