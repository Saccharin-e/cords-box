import init, { DspEngine } from './wasm-pkg/dsp.js';
import { WdfToneStack } from './wdf/toneStackCore.js';

export { WdfToneStack } from './wdf/toneStackCore.js';

let wasmMemory;

const MIN_PORT_RESISTANCE = 0.001;

function applyPotTaper(position, taper) {
  const clamped = Math.min(1, Math.max(0, position));
  if (taper === 'audio') return clamped * clamped;
  if (taper === 'reverse_audio') return 1 - (1 - clamped) * (1 - clamped);
  return clamped;
}

// ═══════════════════════════════════════════════════════════════════════════
// Wave Digital Filter (WDF) Primitives — inlined from src/audio/wdf/wdfNodes.ts
//
// Proper WDF one-port elements and three-port adaptors for passive guitar
// circuit simulation. Wave variables: a = V + I·R, b = V - I·R.
// ═══════════════════════════════════════════════════════════════════════════

/** Ideal WDF Resistor: b = 0 (matched termination) */
export class WdfResistor {
  constructor(resistance) {
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistance);
  }
  waveReflect(_a) {
    return 0;
  }
  step(_a) {}
  reset() {}
}

/** WDF Voltage Source + Resistor: models a pickup generating voltage Vs */
export class WdfVoltageSourceResistor {
  constructor(resistance) {
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistance);
    this.Vs = 0;
  }
  setVoltage(Vs) {
    this.Vs = Vs;
  }
  waveReflect(_a) {
    return this.Vs;
  }
  step(_a) {}
  reset() {
    this.Vs = 0;
  }
}

/** WDF Capacitor (bilinear transform): R = T/(2C), state: b[n] = a[n-1] */
export class WdfCapacitor {
  constructor(capacitanceFarads, sampleRate) {
    const T = 1 / sampleRate;
    this.portResistance = T / (2 * Math.max(1e-12, capacitanceFarads));
    this._state = 0;
  }
  waveReflect(_a) {
    return this._state;
  }
  step(a) {
    this._state = a;
  }
  reset() {
    this._state = 0;
  }
}

/** WDF Inductor: R = 2L/T, state: b[n] = -a[n-1] */
export class WdfInductor {
  constructor(inductanceHenries, sampleRate) {
    const T = 1 / sampleRate;
    this.portResistance = (2 * Math.max(1e-6, inductanceHenries)) / T;
    this._state = 0;
  }
  waveReflect(_a) {
    return -this._state;
  }
  step(a) {
    this._state = a;
  }
  reset() {
    this._state = 0;
  }
}

/** WDF Variable Resistor (Potentiometer): R = maxR × taperFn(position)
 *  Supports audio (A-taper) and reverse audio (C-taper) in addition to linear (B-taper). */
export class WdfPotentiometer {
  constructor(maxResistance, initialPosition = 1.0, taper = 'linear') {
    this._maxR = Math.max(MIN_PORT_RESISTANCE, maxResistance);
    this._position = Math.min(1, Math.max(0, initialPosition));
    this._taper = taper;
    this.portResistance = this._resistanceAtCurrentPosition();
  }
  setPosition(position) {
    this._position = Math.min(1, Math.max(0, position));
    this.portResistance = this._resistanceAtCurrentPosition();
  }
  setTaper(taper) {
    this._taper = taper;
    this.portResistance = this._resistanceAtCurrentPosition();
  }
  _resistanceAtCurrentPosition() {
    return Math.max(MIN_PORT_RESISTANCE, this._maxR * applyPotTaper(this._position, this._taper));
  }
  waveReflect(_a) {
    return 0;
  }
  step(_a) {}
  reset() {}
}

