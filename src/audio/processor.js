import init, { DspEngine } from './wasm-pkg/dsp.js';

let wasmMemory;

// ═══════════════════════════════════════════════════════════════════════════
// Wave Digital Filter (WDF) Primitives — inlined from src/audio/wdf/wdfNodes.ts
//
// Proper WDF one-port elements and three-port adaptors for passive guitar
// circuit simulation. Wave variables: a = V + I·R, b = V - I·R.
// ═══════════════════════════════════════════════════════════════════════════

/** Ideal WDF Resistor: b = 0 (matched termination) */
class WdfResistor {
  constructor(resistance) {
    this.portResistance = Math.max(0.001, resistance);
  }
  waveReflect(_a) { return 0; }
  step(_a) {}
  reset() {}
}

/** WDF Voltage Source + Resistor: models a pickup generating voltage Vs */
class WdfVoltageSourceResistor {
  constructor(resistance) {
    this.portResistance = Math.max(0.001, resistance);
    this.Vs = 0;
  }
  setVoltage(Vs) { this.Vs = Vs; }
  waveReflect(_a) { return this.Vs; }
  step(_a) {}
  reset() { this.Vs = 0; }
}

/** WDF Capacitor (bilinear transform): R = T/(2C), state: b[n] = a[n-1] */
class WdfCapacitor {
  constructor(capacitanceFarads, sampleRate) {
    const T = 1 / sampleRate;
    this.portResistance = T / (2 * Math.max(1e-12, capacitanceFarads));
    this._state = 0;
  }
  waveReflect(_a) { return this._state; }
  step(a) { this._state = a; }
  reset() { this._state = 0; }
}

/** WDF Inductor: R = 2L/T, state: b[n] = -a[n-1] */
class WdfInductor {
  constructor(inductanceHenries, sampleRate) {
    const T = 1 / sampleRate;
    this.portResistance = (2 * Math.max(1e-6, inductanceHenries)) / T;
    this._state = 0;
  }
  waveReflect(_a) { return -this._state; }
  step(a) { this._state = a; }
  reset() { this._state = 0; }
}

/** WDF Variable Resistor (Potentiometer): R = maxR × position */
class WdfPotentiometer {
  constructor(maxResistance, initialPosition = 1.0) {
    this._maxR = maxResistance;
    this.portResistance = Math.max(0.001, maxResistance * Math.min(1.0, Math.max(0.0001, initialPosition)));
  }
  setPosition(position) {
    const clampedPos = Math.min(1.0, Math.max(0.0001, position));
    this.portResistance = Math.max(0.001, this._maxR * clampedPos);
  }
  waveReflect(_a) { return 0; }
  step(_a) {}
  reset() {}
}

/** WDF 3-Port Series Adaptor: connects 2 children in series */
class WdfSeriesAdaptor {
  constructor(child1, child2) {
    this._c1 = child1;
    this._c2 = child2;
    this._g1 = 0;
    this._g2 = 0;
    this.portResistance = child1.portResistance + child2.portResistance;
    this._updateGammas();
  }
  _updateGammas() {
    this.portResistance = this._c1.portResistance + this._c2.portResistance;
    this._g1 = this._c1.portResistance / this.portResistance;
    this._g2 = this._c2.portResistance / this.portResistance;
  }
  waveReflect(a) {
    this._updateGammas();
    const b1 = this._c1.waveReflect(0);
    const b2 = this._c2.waveReflect(0);
    return -(b1 + b2);
  }
  step(a) {
    this._updateGammas();
    const b1 = this._c1.waveReflect(0);
    const b2 = this._c2.waveReflect(0);
    const a1 = b1 - this._g1 * (b1 + b2 + a);
    const a2 = b2 - this._g2 * (b1 + b2 + a);
    this._c1.step(a1);
    this._c2.step(a2);
  }
  reset() { this._c1.reset(); this._c2.reset(); }
}

