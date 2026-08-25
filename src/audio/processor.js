import init, { DspEngine } from './wasm-pkg/dsp.js';

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
  waveReflect(_a) { return 0; }
  step(_a) {}
  reset() {}
}

/** WDF Voltage Source + Resistor: models a pickup generating voltage Vs */
export class WdfVoltageSourceResistor {
  constructor(resistance) {
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistance);
    this.Vs = 0;
  }
  setVoltage(Vs) { this.Vs = Vs; }
  waveReflect(_a) { return this.Vs; }
  step(_a) {}
  reset() { this.Vs = 0; }
}

/** WDF Capacitor (bilinear transform): R = T/(2C), state: b[n] = a[n-1] */
export class WdfCapacitor {
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
export class WdfInductor {
  constructor(inductanceHenries, sampleRate) {
    const T = 1 / sampleRate;
    this.portResistance = (2 * Math.max(1e-6, inductanceHenries)) / T;
    this._state = 0;
  }
  waveReflect(_a) { return -this._state; }
  step(a) { this._state = a; }
  reset() { this._state = 0; }
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
    return Math.max(
      MIN_PORT_RESISTANCE,
      this._maxR * applyPotTaper(this._position, this._taper)
    );
  }
  waveReflect(_a) { return 0; }
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
  reset() { this._c1.reset(); this._c2.reset(); this._b1 = 0; this._b2 = 0; }
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
  reset() { this._c1.reset(); this._c2.reset(); this._b1 = 0; this._b2 = 0; this._b0 = 0; }
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
      pickups: [{ inductanceH: 2.4, resistanceR: 6500, windingCapFarads: 120e-12, delayMs: 1.1, blendGain: 1.0, isOutofPhase: false }],
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
    this._buildTree();
  }

  _buildTree() {
    const p = this._params;
    const sr = this.sampleRate;
    const pickups = Array.isArray(p.pickups) && p.pickups.length > 0
      ? p.pickups
      : [{ resistanceR: 6500, inductanceH: 2.4, windingCapFarads: 120e-12, blendGain: 1, isOutofPhase: false }];

    this._pickupSources = [];
    this._pickupConfigs = pickups;
    this._pickupInputVoltages = new Float64Array(pickups.length);
    this._pickupCombDelaySamples = new Float64Array(pickups.length);
    this._seriesPickupSource = null;

    let currentPickupNode = null;
    if (p.isSeries && pickups.length > 1) {
      // Collapse series-connected pickups to their Thevenin equivalent. This
      // preserves summed source polarity without adaptor-depth sign changes.
      let totalResistance = 0;
      let totalInductance = 0;
      let inverseWindingCapacitance = 0;
      let hasDisabledWindingCapacitance = false;
      for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
        const pu = pickups[pickupIndex];
        const windingCapFarads = pu.windingCapFarads ?? 120e-12;
        totalResistance += pu.resistanceR;
        totalInductance += pu.inductanceH;
        if (windingCapFarads > 0) {
          inverseWindingCapacitance += 1 / windingCapFarads;
        } else {
          hasDisabledWindingCapacitance = true;
        }
      }

      this._seriesPickupSource = new WdfVoltageSourceResistor(totalResistance);
      this._pickupSources.push(this._seriesPickupSource);
      const seriesInductor = new WdfInductor(totalInductance, sr);
      const seriesRl = new WdfSeriesAdaptor(this._seriesPickupSource, seriesInductor);
      currentPickupNode = seriesRl;
      if (!hasDisabledWindingCapacitance && inverseWindingCapacitance > 0) {
        const equivalentWindingCap = new WdfCapacitor(1 / inverseWindingCapacitance, sr);
        currentPickupNode = new WdfParallelAdaptor(seriesRl, equivalentWindingCap);
      }
    } else {
      // Parallel pickups retain individual sources so their phase and delayed
      // string signals interfere inside the passive network.
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
        if (!currentPickupNode) {
          currentPickupNode = branch;
        } else {
          currentPickupNode = new WdfParallelAdaptor(currentPickupNode, branch);
        }
      }
    }
    this._pickupBranch = currentPickupNode;

    // Tone rheostat in series with its shunt capacitor.
    this._tonePot = new WdfPotentiometer(p.tonePotMaxR, p.tonePos, p.tonePotTaper || 'linear');
    this._toneCap = new WdfCapacitor(p.toneCapFarads, sr);
    this._toneBranch = new WdfSeriesAdaptor(this._tonePot, this._toneCap);

    // Three-terminal volume divider. The lower section is wiper-to-ground;
    // the complementary upper section is hot-to-wiper.
    const wiperFraction = applyPotTaper(p.volumePos, p.volumePotTaper || 'audio');
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
            (current.windingCapFarads ?? 120e-12) !==
              (next.windingCapFarads ?? 120e-12)
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
    if (p.trebleBleedCapFarads !== undefined && p.trebleBleedCapFarads !== this._params.trebleBleedCapFarads) {
      this._params.trebleBleedCapFarads = Math.max(0, p.trebleBleedCapFarads);
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
    if (p.volumePotTaper !== undefined && p.volumePotTaper !== this._params.volumePotTaper) {
      this._params.volumePotTaper = p.volumePotTaper;
      rebuild = true;
    }
    if (p.tonePotTaper !== undefined && p.tonePotTaper !== this._params.tonePotTaper) {
      this._params.tonePotTaper = p.tonePotTaper;
      rebuild = true;
    }

    // Pot positions can be updated live without rebuilding the tree
    if (p.volumePos !== undefined) {
      this._params.volumePos = Math.max(0, Math.min(1, p.volumePos));
      const wiperFraction = applyPotTaper(
        this._params.volumePos,
        this._params.volumePotTaper || 'audio'
      );
      if (this._volumeTopPot) this._volumeTopPot.setPosition(1 - wiperFraction);
      if (this._volumePot) this._volumePot.setPosition(wiperFraction);
    }
    if (p.tonePos !== undefined) {
      this._params.tonePos = Math.max(0, Math.min(1, p.tonePos));
      if (this._tonePot) this._tonePot.setPosition(this._params.tonePos);
    }

    // Structural changes (component values, not pot positions) require a
    // full tree rebuild because WDF port resistances propagate through adaptors
    if (rebuild) {
      this._buildTree();
    }
  }

  processSample(vin) {
    if (!this._root || !this._outputProbe) {
      return typeof vin === 'number' ? vin : vin[0] || 0;
    }

    if (this._seriesPickupSource) {
      let seriesVoltage = 0;
      for (let i = 0; i < this._pickupConfigs.length; i++) {
        const pu = this._pickupConfigs[i];
        const phase = pu && pu.isOutofPhase ? -1 : 1;
        const pickupVoltage = typeof vin === 'number' ? vin : vin[i] || 0;
        seriesVoltage += pickupVoltage * phase;
      }
      this._seriesPickupSource.setVoltage(seriesVoltage);
    } else if (typeof vin !== 'number') {
      for (let i = 0; i < this._pickupSources.length; i++) {
        const pu = this._pickupConfigs[i];
        const phase = pu && pu.isOutofPhase ? -1 : 1;
        this._pickupSources[i].setVoltage((vin[i] || 0) * phase);
      }
    } else {
      for (let i = 0; i < this._pickupSources.length; i++) {
        const pu = this._pickupConfigs[i];
        const phase = pu && pu.isOutofPhase ? -1 : 1;
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
// WDF Passive Tone Stack — coupled bass/mid/treble network
//
// Passive tone-stack loading where all three pots share one WDF network and
// therefore reshape one another instead of behaving like independent biquads.
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
  fender: 2.15,
  marshall: 1.65,
  mesa: 1.7,
  vox: 2.1,
};

export class WdfToneStack {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this._treblePot = null;
    this._bassPot = null;
    this._midPot = null;
    this._root = null;
    this._outputProbe = null;
    this._makeupGain = 2.0;
    this.build('fender');
  }

  build(model) {
    const c = TONE_STACK_MODELS[model] || TONE_STACK_MODELS.fender;
    this._makeupGain = TONE_STACK_MAKEUP_GAIN[model] ?? 2.0;
    const sr = this.sampleRate;

    this._treblePot = new WdfPotentiometer(c.R_treble_pot, 0.5, 'audio');
    const trebleCap = new WdfCapacitor(c.C_treble, sr);
    const trebleBranch = new WdfSeriesAdaptor(this._treblePot, trebleCap);

    this._bassPot = new WdfPotentiometer(c.R_bass_pot, 0.5, 'audio');
    const bassCap = new WdfCapacitor(c.C_bass, sr);
    const bassBranch = new WdfSeriesAdaptor(this._bassPot, bassCap);

    this._midPot = new WdfPotentiometer(c.R_mid_pot, 0.5, 'audio');
    const midCap = new WdfCapacitor(c.C_mid, sr);
    const midBranch = new WdfSeriesAdaptor(this._midPot, midCap);

    const loadR = new WdfResistor(c.R_load);
    const slopeR = new WdfResistor(c.R_slope);

    const midAndLoad = new WdfParallelAdaptor(midBranch, loadR);
    const bassAndMidLoad = new WdfParallelAdaptor(bassBranch, midAndLoad);
    const toneNetwork = new WdfParallelAdaptor(trebleBranch, bassAndMidLoad);
    this._outputProbe = new WdfVoltageProbe(toneNetwork);
    this._root = new WdfSeriesAdaptor(slopeR, this._outputProbe);
    this._autoCalibrateGain();
  }

  _autoCalibrateGain(probeFreq = 1000, numSamples = 4096) {
    if (!this._root || !this._outputProbe) return this._makeupGain;
    let inSumSq = 0;
    let outSumSq = 0;
    const settle = Math.floor(numSamples / 2);

    this._root.reset();
    for (let i = 0; i < numSamples; i++) {
      const vin = Math.sin((2 * Math.PI * probeFreq * i) / this.sampleRate);
      this._root.waveReflect(vin);
      this._root.step(vin);
      const rawOut = this._outputProbe.voltage;
      if (i >= settle) {
        inSumSq += vin * vin;
        outSumSq += rawOut * rawOut;
      }
    }
    this._root.reset();

    const count = numSamples - settle;
    const inRms = Math.sqrt(inSumSq / count);
    const outRms = Math.sqrt(outSumSq / count);
    if (outRms > 1e-6) {
      this._makeupGain = Math.min(64, Math.max(0.125, inRms / outRms));
    }
    return this._makeupGain;
  }

  setControls(bass, mid, treble) {
    if (this._bassPot) this._bassPot.setPosition(Math.max(0.001, bass));
    if (this._midPot) this._midPot.setPosition(Math.max(0.001, mid));
    if (this._treblePot) {
      const clampedTreble = Math.max(0, Math.min(1, treble));
      this._treblePot.setPosition(1 - clampedTreble);
    }
  }

  processSample(vin) {
    if (!this._root || !this._outputProbe) return vin;
    this._root.waveReflect(vin);
    this._root.step(vin);
    return this._outputProbe.voltage * this._makeupGain;
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
    this.scheduledEvents = [];
    this.scheduledEventIndex = 0;
    this.initializing = false;
    this.delayLine = new DelayLine(20, sampleRate);
    // Per-string frequency tracking for pitch-dependent pickup comb
    this.stringFreqs = new Float32Array(6);

    // Sag envelope follower state
    this.sagEnvelope = 0;
    this.sagAttackCoeff = Math.exp(-1 / (sampleRate * 0.010)); // 10ms attack
    this.sagReleaseCoeff = Math.exp(-1 / (sampleRate * 0.150)); // 150ms release
    this.sagAmount = 0.3;
    this.sagMessage = { type: 'sag-level', level: 0 };
    this.sagPostCountdown = 0;

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
      } else if (msg.type === 'whammy' && this.engine) {
        this.engine.set_whammy(typeof msg.semitones === 'number' ? msg.semitones : 0);
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!output || output.length === 0) return true;

    const outChan = output[0];
    const inChan = (input && input.length > 0 && input[0].length > 0) ? input[0] : null;

    // Process scheduled events due in this render quantum
    if (this.scheduledEventIndex < this.scheduledEvents.length) {
      const blockEndTime = currentTime + (outChan.length / sampleRate);
      while (
        this.scheduledEventIndex < this.scheduledEvents.length &&
        this.scheduledEvents[this.scheduledEventIndex].time <= blockEndTime
      ) {
        const ev = this.scheduledEvents[this.scheduledEventIndex++];
        this.executeEvent(ev);
      }
      if (this.scheduledEventIndex === this.scheduledEvents.length) {
        this.scheduledEvents.length = 0;
        this.scheduledEventIndex = 0;
      }
    }

    // Run WASM DSP engine chunk if active
    if (this.engine) {
      this.engine.process_chunk();
    }

    const pickups = this.wdf._params.pickups || [];

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

    const pickupInputVoltages = this.wdf._pickupInputVoltages;
    const pickupCombDelaySamples = this.wdf._pickupCombDelaySamples;
    if (pickups.length > 0) {
      const periodMs = 1000 / (lowestFreq > 20 ? lowestFreq : 250);
      for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
        const pickup = pickups[pickupIndex];
        const pickupPos = Math.max(
          0.02,
          Math.min(0.98, (pickup.delayMs || 1.0) / (2 * periodMs))
        );
        pickupCombDelaySamples[pickupIndex] = Math.max(
          1,
          2 * pickupPos * currentPeriodSamples
        );
      }
    }

    for (let i = 0; i < len; i++) {
      const rawWasm = hasEngine ? this.outBuffer[i] : 0;
      const rawWebAudio = inChan ? inChan[i] : 0;
      const rawSample = rawWebAudio + rawWasm;

      this.delayLine.write(rawSample);

      if (pickups.length === 0) {
        pickupInputVoltages[0] = rawSample;
      } else {
        for (let pickupIndex = 0; pickupIndex < pickups.length; pickupIndex++) {
          const p = pickups[pickupIndex];
          // Subtractive pickup comb: y[n] = 0.5 * (x[n] - k * x[n - d])
          // d = 2 * pickupPosition * N where N = period in samples for current pitch
          const delayed = this.delayLine.readSamples(pickupCombDelaySamples[pickupIndex]);
          const pickupSig = 0.5 * (rawSample - 0.4 * delayed);
          const gain = p.blendGain ?? 1.0;
          // Phase inversion is applied by the WDF voltage source so the
          // pickups interfere inside the passive network.
          pickupInputVoltages[pickupIndex] = pickupSig * gain;
        }
      }

      // Pass the array of voltages to the WDF circuit model
      // The WDF circuit naturally handles parallel averaging and series boosting
      let wdfOut = this.wdf.processSample(pickupInputVoltages);

      // Post-WDF polynomial magnetic saturation: models the pickup coil's
      // nonlinear response to large string displacement (magnetic saturation).
      // 3rd-order odd polynomial: y = x - k·x³  where k is small (default 0.015).
      // Adds subtle 2nd/3rd harmonic warmth at high velocity without audible
      // effect on clean playing.  Configurable via wdf-update pickupSaturation.
      const satK = this.wdf._params.pickupSaturation ?? 0.015;
      if (satK > 0) {
        wdfOut = wdfOut - satK * wdfOut * wdfOut * wdfOut;
      }

      // Route through the coupled passive tone stack (replaces independent biquads)
      const toneOut = this.toneStack.processSample(wdfOut);

      // Power-amp sag: envelope follower for bias modulation
      const absSample = Math.abs(wdfOut);
      const sagCoeff = absSample > this.sagEnvelope ? this.sagAttackCoeff : this.sagReleaseCoeff;
      this.sagEnvelope = sagCoeff * this.sagEnvelope + (1 - sagCoeff) * absSample;
      // Sag gain reduction: louder sustained signal → volume dips, recovers slowly
      const sagGainReduction = 1.0 - this.sagAmount * Math.min(1.0, this.sagEnvelope * 3.0);

      outChan[i] = toneOut * sagGainReduction;
    }

    // Reuse a message object and throttle feedback to avoid render-thread
    // allocation/clone pressure every 128-sample quantum.
    if (this.sagPostCountdown > 0) this.sagPostCountdown--;
    if (this.sagEnvelope > 0.001 && this.sagPostCountdown === 0) {
      this.sagMessage.level = this.sagEnvelope;
      this.port.postMessage(this.sagMessage);
      this.sagPostCountdown = 7;
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