/** Transparent one-port wrapper that records terminal voltage on the down pass. */
export class WdfVoltageProbe {
  constructor(child) {
    this._child = child;
    this._reflectedWave = 0;
    this.portResistance = child.portResistance;
    this.voltage = 0;
  }
  waveReflect(a) {
    this._reflectedWave = this._child.waveReflect(a);
    this.portResistance = this._child.portResistance;
    return this._reflectedWave;
  }
  step(a) {
    this.voltage = (a + this._reflectedWave) * 0.5;
    this._child.step(a);
  }
  reset() {
    this._child.reset();
    this._reflectedWave = 0;
    this.voltage = 0;
  }
}

/** WDF 3-Port Series Adaptor — cached reflected waves + dirty-flag gammas */
export class WdfSeriesAdaptor {
  constructor(child1, child2) {
    this._c1 = child1;
    this._c2 = child2;
    this._g1 = 0;
    this._g2 = 0;
    this._b1 = 0;
    this._b2 = 0;
    this._lastR1 = 0;
    this._lastR2 = 0;
    this.portResistance = child1.portResistance + child2.portResistance;
    this._updateGammas();
  }
  _updateGammas() {
    this.portResistance = this._c1.portResistance + this._c2.portResistance;
    this._g1 = this._c1.portResistance / this.portResistance;
    this._g2 = this._c2.portResistance / this.portResistance;
    this._lastR1 = this._c1.portResistance;
    this._lastR2 = this._c2.portResistance;
  }
  _ensureGammas() {
    if (this._c1.portResistance !== this._lastR1 || this._c2.portResistance !== this._lastR2) {
      this._updateGammas();
    }
  }
  waveReflect(_a) {
    this._b1 = this._c1.waveReflect(0);
    this._b2 = this._c2.waveReflect(0);
    this._ensureGammas();
    return -(this._b1 + this._b2);
  }
  step(a) {
    const a1 = this._b1 - this._g1 * (this._b1 + this._b2 + a);
    const a2 = this._b2 - this._g2 * (this._b1 + this._b2 + a);
    this._c1.step(a1);
    this._c2.step(a2);
  }
  reset() {
    this._c1.reset();
    this._c2.reset();
    this._b1 = 0;
    this._b2 = 0;
  }
}

/** N-port series junction that preserves each complete pickup branch. */
export class WdfSeriesNAdaptor {
  constructor(children) {
    if (children.length === 0) throw new Error('WdfSeriesNAdaptor requires a child');
    this._children = children.slice();
    this._gammas = new Float64Array(children.length);
    this._reflectedWaves = new Float64Array(children.length);
    this._lastResistances = new Float64Array(children.length);
    this._reflectedSum = 0;
    this.portResistance = MIN_PORT_RESISTANCE;
    this._updateGammas();
  }
  _updateGammas() {
    let resistanceSum = 0;
    for (let i = 0; i < this._children.length; i++) {
      resistanceSum += this._children[i].portResistance;
    }
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistanceSum);
    for (let i = 0; i < this._children.length; i++) {
      const resistance = this._children[i].portResistance;
      this._gammas[i] = resistance / this.portResistance;
      this._lastResistances[i] = resistance;
    }
  }
  _ensureGammas() {
    for (let i = 0; i < this._children.length; i++) {
      if (this._children[i].portResistance !== this._lastResistances[i]) {
        this._updateGammas();
        return;
      }
    }
  }
  waveReflect(_a) {
    let sum = 0;
    for (let i = 0; i < this._children.length; i++) {
      const reflected = this._children[i].waveReflect(0);
      this._reflectedWaves[i] = reflected;
      sum += reflected;
    }
    this._ensureGammas();
    this._reflectedSum = sum;
    return -sum;
  }
  step(a) {
    const junctionWave = this._reflectedSum + a;
    for (let i = 0; i < this._children.length; i++) {
      this._children[i].step(this._reflectedWaves[i] - this._gammas[i] * junctionWave);
    }
  }
  reset() {
    for (let i = 0; i < this._children.length; i++) {
      this._children[i].reset();
      this._reflectedWaves[i] = 0;
    }
    this._reflectedSum = 0;
  }
}

