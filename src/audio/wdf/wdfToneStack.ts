/**
 * wdfToneStack.ts — WDF Passive Tone Stack Solver
 *
 * Implements passive tone-stack loading with Wave Digital Filter adaptor
 * trees. Unlike independent biquad EQ bands, all three controls share one
 * network, so changing one control reshapes the other bands as well.
 *
 * Topology (Fender/Marshall type):
 *   input → R_slope → shared output junction
 *   junction → (treble pot + C_treble) → ground
 *   junction → (bass pot + C_bass) → ground
 *   junction → (mid pot + C_mid) → ground
 *   junction → R_load → ground
 */

import {
  type WdfElement,
  WdfResistor,
  WdfCapacitor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfParallelAdaptor,
  WdfVoltageProbe,
} from './wdfNodes';

export type ToneStackModel = 'fender' | 'marshall' | 'mesa' | 'vox';

/**
 * Real component values for passive tone stacks.
 * These are the actual resistor/capacitor values from published schematics.
 */
export interface ToneStackComponents {
  R_slope: number; // Series slope resistor (Ω)
  C_treble: number; // Treble capacitor (F)
  R_treble_pot: number; // Treble pot max resistance (Ω)
  C_bass: number; // Bass capacitor (F)
  R_bass_pot: number; // Bass pot max resistance (Ω)
  C_mid: number; // Mid capacitor (F)
  R_mid_pot: number; // Mid pot max resistance (Ω)
  R_load: number; // Load resistance (Ω) — next stage input impedance
}

export const TONE_STACK_COMPONENTS: Record<ToneStackModel, ToneStackComponents> = {
  // Fender Blackface / Twin Reverb style
  // Classic mid-scoop: 250k treble/bass pots, 25k mid pot
  fender: {
    R_slope: 100000, // 100kΩ
    C_treble: 250e-12, // 250pF
    R_treble_pot: 250000, // 250kΩ
    C_bass: 100e-9, // 0.1µF
    R_bass_pot: 250000, // 250kΩ
    C_mid: 47e-9, // 0.047µF  (mid scoop cap)
    R_mid_pot: 25000, // 25kΩ
    R_load: 1000000, // 1MΩ next-stage grid leak
  },
  // Marshall JCM800 style
  // Aggressive mid-presence, 500k pots
  marshall: {
    R_slope: 33000, // 33kΩ
    C_treble: 470e-12, // 470pF
    R_treble_pot: 220000, // 220kΩ (log taper)
    C_bass: 22e-9, // 0.022µF
    R_bass_pot: 1000000, // 1MΩ
    C_mid: 22e-9, // 0.022µF
    R_mid_pot: 25000, // 25kΩ
    R_load: 470000, // 470kΩ
  },
  // Mesa Boogie Rectifier–inspired: deep V-scoop, tight low end, sizzling highs.
  mesa: {
    R_slope: 39000,
    C_treble: 500e-12,
    R_treble_pot: 250000,
    C_bass: 22e-9,
    R_bass_pot: 250000,
    C_mid: 47e-9,
    R_mid_pot: 20000,
    R_load: 470000,
  },
  // Vox AC30 Top Boost style
  // Warm midrange, treble-cut character
  vox: {
    R_slope: 100000, // 100kΩ
    C_treble: 100e-12, // 100pF
    R_treble_pot: 1000000, // 1MΩ
    C_bass: 47e-9, // 0.047µF
    R_bass_pot: 1000000, // 1MΩ
    C_mid: 22e-9, // 0.022µF
    R_mid_pot: 50000, // 50kΩ
    R_load: 1000000, // 1MΩ
  },
};

export const TONE_STACK_MAKEUP_GAIN: Record<ToneStackModel, number> = {
  fender: 2.15,
  marshall: 1.65,
  mesa: 1.7,
  vox: 2.1,
};

