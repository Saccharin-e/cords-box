# Historical Bug Report: WASM Audio Initialization

**Status:** Resolved

**Resolution:** The main thread now transfers the WASM module bytes to the AudioWorklet, which initializes `DspEngine`, binds its output buffers, drains queued plucks, and reports readiness.

I cloned and read through the audio DSP layer (`src/audio/`, plus the Rust source in `dsp/src/lib.rs`). The short answer: the physical-modeling synth code you wrote is actually pretty good — the bug isn't in the DSP math, it's in the wiring that's supposed to turn it on.

## How a note is supposed to get to your speakers

1. `playNote()` → `useSamples` is true by default, so it first tries `triggerRecordedGuitar()` (real WAV samples).
2. Only when that fails does it fall to `triggerSynthesizedGuitar()` — the actual synthesizer you're asking about.

`triggerSynthesizedGuitar()` (`pipeline.ts:1120`) immediately does this:

```javascript
if (this.wdfWorkletNode) {
  this.wdfWorkletNode.port.postMessage({ type: 'pluck', string_idx: stringIndex, freq, velocity });
  return true;   // <- bails out here on basically every modern browser
}

```

`wdfWorkletNode` gets created the instant `AudioWorklet` is available (`context.ts` / `pipeline.ts:462`), which is true in every current browser. So in practice, the pure-JS Karplus-Strong renderer in `karplusStrong.ts` — the one with the nice pick-position comb, pickup-position comb, and frequency-tracked loop filter — never runs. It's dead code today.

---

## The actual bug: the WASM engine is never turned on

Everything gets forwarded to `guitar-processor` (`processor.js`), which is supposed to run the real physical model in `dsp/src/lib.rs` (dual-polarization strings, dispersion all-pass, pickup aperture comb, tension-modulated pitch glide, legato crossfade — genuinely solid design). But look at how it's gated:

```javascript
// processor.js
this.port.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    init(msg.wasmBytes).then((wasm) => {
      this.engine = new DspEngine(sampleRate);   // only created here
      ...
    });
  } else if (msg.type === 'pluck' && this.engine) {
    this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);  // silently no-ops if this.engine is null
  }
  ...
};

```

`this.engine` only gets constructed after a `{type: 'init'}` message arrives. I grepped the entire repo (`context.ts`, `pipeline.ts`, everywhere) — **nothing ever posts `type: 'init'` to the worklet.** `instantiateWdfWorklet()` (`pipeline.ts:471`) creates the `AudioWorkletNode` and calls `postWdfUpdate()` (which only sends `wdf-update` — pot/pickup values), but the handshake that actually boots the WASM engine was never written.

**Consequence:** every `pluck` message hits `msg.type === 'pluck' && this.engine`, `this.engine` is null, and the message is silently dropped — no error, nothing in the console. In `process()`, since nothing is feeding real audio into the worklet's input (that only happens via recorded samples), it falls through to `outChan.fill(0)`. The synthesizer isn't "unconvincing" — in synth mode it's producing total silence, and you're only hearing anything at all because the sample bank covers most requests.

---

## Secondary bug (latent, in the dead JS fallback)

If you ever fall back to the no-worklet path, there's a second issue worth fixing while you're in there: `karplusStrong.ts` already encodes frequency-dependent sustain (`sustainSeconds()`, 3–8s depending on pitch) into the rendered buffer. But `triggerSynthesizedGuitar` layers a second, fixed envelope on top (`pipeline.ts:1181`):

```javascript
env.gain.setTargetAtTime(0.0001, now + 0.5, 3.5);

```

That starts choking every note at 0.5s with the same 3.5s time constant regardless of pitch, which flattens out the exact physical detail (low strings ringing longer) that the renderer was built to produce.

---

## Proposed fix

### 1. Actually initialize the WASM engine

Send the missing handshake, and buffer any plucks that arrive during the async compile so there's no race:

```javascript
// pipeline.ts, instantiateWdfWorklet()
this.wdfWorkletNode = new AudioWorkletNode(ctx, 'guitar-processor', {
  numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
});
this.wdfWorkletNode.port.postMessage({ type: 'init' }); // <-- add this
this.postWdfUpdate(graph);

```

*Note:* `dsp.js`'s `init()` already auto-fetches `dsp_bg.wasm` relative to the worklet's own module URL when called with no argument, so you don't need to manually read/transfer the wasm bytes — just triggering the call is enough.

```javascript
// processor.js — queue plucks that land before init resolves
this.pendingPlucks = [];
// ...
if (msg.type === 'init') {
  init().then((wasm) => {
    wasmMemory = wasm.memory;
    this.engine = new DspEngine(sampleRate);
    this.outPtr = this.engine.output_ptr();
    this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
    for (const p of this.pendingPlucks) {
      this.engine.pluck(p.string_idx, p.freq, p.velocity);
    }
    this.pendingPlucks.length = 0;
    this.port.postMessage({ type: 'ready' });
  });
} else if (msg.type === 'pluck') {
  if (this.engine) {
    this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);
  } else {
    this.pendingPlucks.push(msg);   // don't drop it
  }
}

```

### 2. Tie the outer envelope to the string's real decay

This fixes the fallback path for parity, and matters again if you ever want the JS renderer as a genuine offline/no-worklet path:

```javascript
import { renderKarplusStrong, sustainSeconds } from './karplusStrong';
// ...
const sustain = isMuted ? 0.5 : sustainSeconds(freq);
env.gain.setValueAtTime(0.0001, now);
env.gain.linearRampToValueAtTime(peakGain, now + 0.0015);
const releaseStart = now + Math.max(0.05, sustain * 0.7);
const releaseTau = Math.max(0.3, sustain * 0.3);
env.gain.setTargetAtTime(0.0001, releaseStart, releaseTau);

```

---

> **One more thing worth knowing while you're in this area:**
> You actually have three parallel implementations of the passive pickup/tone/volume circuit:
> 1. `wdf/wdfCircuitSolver.ts` (built every `updatePipeline` call but never connected to audio, `pipeline.ts:727`)
> 2. The `WdfCircuit` class inlined in `processor.js`
> 3. The Web Audio `BiquadFilter` version in `routeInputThroughTopology`.
> 
> 
> Only the last two ever produce sound; the TS solver is dead code. Not related to the silence bug, but worth pruning once the worklet path is confirmed working, so you're not maintaining physics in three places.
