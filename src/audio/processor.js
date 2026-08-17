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
// WDF Passive Tone Stack — coupled bass/mid/treble network
//
// Fender/Marshall passive tone-stack topology where the three pots interact
// through a shared resistive ladder. Unlike independent biquads, turning up
// mid audibly pulls down bass and treble.
// ═══════════════════════════════════════════════════════════════════════════

const TONE_STACK_MODELS = {
  fender: {
    R_slope: 100000, C_treble: 250e-12, R_treble_pot: 250000,
    C_bass: 100e-9, R_bass_pot: 250000,
    C_mid: 47e-9, R_mid_pot: 25000, R_load: 1000000,
  },
  marshall: {
    R_slope: 33000, C_treble: 470e-12, R_treble_pot: 220000,
    C_bass: 22e-9, R_bass_pot: 1000000,
    C_mid: 22e-9, R_mid_pot: 25000, R_load: 470000,
  },
  // Mesa Boogie Rectifier–inspired: deep V-scoop, tight low end, sizzling highs.
  // Smaller slope resistor and larger treble cap push more high-frequency energy;
  // larger mid cap with lower pot resistance create the characteristic mid-scoop.
  mesa: {
    R_slope: 39000, C_treble: 500e-12, R_treble_pot: 250000,
    C_bass: 22e-9, R_bass_pot: 250000,
    C_mid: 47e-9, R_mid_pot: 20000, R_load: 470000,
  },
  vox: {
    R_slope: 100000, C_treble: 100e-12, R_treble_pot: 1000000,
    C_bass: 47e-9, R_bass_pot: 1000000,
    C_mid: 22e-9, R_mid_pot: 50000, R_load: 1000000,
  },
};

const TONE_STACK_MAKEUP_GAIN = {
  fender: 2.0,
  marshall: 2.0,
  mesa: 2.0,
  vox: 2.0,
};