/** WDF 3-Port Parallel Adaptor — standard Fettweis equations: b0 = gamma1*b1 + gamma2*b2 */
export class WdfParallelAdaptor {
  constructor(child1, child2) {
    this._c1 = child1;
    this._c2 = child2;
    this._g1 = 0;
    this._g2 = 0;
    this._b1 = 0;
    this._b2 = 0;
    this._b0 = 0;
    this._lastR1 = 0;
    this._lastR2 = 0;
    this.portResistance = 1 / (1 / child1.portResistance + 1 / child2.portResistance);
    this._updateGammas();
  }
  _updateGammas() {
    const G1 = 1 / this._c1.portResistance;
    const G2 = 1 / this._c2.portResistance;
    const Gsum = G1 + G2;
    this.portResistance = 1 / Gsum;
    this._g1 = G1 / Gsum;
    this._g2 = G2 / Gsum;
    this._lastR1 = this._c1.portResistance;
    this._lastR2 = this._c2.portResistance;
  }
  _ensureGammas() {
    if (this._c1.portResistance !== this._lastR1 || this._c2.portResistance !== this._lastR2) {
      this._updateGammas();
    }
  }
  waveReflect(_a) {
    this._b1 = this._c1.waveReflect(0);
    this._b2 = this._c2.waveReflect(0);
    this._ensureGammas();
    this._b0 = this._g1 * this._b1 + this._g2 * this._b2;
    return this._b0;
  }
  step(a) {
    const v = this._b0 + a;
    this._c1.step(v - this._b1);
    this._c2.step(v - this._b2);
  }
  reset() {
    this._c1.reset();
    this._c2.reset();
    this._b1 = 0;
    this._b2 = 0;
    this._b0 = 0;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WDF Guitar Passive Circuit — real adaptor-tree topology
//
// Pickup ((source + L) || winding C) ─┐
// Pickup and tone branches meet at the hot node.
// Tone (pot + cap series) ────────────┤─ hot
// hot ── (volume Rtop || treble bleed C) ── wiper/output
// output ── (volume Rbottom || cable C || amp R) ── ground
// ═══════════════════════════════════════════════════════════════════════════

export class WdfCircuit {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    // Default component values (Stratocaster single-coil)
    this._params = {
      pickups: [
        {
          inductanceH: 2.4,
          resistanceR: 6500,
          windingCapFarads: 120e-12,
          delayMs: 1.1,
          blendGain: 1.0,
          isOutofPhase: false,
        },
      ],
      isSeries: false,
      volPotMaxR: 250000,
      volumePos: 1.0,
      volumePotTaper: 'audio',
      tonePotMaxR: 250000,
      tonePos: 1.0,
      tonePotTaper: 'linear',
      toneCapFarads: 47e-9,
      trebleBleedCapFarads: 0,
      cableCapFarads: 500e-12,
      ampInputImpedanceOhms: 1000000, // 1MΩ standard passive guitar amp input
    };
    this._currentVolumePos = this._params.volumePos;
    this._targetVolumePos = this._params.volumePos;
    this._currentTonePos = this._params.tonePos;
    this._targetTonePos = this._params.tonePos;
    this._controlSmoothing = 1 - Math.exp(-1 / (sampleRate * 0.012));
    this._hasRuntimeParams = false;
    this._buildTree();
  }

  _buildTree() {
    const p = this._params;
    const sr = this.sampleRate;
    const pickups =
      Array.isArray(p.pickups) && p.pickups.length > 0
        ? p.pickups
        : [
            {
              resistanceR: 6500,
              inductanceH: 2.4,
              windingCapFarads: 120e-12,
              blendGain: 1,
              isOutofPhase: false,
            },
          ];

    this._pickupSources = [];
    this._pickupConfigs = pickups;
    this._pickupInputVoltages = new Float64Array(pickups.length);
    // One delay per pickup/string pair. Keeping the matrix flat avoids any
    // render-thread array allocation while preserving polyphonic sensing.
    this._pickupCombDelaySamples = new Float64Array(pickups.length * 6);
    const pickupBranches = [];
    for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
      const pu = pickups[pickupIndex];
      const source = new WdfVoltageSourceResistor(pu.resistanceR);
      const inductor = new WdfInductor(pu.inductanceH, sr);
      const rl = new WdfSeriesAdaptor(source, inductor);
      const windingCapFarads = pu.windingCapFarads ?? 120e-12;
      let branch = rl;
      if (windingCapFarads > 0) {
        const windingCap = new WdfCapacitor(windingCapFarads, sr);
        branch = new WdfParallelAdaptor(rl, windingCap);
      }
      this._pickupSources.push(source);
      pickupBranches.push(branch);
    }

    let currentPickupNode = pickupBranches[0];
    if (p.isSeries && pickupBranches.length > 1) {
      currentPickupNode = new WdfSeriesNAdaptor(pickupBranches);
    } else {
      for (let pickupIndex = 1; pickupIndex < pickupBranches.length; pickupIndex++) {
        currentPickupNode = new WdfParallelAdaptor(currentPickupNode, pickupBranches[pickupIndex]);
      }
    }
    // The rooted N-series adaptor faces the parent in the opposite reference
    // direction from an individual pickup branch. Normalize that arbitrary
    // global polarity while retaining each pickup's relative phase.
    this._pickupSourcePolarity = p.isSeries && pickupBranches.length > 1 ? -1 : 1;
    this._pickupBranch = currentPickupNode;

    // Tone rheostat in series with its shunt capacitor.
    this._tonePot = new WdfPotentiometer(
      p.tonePotMaxR,
      this._currentTonePos,
      p.tonePotTaper || 'linear',
    );
    this._toneCap = new WdfCapacitor(p.toneCapFarads, sr);
    this._toneBranch = new WdfSeriesAdaptor(this._tonePot, this._toneCap);

    // Three-terminal volume divider. The lower section is wiper-to-ground;
    // the complementary upper section is hot-to-wiper.
    const wiperFraction = applyPotTaper(this._currentVolumePos, p.volumePotTaper || 'audio');
    this._volumeTopPot = new WdfPotentiometer(p.volPotMaxR, 1 - wiperFraction, 'linear');
    this._volumePot = new WdfPotentiometer(p.volPotMaxR, wiperFraction, 'linear');

    let upperVolumeBranch = this._volumeTopPot;
    if ((p.trebleBleedCapFarads || 0) > 0) {
      this._trebleBleedCap = new WdfCapacitor(p.trebleBleedCapFarads, sr);
      upperVolumeBranch = new WdfParallelAdaptor(this._volumeTopPot, this._trebleBleedCap);
    } else {
      this._trebleBleedCap = null;
    }

    this._cableCap = new WdfCapacitor(p.cableCapFarads, sr);
    this._ampInputR = new WdfResistor(p.ampInputImpedanceOhms);
    const cableAndAmpLoad = new WdfParallelAdaptor(this._cableCap, this._ampInputR);
    const lowerVolumeBranch = new WdfParallelAdaptor(this._volumePot, cableAndAmpLoad);
    this._outputProbe = new WdfVoltageProbe(lowerVolumeBranch);
    this._volumeDivider = new WdfSeriesAdaptor(upperVolumeBranch, this._outputProbe);

    const pickupAndTone = new WdfParallelAdaptor(this._pickupBranch, this._toneBranch);
    this._root = new WdfParallelAdaptor(pickupAndTone, this._volumeDivider);
  }