/** WDF 3-Port Parallel Adaptor: connects 2 children in parallel */
class WdfParallelAdaptor {
  constructor(child1, child2) {
    this._c1 = child1;
    this._c2 = child2;
    this._G1 = 0;
    this._G2 = 0;
    this.portResistance = 1 / (1 / child1.portResistance + 1 / child2.portResistance);
    this._updateGammas();
  }
  _updateGammas() {
    this._G1 = 1 / this._c1.portResistance;
    this._G2 = 1 / this._c2.portResistance;
    const G_total = this._G1 + this._G2;
    this.portResistance = 1 / G_total;
  }
  waveReflect(a) {
    this._updateGammas();
    const b1 = this._c1.waveReflect(0);
    const b2 = this._c2.waveReflect(0);
    const G_total = this._G1 + this._G2 + 1 / this.portResistance;
    return (2 * (this._G1 * b1 + this._G2 * b2) / G_total);
  }
  step(a) {
    this._updateGammas();
    const b1 = this._c1.waveReflect(0);
    const b2 = this._c2.waveReflect(0);
    const G_total = this._G1 + this._G2 + 1 / this.portResistance;
    const v = (2 * (this._G1 * b1 + this._G2 * b2 + (1 / this.portResistance) * a)) / G_total;
    this._c1.step(v - b1);
    this._c2.step(v - b2);
  }
  reset() { this._c1.reset(); this._c2.reset(); }
}

// ═══════════════════════════════════════════════════════════════════════════
// WDF Guitar Passive Circuit — real adaptor-tree topology
//
// Pickup (R + L series) ─┐
//                        ├─ root parallel adaptor ─── output
// Tone (pot + cap series)─┤
//                        ├─ load parallel adaptor
// Volume pot ─────────────┤     (volume pot || cable cap)
// Cable cap ──────────────┘
// ═══════════════════════════════════════════════════════════════════════════