class WdfToneStack {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this._treblePot = null;
    this._bassPot = null;
    this._midPot = null;
    this._root = null;
    this._makeupGain = 2.0;
    this.build('fender');
  }

  build(model) {
    const c = TONE_STACK_MODELS[model] || TONE_STACK_MODELS.fender;
    this._makeupGain = TONE_STACK_MAKEUP_GAIN[model] ?? 2.0;
    const sr = this.sampleRate;

    this._treblePot = new WdfPotentiometer(c.R_treble_pot, 0.5);
    const trebleCap = new WdfCapacitor(c.C_treble, sr);
    const trebleBranch = new WdfSeriesAdaptor(this._treblePot, trebleCap);

    this._bassPot = new WdfPotentiometer(c.R_bass_pot, 0.5);
    const bassCap = new WdfCapacitor(c.C_bass, sr);
    const bassBranch = new WdfSeriesAdaptor(this._bassPot, bassCap);

    this._midPot = new WdfPotentiometer(c.R_mid_pot, 0.5);
    const midCap = new WdfCapacitor(c.C_mid, sr);
    const midBranch = new WdfSeriesAdaptor(this._midPot, midCap);

    const loadR = new WdfResistor(c.R_load);
    const slopeR = new WdfResistor(c.R_slope);

    const midAndLoad = new WdfParallelAdaptor(midBranch, loadR);
    const bassAndMidLoad = new WdfParallelAdaptor(bassBranch, midAndLoad);
    const toneNetwork = new WdfParallelAdaptor(trebleBranch, bassAndMidLoad);
    this._root = new WdfSeriesAdaptor(slopeR, toneNetwork);
  }

  setControls(bass, mid, treble) {
    if (this._bassPot) this._bassPot.setPosition(Math.max(0.001, bass));
    if (this._midPot) this._midPot.setPosition(Math.max(0.001, mid));
    if (this._treblePot) this._treblePot.setPosition(Math.max(0.001, treble));
  }

  processSample(vin) {
    if (!this._root) return vin;
    const b = this._root.waveReflect(vin);
    this._root.step(vin);
    return (vin + b) * 0.5 * this._makeupGain;
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
    this.toneStack = new WdfToneStack(sampleRate);
    this.pendingPlucks = [];
    this.initializing = false;
    this.delayLine = null;
    // Per-string frequency tracking for pitch-dependent pickup comb
    this.stringFreqs = new Float32Array(6);

    // Sag envelope follower state
    this.sagEnvelope = 0;
    this.sagAttackCoeff = Math.exp(-1 / (sampleRate * 0.010)); // 10ms attack
    this.sagReleaseCoeff = Math.exp(-1 / (sampleRate * 0.150)); // 150ms release
    this.sagAmount = 0.3;

    const doInit = (wasmBytes) => {
      if (this.initializing || this.engine) return;
      this.initializing = true;
      init(wasmBytes)
        .then((wasm) => {
          wasmMemory = wasm.memory;
          this.engine = new DspEngine(sampleRate, Date.now() & 0xFFFFFFFF);
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
        // Track per-string frequency for pickup comb
        if (msg.string_idx >= 0 && msg.string_idx < 6) {
          this.stringFreqs[msg.string_idx] = msg.freq;
        }
      } else if (msg.type === 'bend') {
        // Pitch glide: ramp toward target frequency
        if (this.engine) {
          this.engine.bend(msg.string_idx, msg.targetFreq, msg.durationMs || 150);
        }
        if (msg.string_idx >= 0 && msg.string_idx < 6) {
          this.stringFreqs[msg.string_idx] = msg.targetFreq;
        }
      } else if (msg.type === 'damp') {
        if (this.engine && typeof msg.string_idx === 'number') {
          const amount = typeof msg.amount === 'number' ? msg.amount : 1.0;
          this.engine.damp(msg.string_idx, amount);
        }
      } else if (msg.type === 'pickup-position' && this.engine) {
        this.engine.set_all_pickup_positions(msg.position);
      } else if (msg.type === 'sag-update') {
        if (msg.sagAmount !== undefined) this.sagAmount = msg.sagAmount;
        if (msg.releaseMs !== undefined) {
          this.sagReleaseCoeff = Math.exp(-1 / (sampleRate * msg.releaseMs / 1000));
        }
      } else if (msg.type === 'tone-stack-update') {
        // Rebuild tone stack model if changed
        if (msg.model) {
          this.toneStack.build(msg.model);
        }
        // Update bass/mid/treble pot positions
        if (msg.bass !== undefined || msg.mid !== undefined || msg.treble !== undefined) {
          this.toneStack.setControls(
            msg.bass ?? 0.5,
            msg.mid ?? 0.5,
            msg.treble ?? 0.5
          );
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

    // Subtractive pickup comb filter: uses a delay line sized for sample-based
    // comb delays derived from the played pitch and pickup position.
    if (!this.delayLine) {
      this.delayLine = new DelayLine(20, sampleRate);
    }

    const hasEngine = this.engine && this.outBuffer;
    const len = outChan.length; // usually 128

    // Compute a representative period in samples for the pickup comb.
    // Use the lowest currently-sounding string frequency for the comb period.
    let lowestFreq = 0;
    for (let s = 0; s < 6; s++) {
      if (this.stringFreqs[s] > 20) {
        if (lowestFreq === 0 || this.stringFreqs[s] < lowestFreq) {
          lowestFreq = this.stringFreqs[s];
        }
      }
    }
    const currentPeriodSamples = lowestFreq > 20 ? sampleRate / lowestFreq : 400;

    // Sag envelope follower: track RMS of the block for power-amp sag modulation
    let blockSum = 0;
    
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
          // Subtractive pickup comb: y[n] = 0.5 * (x[n] - k * x[n - d])
          // d = 2 * pickupPosition * N where N = period in samples for current pitch
          // pickupPosition is encoded as delayMs / (period_ms * 2) in the topology,
          // but we can derive it from delayMs: pos ≈ delayMs / (1000/freq * 2 * 1000)
          // However, delayMs is already set as a physical position proxy.
          // Convert: pickupPosition = delayMs / (2 * periodMs)
          const periodMs = 1000 / (lowestFreq > 20 ? lowestFreq : 250);
          const pickupPos = Math.max(0.02, Math.min(0.98, (p.delayMs || 1.0) / (2 * periodMs)));
          const combDelaySamples = Math.max(1, 2 * pickupPos * currentPeriodSamples);
          const delayed = this.delayLine.readSamples(combDelaySamples);
          const pickupSig = 0.5 * (rawSample - 0.4 * delayed);
          let gain = p.blendGain ?? 1.0;
          if (p.isOutofPhase) gain *= -1;
          vinArray.push(pickupSig * gain);
        }
      }
      
      // Pass the array of voltages to the WDF circuit model
      // The WDF circuit naturally handles parallel averaging and series boosting
      const wdfOut = this.wdf.processSample(vinArray);
      
      // Route through the coupled passive tone stack (replaces independent biquads)
      const toneOut = this.toneStack.processSample(wdfOut);

      // Power-amp sag: envelope follower for bias modulation
      const absSample = Math.abs(wdfOut);
      const sagCoeff = absSample > this.sagEnvelope ? this.sagAttackCoeff : this.sagReleaseCoeff;
      this.sagEnvelope = sagCoeff * this.sagEnvelope + (1 - sagCoeff) * absSample;
      // Sag gain reduction: louder sustained signal → volume dips, recovers slowly
      const sagGainReduction = 1.0 - this.sagAmount * Math.min(1.0, this.sagEnvelope * 3.0);
      
      outChan[i] = toneOut * sagGainReduction;
      blockSum += toneOut * toneOut;
    }

    // Post sag envelope to main thread periodically for preamp gain modulation
    if (this.sagEnvelope > 0.001) {
      this.port.postMessage({ type: 'sag-level', level: this.sagEnvelope });
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
    return this._readAt(delaySamples);
  }
  /** Read at a fractional sample delay (for pitch-tracking pickup comb) */
  readSamples(delaySamples) {
    return this._readAt(delaySamples);
  }
  _readAt(delaySamples) {
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