  updateParams(p) {
    let rebuild = false;
    const initializeControls = !this._hasRuntimeParams;

    if (p.pickups !== undefined) {
      const currentPickups = this._params.pickups;
      let pickupStructureChanged =
        !Array.isArray(currentPickups) || currentPickups.length !== p.pickups.length;
      if (!pickupStructureChanged) {
        for (let i = 0; i < p.pickups.length; i++) {
          const current = currentPickups[i];
          const next = p.pickups[i];
          if (
            current.inductanceH !== next.inductanceH ||
            current.resistanceR !== next.resistanceR ||
            (current.windingCapFarads ?? 120e-12) !== (next.windingCapFarads ?? 120e-12)
          ) {
            pickupStructureChanged = true;
            break;
          }
        }
      }
      this._params.pickups = p.pickups;
      this._pickupConfigs = p.pickups;
      rebuild = pickupStructureChanged;
    }
    if (p.isSeries !== undefined && p.isSeries !== this._params.isSeries) {
      this._params.isSeries = p.isSeries;
      rebuild = true;
    }
    if (p.toneCapFarads !== undefined && p.toneCapFarads !== this._params.toneCapFarads) {
      this._params.toneCapFarads = Math.max(1e-12, p.toneCapFarads);
      rebuild = true;
    }
    if (
      p.trebleBleedCapFarads !== undefined &&
      p.trebleBleedCapFarads !== this._params.trebleBleedCapFarads
    ) {
      this._params.trebleBleedCapFarads = Math.max(0, p.trebleBleedCapFarads);
      rebuild = true;
    }
    if (p.cableCapFarads !== undefined && p.cableCapFarads !== this._params.cableCapFarads) {
      this._params.cableCapFarads = Math.max(1e-12, p.cableCapFarads);
      rebuild = true;
    }
    if (
      p.ampInputImpedanceOhms !== undefined &&
      p.ampInputImpedanceOhms !== this._params.ampInputImpedanceOhms
    ) {
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
    if (p.volumePotTaper !== undefined && p.volumePotTaper !== this._params.volumePotTaper) {
      this._params.volumePotTaper = p.volumePotTaper;
      rebuild = true;
    }
    if (p.tonePotTaper !== undefined && p.tonePotTaper !== this._params.tonePotTaper) {
      this._params.tonePotTaper = p.tonePotTaper;
      rebuild = true;
    }

    // Pot positions are smoothed on the render thread. The initial graph
    // snapshot applies immediately so startup does not fade from defaults.
    if (p.volumePos !== undefined) {
      this._params.volumePos = Math.max(0, Math.min(1, p.volumePos));
      this._targetVolumePos = this._params.volumePos;
      if (initializeControls) this._currentVolumePos = this._targetVolumePos;
    }
    if (p.tonePos !== undefined) {
      this._params.tonePos = Math.max(0, Math.min(1, p.tonePos));
      this._targetTonePos = this._params.tonePos;
      if (initializeControls) this._currentTonePos = this._targetTonePos;
    }

    if (initializeControls) this._applyControlPositions();
    this._hasRuntimeParams = true;

    // Structural changes (component values, not pot positions) require a
    // full tree rebuild because WDF port resistances propagate through adaptors
    if (rebuild) {
      this._buildTree();
    }
  }

  _applyControlPositions() {
    const wiperFraction = applyPotTaper(
      this._currentVolumePos,
      this._params.volumePotTaper || 'audio',
    );
    if (this._volumeTopPot) this._volumeTopPot.setPosition(1 - wiperFraction);
    if (this._volumePot) this._volumePot.setPosition(wiperFraction);
    if (this._tonePot) this._tonePot.setPosition(this._currentTonePos);
  }

  _smoothControlPositions() {
    const volumeDelta = this._targetVolumePos - this._currentVolumePos;
    const toneDelta = this._targetTonePos - this._currentTonePos;
    if (Math.abs(volumeDelta) < 1e-7 && Math.abs(toneDelta) < 1e-7) return;

    this._currentVolumePos =
      Math.abs(volumeDelta) < 1e-7
        ? this._targetVolumePos
        : this._currentVolumePos + volumeDelta * this._controlSmoothing;
    this._currentTonePos =
      Math.abs(toneDelta) < 1e-7
        ? this._targetTonePos
        : this._currentTonePos + toneDelta * this._controlSmoothing;
    this._applyControlPositions();
  }

  processSample(vin) {
    if (!this._root || !this._outputProbe) {
      return typeof vin === 'number' ? vin : vin[0] || 0;
    }

    this._smoothControlPositions();

    if (typeof vin !== 'number') {
      for (let i = 0; i < this._pickupSources.length; i++) {
        const pu = this._pickupConfigs[i];
        const phase = (pu && pu.isOutofPhase ? -1 : 1) * this._pickupSourcePolarity;
        this._pickupSources[i].setVoltage((vin[i] || 0) * phase);
      }
    } else {
      for (let i = 0; i < this._pickupSources.length; i++) {
        const pu = this._pickupConfigs[i];
        const phase = (pu && pu.isOutofPhase ? -1 : 1) * this._pickupSourcePolarity;
        this._pickupSources[i].setVoltage(vin * phase);
      }
    }

    // The root only closes the tree; it is not another physical load. An open
    // boundary has reflection coefficient +1, so a0 = b0 on the down pass.
    const b = this._root.waveReflect(0);
    this._root.step(b);

    return this._outputProbe.voltage;
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

export class GuitarProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.engine = null;
    this.outPtr = null;
    this.outBuffer = null;
    this.stringOutPtr = null;
    this.stringOutBuffer = null;
    this.wdf = new WdfCircuit(sampleRate);
    this.pendingPlucks = [];
    this.scheduledEvents = [];
    this.scheduledEventIndex = 0;
    this.initializing = false;
    this.monoSynthDelayLine = new DelayLine(20, sampleRate);
    this.stringDelayLines = [
      new DelayLine(20, sampleRate),
      new DelayLine(20, sampleRate),
      new DelayLine(20, sampleRate),
      new DelayLine(20, sampleRate),
      new DelayLine(20, sampleRate),
      new DelayLine(20, sampleRate),
    ];
    // Per-string frequency tracking for pitch-dependent pickup comb
    this.stringFreqs = new Float32Array(6);

    this.executeEvent = (msg) => {
      if (msg.type === 'pluck') {
        if (this.engine) {
          this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);
        } else {
          this.pendingPlucks.push(msg);
        }
        if (msg.string_idx >= 0 && msg.string_idx < 6) {
          this.stringFreqs[msg.string_idx] = msg.freq;
        }
      } else if (msg.type === 'bend') {
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
      }
    };

    const doInit = (wasmBytes) => {
      if (this.initializing || this.engine) return;
      this.initializing = true;
      init(wasmBytes)
        .then((wasm) => {
          wasmMemory = wasm.memory;
          this.engine = new DspEngine(sampleRate, Date.now() & 0xffffffff);
          this.outPtr = this.engine.output_ptr();
          this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
          if (typeof this.engine.string_output_ptr === 'function') {
            this.stringOutPtr = this.engine.string_output_ptr();
            this.stringOutBuffer = new Float32Array(wasmMemory.buffer, this.stringOutPtr, 6 * 128);
          }
          for (const p of this.pendingPlucks) {
            this.engine.pluck(p.string_idx, p.freq, p.velocity);
          }
          this.pendingPlucks = [];
          this.port.postMessage({ type: 'ready' });
        })
        .catch((err) => {
          this.initializing = false;
          console.error('WASM Init error:', err);
          this.port.postMessage({ type: 'error', reason: 'wasm-init-failed' });
        });
    };

    // Processor waits for 'init' message with wasmBytes from the main thread

    this.port.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'init') {
        doInit(msg.wasmBytes);
      } else if (msg.type === 'wdf-update') {
        this.wdf.updateParams(msg.params);
      } else if (msg.type === 'pluck' || msg.type === 'bend' || msg.type === 'damp') {
        if (typeof msg.time === 'number' && msg.time > currentTime + 0.002) {
          if (this.scheduledEventIndex > 0) {
            this.scheduledEvents.splice(0, this.scheduledEventIndex);
            this.scheduledEventIndex = 0;
          }
          this.scheduledEvents.push(msg);
          this.scheduledEvents.sort((a, b) => (a.time || 0) - (b.time || 0));
        } else {
          this.executeEvent(msg);
        }
      } else if (msg.type === 'pickup-position' && this.engine) {
        this.engine.set_all_pickup_positions(msg.position);
      } else if (msg.type === 'drive' && this.engine) {
        this.engine.set_drive(msg.drive);
      } else if (
        msg.type === 'whammy' &&
        this.engine &&
        typeof this.engine.set_whammy === 'function'
      ) {
        this.engine.set_whammy(typeof msg.semitones === 'number' ? msg.semitones : 0);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || output.length === 0) return true;