export class WdfToneStackSolver {
  private root: WdfElement | null = null;
  private treblePot: WdfPotentiometer | null = null;
  private bassPot: WdfPotentiometer | null = null;
  private midPot: WdfPotentiometer | null = null;
  private outputProbe: WdfVoltageProbe | null = null;
  private sampleRate: number;
  private model: ToneStackModel = 'fender';
  private makeupGain = 2.0;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Build the WDF adaptor tree for the given tone-stack model.
   */
  build(model: ToneStackModel): void {
    this.model = model;
    const c = TONE_STACK_COMPONENTS[model] || TONE_STACK_COMPONENTS.fender;
    this.makeupGain = TONE_STACK_MAKEUP_GAIN[model] ?? 2.0;
    const sr = this.sampleRate;

    // Treble path: treble pot (audio taper) → treble cap → ground
    this.treblePot = new WdfPotentiometer(c.R_treble_pot, 0.5, 'audio');
    const trebleCap = new WdfCapacitor(c.C_treble, sr);
    const trebleBranch = new WdfSeriesAdaptor(this.treblePot, trebleCap);

    // Bass path: bass pot (audio taper) → bass cap → ground
    this.bassPot = new WdfPotentiometer(c.R_bass_pot, 0.5, 'audio');
    const bassCap = new WdfCapacitor(c.C_bass, sr);
    const bassBranch = new WdfSeriesAdaptor(this.bassPot, bassCap);

    // Mid path: mid pot (audio taper) → mid cap → ground
    this.midPot = new WdfPotentiometer(c.R_mid_pot, 0.5, 'audio');
    const midCap = new WdfCapacitor(c.C_mid, sr);
    const midBranch = new WdfSeriesAdaptor(this.midPot, midCap);

    // Load resistor (next stage input impedance)
    const loadR = new WdfResistor(c.R_load);

    // Slope resistor (input coupling)
    const slopeR = new WdfResistor(c.R_slope);

    // Build the coupled network:
    // Mid + Load in parallel (they both go to ground from the output node)
    const midAndLoad = new WdfParallelAdaptor(midBranch, loadR);

    // Bass branch in parallel with (mid + load)
    const bassAndMidLoad = new WdfParallelAdaptor(bassBranch, midAndLoad);

    // Treble branch in parallel with the bass+mid+load group
    const toneNetwork = new WdfParallelAdaptor(trebleBranch, bassAndMidLoad);
    this.outputProbe = new WdfVoltageProbe(toneNetwork);

    // Series with the slope resistor to form the input
    this.root = new WdfSeriesAdaptor(slopeR, this.outputProbe);
    this.autoCalibrateGain();
  }

  /**
   * Auto-calibrate makeup gain to normalize insertion loss at 1 kHz with neutral controls
   */
  private autoCalibrateGain(probeFreq = 1000, numSamples = 4096): number {
    if (!this.root || !this.outputProbe) return this.makeupGain;
    let inSumSq = 0;
    let outSumSq = 0;
    const settle = Math.floor(numSamples / 2);

    this.root.reset();
    for (let i = 0; i < numSamples; i++) {
      const vin = Math.sin((2 * Math.PI * probeFreq * i) / this.sampleRate);
      this.root.waveReflect(vin);
      this.root.step(vin);
      const rawOut = this.outputProbe.voltage;

      if (i >= settle) {
        inSumSq += vin * vin;
        outSumSq += rawOut * rawOut;
      }
    }
    this.root.reset();

    const inRms = Math.sqrt(inSumSq / (numSamples - settle));
    const outRms = Math.sqrt(outSumSq / (numSamples - settle));
    if (outRms > 1e-6) {
      this.makeupGain = Math.min(64, Math.max(0.125, inRms / outRms));
    }
    return this.makeupGain;
  }

  /**
   * Update tone control positions (0–1 each).
   * Because the pots share the same network, changing one affects the
   * frequency response of the others — this is the coupled behavior that
   * independent biquads can't reproduce.
   */
  setControls(bass: number, mid: number, treble: number): void {
    if (this.bassPot) this.bassPot.setPosition(Math.max(0.001, bass));
    if (this.midPot) this.midPot.setPosition(Math.max(0.001, mid));
    // The treble control's schematic lugs run opposite the UI's clockwise
    // convention: maximum treble corresponds to minimum series resistance.
    if (this.treblePot) {
      const clampedTreble = Math.max(0, Math.min(1, treble));
      this.treblePot.setPosition(1 - clampedTreble);
    }
  }

  /**
   * Process a single sample through the tone stack.
   */
  processSample(vin: number): number {
    if (!this.root || !this.outputProbe) return vin;

    this.root.waveReflect(vin);
    this.root.step(vin);

    // Output voltage at the load, compensated for insertion loss
    return this.outputProbe.voltage * this.makeupGain;
  }

  /**
   * Process a buffer of audio samples.
   */
  processBuffer(input: Float32Array, output: Float32Array): void {
    for (let i = 0; i < input.length; i++) {
      output[i] = this.processSample(input[i]);
    }
  }

  reset(): void {
    if (this.root) {
      this.root.reset();
    }
  }

  getModel(): ToneStackModel {
    return this.model;
  }
}