class WdfCircuit {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    // Default component values (Stratocaster single-coil)
    this._params = {
      pickups: [{ inductanceH: 2.4, resistanceR: 6500, delayMs: 1.1, blendGain: 1.0, isOutofPhase: false }],
      isSeries: false,
      volPotMaxR: 250000,
      volumePos: 1.0,
      tonePotMaxR: 250000,
      tonePos: 1.0,
      toneCapFarads: 47e-9,
      cableCapFarads: 500e-12,
      ampInputImpedanceOhms: 1000000, // 1MΩ standard passive guitar amp input
    };
    this._buildTree();
  }

  _buildTree() {
    const p = this._params;
    const sr = this.sampleRate;
    const pickups = p.pickups || [{ resistanceR: 6500, inductanceH: 2.4 }];

    this._pickupSources = [];
    
    // Pickups in parallel (or series if isSeries=true)
    let currentPickupNode = null;
    for (const pu of pickups) {
      const r = new WdfVoltageSourceResistor(pu.resistanceR);
      const l = new WdfInductor(pu.inductanceH, sr);
      const branch = new WdfSeriesAdaptor(r, l);
      this._pickupSources.push(r);
      
      if (!currentPickupNode) {
        currentPickupNode = branch;
      } else {
        if (p.isSeries) {
          currentPickupNode = new WdfSeriesAdaptor(currentPickupNode, branch);
        } else {
          currentPickupNode = new WdfParallelAdaptor(currentPickupNode, branch);
        }
      }
    }
    this._pickupBranch = currentPickupNode;

    // Tone branch: tone pot in series with tone cap
    this._tonePot = new WdfPotentiometer(p.tonePotMaxR, p.tonePos);
    this._toneCap = new WdfCapacitor(p.toneCapFarads, sr);
    this._toneBranch = new WdfSeriesAdaptor(this._tonePot, this._toneCap);

    // Load branch: volume pot in parallel with (cable cap ∥ amp input impedance)
    // The amp input impedance (typically 1MΩ) loads the pickup's resonant peak,
    // damping Q and shifting the resonant frequency. Lower impedances (10kΩ for
    // active pickups) produce a noticeably duller, more controlled tone.
    this._volumePot = new WdfPotentiometer(p.volPotMaxR, p.volumePos);
    this._cableCap = new WdfCapacitor(p.cableCapFarads, sr);
    this._ampInputR = new WdfResistor(p.ampInputImpedanceOhms);
    const cableAndAmpLoad = new WdfParallelAdaptor(this._cableCap, this._ampInputR);
    this._loadBranch = new WdfParallelAdaptor(this._volumePot, cableAndAmpLoad);

    // Root: tone+load in parallel, then that in parallel with pickup
    this._toneAndLoad = new WdfParallelAdaptor(this._toneBranch, this._loadBranch);
    this._root = new WdfParallelAdaptor(this._pickupBranch, this._toneAndLoad);
  }

  updateParams(p) {
    let rebuild = false;

    if (p.pickups !== undefined) {
      this._params.pickups = p.pickups;
      this._params.isSeries = p.isSeries;
      rebuild = true;
    }
    if (p.toneCapFarads !== undefined && p.toneCapFarads !== this._params.toneCapFarads) {
      this._params.toneCapFarads = Math.max(1e-12, p.toneCapFarads);
      rebuild = true;
    }
    if (p.cableCapFarads !== undefined && p.cableCapFarads !== this._params.cableCapFarads) {
      this._params.cableCapFarads = Math.max(1e-12, p.cableCapFarads);
      rebuild = true;
    }
    if (p.ampInputImpedanceOhms !== undefined && p.ampInputImpedanceOhms !== this._params.ampInputImpedanceOhms) {
      this._params.ampInputImpedanceOhms = Math.max(1000, p.ampInputImpedanceOhms);
      rebuild = true;
    }
    if (p.volPotMaxR !== undefined && p.volPotMaxR !== this._params.volPotMaxR) {
      this._params.volPotMaxR = Math.max(1000, p.volPotMaxR);
      rebuild = true;
    }
    if (p.tonePotMaxR !== undefined && p.tonePotMaxR !== this._params.tonePotMaxR) {
      this._params.tonePotMaxR = Math.max(1000, p.tonePotMaxR);
      rebuild = true;
    }

    // Pot positions can be updated live without rebuilding the tree
    if (p.volumePos !== undefined) {
      this._params.volumePos = Math.max(0.001, Math.min(1.0, p.volumePos));
      if (this._volumePot) this._volumePot.setPosition(this._params.volumePos);
    }
    if (p.tonePos !== undefined) {
      this._params.tonePos = Math.max(0.001, Math.min(1.0, p.tonePos));
      if (this._tonePot) this._tonePot.setPosition(this._params.tonePos);
    }

    // Structural changes (component values, not pot positions) require a
    // full tree rebuild because WDF port resistances propagate through adaptors
    if (rebuild) {
      this._buildTree();
    }
  }

  processSample(vin) {
    if (!this._root) return Array.isArray(vin) ? vin[0] || 0 : vin;
    
    if (Array.isArray(vin)) {
      for (let i = 0; i < this._pickupSources.length; i++) {
        this._pickupSources[i].setVoltage(vin[i] || 0);
      }
    } else {
      for (const source of this._pickupSources) {
        source.setVoltage(vin);
      }
    }
    
    // Evaluate tree with open-circuit load at the jack (a=0)
    // For a parallel root with a=0, b0 is the true open-circuit voltage
    const b = this._root.waveReflect(0);
    this._root.step(0);
    
    // The WDF series adaptors invert polarity, so we invert it back
    return -b;
  }

  processBuffer(input, output) {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.processSample(input[i]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AudioWorklet Processor
// ═══════════════════════════════════════════════════════════════════════════

class GuitarProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.outPtr = null;
    this.outBuffer = null;
    this.wdf = new WdfCircuit(sampleRate);
    this.pendingPlucks = [];
    this.initializing = false;
    this.delayLine = null;

    const doInit = (wasmBytes) => {
      if (this.initializing || this.engine) return;
      this.initializing = true;
      init(wasmBytes)
        .then((wasm) => {
          wasmMemory = wasm.memory;
          this.engine = new DspEngine(sampleRate);
          this.outPtr = this.engine.output_ptr();
          this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
          for (const p of this.pendingPlucks) {
            this.engine.pluck(p.string_idx, p.freq, p.velocity);
          }
          this.pendingPlucks = [];
          this.port.postMessage({ type: 'ready' });
        })
        .catch((err) => {
          this.initializing = false;
          console.error('WASM Init error:', err);
        });
    };

    // Processor waits for 'init' message with wasmBytes from the main thread

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'init') {
        doInit(msg.wasmBytes);
      } else if (msg.type === 'wdf-update') {
        this.wdf.updateParams(msg.params);
      } else if (msg.type === 'pluck') {
        if (this.engine) {
          this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);
        } else {
          this.pendingPlucks.push(msg);
        }
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
    const inChan = (input && input.length > 0 && input[0].length > 0) ? input[0] : null;

    // Run WASM DSP engine chunk if active
    if (this.engine) {
      this.engine.process_chunk();
      // Handle potential WASM memory growth detachment
      if (!this.outBuffer || this.outBuffer.byteLength === 0) {
        this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
      }
    }

    const pickups = this.wdf._params.pickups || [];

    // We apply the pickup comb filter to the combined (WebAudio + WASM) string excitation
    if (!this.delayLine) {
      this.delayLine = new DelayLine(20, sampleRate);
    }

    const hasEngine = this.engine && this.outBuffer;
    const len = outChan.length; // usually 128
    
    for (let i = 0; i < len; i++) {
      let rawWasm = hasEngine ? this.outBuffer[i] : 0;
      let rawWebAudio = inChan ? inChan[i] : 0;
      let rawSample = rawWebAudio + rawWasm;
      
      this.delayLine.write(rawSample);
      
      let vinArray = [];
      if (pickups.length === 0) {
        vinArray.push(rawSample);
      } else {
        for (const p of pickups) {
          const delayed = this.delayLine.read(p.delayMs || 1.0);
          const pickupSig = 0.72 * rawSample + 0.28 * delayed;
          let gain = p.blendGain ?? 1.0;
          if (p.isOutofPhase) gain *= -1;
          vinArray.push(pickupSig * gain);
        }
      }
      
      // Pass the array of voltages to the WDF circuit model
      // The WDF circuit naturally handles parallel averaging and series boosting
      outChan[i] = this.wdf.processSample(vinArray);
    }

    // Copy to remaining channels (stereo)
    for (let channel = 1; channel < output.length; ++channel) {
      output[channel].set(outChan);
    }

    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Delay Line for pickup position comb filtering
// ═══════════════════════════════════════════════════════════════════════════

class DelayLine {
  constructor(maxDelayMs, sampleRate) {
    this.buffer = new Float32Array(Math.ceil(sampleRate * (maxDelayMs / 1000)) + 10);
    this.ptr = 0;
    this.sampleRate = sampleRate;
  }
  write(val) {
    this.buffer[this.ptr] = val;
    this.ptr = (this.ptr + 1) % this.buffer.length;
  }
  read(delayMs) {
    const delaySamples = (delayMs * this.sampleRate) / 1000;
    let readPtr = this.ptr - delaySamples;
    if (readPtr < 0) readPtr += this.buffer.length;
    const intPtr = Math.floor(readPtr);
    const frac = readPtr - intPtr;
    const idx1 = intPtr % this.buffer.length;
    const idx2 = (intPtr + 1) % this.buffer.length;
    return this.buffer[idx1] * (1 - frac) + this.buffer[idx2] * frac;
  }
}

registerProcessor('guitar-processor', GuitarProcessor);