    const outChan = output[0];
    const inChan = input && input.length > 0 && input[0].length > 0 ? input[0] : null;

    // Render around queued control events so they land at their exact frame
    // inside the 128-sample quantum. Older generated engines retain the
    // block-quantized compatibility path below.
    let renderedWithFrameApi = false;
    if (
      this.engine &&
      typeof this.engine.begin_chunk === 'function' &&
      typeof this.engine.process_frames === 'function'
    ) {
      this.engine.begin_chunk();
      let renderedFrames = 0;
      const blockEndTime = currentTime + outChan.length / sampleRate;
      while (
        this.scheduledEventIndex < this.scheduledEvents.length &&
        this.scheduledEvents[this.scheduledEventIndex].time <= blockEndTime
      ) {
        const event = this.scheduledEvents[this.scheduledEventIndex++];
        const eventFrame = Math.max(
          renderedFrames,
          Math.min(outChan.length, Math.round((event.time - currentTime) * sampleRate)),
        );
        if (eventFrame > renderedFrames) {
          this.engine.process_frames(eventFrame - renderedFrames);
          renderedFrames = eventFrame;
        }
        this.executeEvent(event);
      }
      if (renderedFrames < outChan.length) {
        this.engine.process_frames(outChan.length - renderedFrames);
      }
      renderedWithFrameApi = true;
    } else if (this.engine && this.scheduledEventIndex < this.scheduledEvents.length) {
      const blockEndTime = currentTime + outChan.length / sampleRate;
      while (
        this.scheduledEventIndex < this.scheduledEvents.length &&
        this.scheduledEvents[this.scheduledEventIndex].time <= blockEndTime
      ) {
        this.executeEvent(this.scheduledEvents[this.scheduledEventIndex++]);
      }
    }

