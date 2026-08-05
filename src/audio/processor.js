import init, { DspEngine } from './dsp.js';

let wasmMemory;

// Wave Digital Filter (WDF) passive circuit solver running inside AudioWorklet
class WdfPassiveCircuit {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.volumePos = 1.0;
    this.tonePos = 1.0;
    this.volPotMaxR = 250000;
    this.tonePotMaxR = 250000;
    this.toneCapFarads = 47e-9;
    this.pickupInductanceH = 2.4;
    this.pickupResistanceR = 6500;
    this.toneCapState = 0;
  }

  updateParams(p) {
    if (p.volumePos !== undefined) this.volumePos = Math.max(0.001, Math.min(1.0, p.volumePos));
    if (p.tonePos !== undefined) this.tonePos = Math.max(0.001, Math.min(1.0, p.tonePos));
    if (p.volPotMaxR !== undefined) this.volPotMaxR = Math.max(1000, p.volPotMaxR);
    if (p.tonePotMaxR !== undefined) this.tonePotMaxR = Math.max(1000, p.tonePotMaxR);
    if (p.toneCapFarads !== undefined) this.toneCapFarads = Math.max(1e-12, p.toneCapFarads);
    if (p.pickupInductanceH !== undefined) this.pickupInductanceH = Math.max(0.1, p.pickupInductanceH);
    if (p.pickupResistanceR !== undefined) this.pickupResistanceR = Math.max(100, p.pickupResistanceR);
  }

  processSample(vin) {
    const dt = 1 / this.sampleRate;
    const R_vol = this.volPotMaxR * Math.pow(this.volumePos, 2.5); // Audio logarithmic taper
    const R_tone = this.tonePotMaxR * Math.pow(this.tonePos, 2.0);
    const C = this.toneCapFarads;

    // Physical RC lowpass filter for tone control
    const totalToneR = Math.max(50, R_tone);
    const toneCutoff = 1 / (2 * Math.PI * totalToneR * C);
    const alpha = (2 * Math.PI * toneCutoff * dt) / (2 * Math.PI * toneCutoff * dt + 1);

    this.toneCapState = this.toneCapState + alpha * (vin - this.toneCapState);

    const toneFiltered = vin * (1 - alpha) + this.toneCapState * alpha;
    const v_toned = vin * (1 - this.tonePos) * 0.35 + toneFiltered * this.tonePos;

    // Voltage divider across volume pot loaded by pickup internal DC resistance
    const v_out = v_toned * (R_vol / (R_vol + this.pickupResistanceR));
    return v_out;
  }

  processBuffer(input, output) {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.processSample(input[i]);
    }
  }
}

class GuitarProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.outPtr = null;
    this.outBuffer = null;
    this.wdf = new WdfPassiveCircuit(sampleRate);

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'init') {
        init(msg.wasmBytes)
          .then((wasm) => {
            wasmMemory = wasm.memory;
            this.engine = new DspEngine(sampleRate);
            this.outPtr = this.engine.output_ptr();
            this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
            this.port.postMessage({ type: 'ready' });
          })
          .catch((err) => {
            console.error('WASM Init error:', err);
          });
      } else if (msg.type === 'wdf-update') {
        this.wdf.updateParams(msg.params);
      } else if (msg.type === 'pluck' && this.engine) {
        this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);
      } else if (msg.type === 'drive' && this.engine) {
        this.engine.set_drive(msg.drive);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || output.length === 0) return true;

    const outChan = output[0];

    // 1. If input audio signal is passed (e.g. from Web Audio string nodes), process through WDF
    if (input && input.length > 0 && input[0].length > 0) {
      const inChan = input[0];
      this.wdf.processBuffer(inChan, outChan);
    } else if (this.engine && this.outBuffer) {
      // 2. Otherwise process synthetic WASM engine buffer through WDF
      this.engine.process_chunk();
      this.wdf.processBuffer(this.outBuffer, outChan);
    } else {
      outChan.fill(0);
    }

    // Copy to remaining channels (stereo)
    for (let channel = 1; channel < output.length; ++channel) {
      output[channel].set(outChan);
    }

    return true;
  }
}

registerProcessor('guitar-processor', GuitarProcessor);