    if (this.scheduledEventIndex === this.scheduledEvents.length) {
      this.scheduledEvents.length = 0;
      this.scheduledEventIndex = 0;
    }

    if (this.engine && !renderedWithFrameApi) {
      this.engine.process_chunk();
    }

    const pickups = this.wdf._params.pickups;
    const hasEngine = this.engine !== null && this.outBuffer !== null;
    const hasStringOutput = hasEngine && this.stringOutBuffer !== null;
    const len = outChan.length; // usually 128

    const pickupInputVoltages = this.wdf._pickupInputVoltages;
    const pickupCombDelaySamples = this.wdf._pickupCombDelaySamples;
    if (pickups.length > 0) {
      for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
        const pickup = pickups[pickupIndex];
        // Legacy topology data describes sensing delay in milliseconds.
        // Convert it once to an approximate normalized position, then track
        // each string's actual period instead of filtering the mono chord.
        const normalizedPosition = Math.max(
          0.02,
          Math.min(0.48, pickup.positionFraction ?? ((pickup.delayMs ?? 1.0) * 250) / 2000),
        );
        for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
          const stringFrequency =
            this.stringFreqs[stringIndex] > 20 ? this.stringFreqs[stringIndex] : 250;
          pickupCombDelaySamples[pickupIndex * 6 + stringIndex] = Math.max(
            1,
            (normalizedPosition * sampleRate) / stringFrequency,
          );
        }
      }
    }

    for (let i = 0; i < len; i++) {
      const rawWebAudio = inChan ? inChan[i] : 0;
      const rawWasm = hasEngine ? this.outBuffer[i] : 0;
      if (hasEngine && !hasStringOutput) {
        this.monoSynthDelayLine.write(rawWasm);
      }
      if (hasStringOutput) {
        for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
          this.stringDelayLines[stringIndex].write(this.stringOutBuffer[stringIndex * 128 + i]);
        }
      }

      if (pickups.length === 0) {
        let summedStrings = rawWasm;
        if (hasStringOutput) {
          summedStrings = 0;
          for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
            summedStrings += this.stringOutBuffer[stringIndex * 128 + i];
          }
        }
        pickupInputVoltages[0] = rawWebAudio + summedStrings;
      } else {
        for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
          const p = pickups[pickupIndex];
          // Real/multisample inputs already contain a pickup response, so they
          // enter as DI voltage. Synthetic strings are sensed independently
          // before their per-pickup voltages are summed.
          let pickupSig = rawWebAudio;
          if (hasStringOutput) {
            for (let stringIndex = 0; stringIndex < 6; stringIndex++) {
              const stringSample = this.stringOutBuffer[stringIndex * 128 + i];
              const delayed = this.stringDelayLines[stringIndex].readSamples(
                pickupCombDelaySamples[pickupIndex * 6 + stringIndex],
              );
              pickupSig += 0.5 * (stringSample - 0.4 * delayed);
            }
          } else if (hasEngine) {
            const delayed = this.monoSynthDelayLine.readSamples(
              Math.max(1, ((p.delayMs ?? 1.0) * sampleRate) / 1000),
            );
            pickupSig += 0.5 * (rawWasm - 0.4 * delayed);
          }
          const gain = p.blendGain ?? 1.0;
          // Phase inversion is applied by the WDF voltage source so the
          // pickups interfere inside the passive network.
          pickupInputVoltages[pickupIndex] = pickupSig * gain;
        }
      }

      // Pass the array of voltages to the WDF circuit model
      // The WDF circuit naturally handles parallel averaging and series boosting
      const wdfOut = this.wdf.processSample(pickupInputVoltages);

      // Pickup/harness processing ends here. Amp tone shaping and power-stage
      // dynamics live later in the Web Audio graph, at their physical points.
      outChan[i] = wdfOut;
    }

    // Copy to remaining channels (stereo)
    for (let channel = 1; channel < output.length; ++channel) {
      output[channel].set(outChan);
    }

    return true;
  }
}

/**
 * Allocation-free amp tone-stack stage. It is registered separately so the
 * main-thread graph can place it between the preamp and power amp instead of
 * filtering the guitar before distortion.
 */
export class ToneStackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.toneStack = new WdfToneStack(sampleRate);
    this.model = 'fender';
    this.bass = 0.5;
    this.mid = 0.5;
    this.treble = 0.5;
    this.toneStack.build(this.model);
    this.toneStack.setControls(this.bass, this.mid, this.treble, true);

    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.type !== 'tone-stack-update') return;
      if (msg.model && msg.model !== this.model) {
        this.model = msg.model;
        this.toneStack.build(this.model);
      }
      if (msg.bass !== undefined) this.bass = msg.bass;
      if (msg.mid !== undefined) this.mid = msg.mid;
      if (msg.treble !== undefined) this.treble = msg.treble;
      this.toneStack.setControls(this.bass, this.mid, this.treble);
    };
    this.port.postMessage({ type: 'ready' });
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outChan = output[0];
    const inChan = input && input.length > 0 ? input[0] : null;
    const length = outChan.length;
    if (inChan) {
      for (let i = 0; i < length; i++) {
        outChan[i] = this.toneStack.processSample(inChan[i]);
      }
    } else {
      outChan.fill(0);
    }

    for (let channel = 1; channel < output.length; channel++) {
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
    let readPtr = (this.ptr - delaySamples) % this.buffer.length;
    if (readPtr < 0) readPtr += this.buffer.length;
    const intPtr = Math.floor(readPtr);
    const frac = readPtr - intPtr;
    const idx1 = intPtr % this.buffer.length;
    const idx2 = (intPtr + 1) % this.buffer.length;
    return this.buffer[idx1] * (1 - frac) + this.buffer[idx2] * frac;
  }
}

registerProcessor('guitar-processor', GuitarProcessor);
registerProcessor('tone-stack-processor', ToneStackProcessor);
