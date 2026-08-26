/**
 * Allocation-free passive amplifier tone-stack runtime shared by TypeScript
 * callers and the AudioWorklet.
 *
 * Fender/Marshall/Mesa tone stacks are bridge circuits, not reducible trees of
 * ordinary WDF series/parallel adaptors. This class applies trapezoidal nodal
 * analysis to their published five-node RC networks. The Vox model uses the
 * distinct AC30 Top Boost bass-pot connection and fixed 10 kOhm mid resistor.
 * The topology and labels follow David T. Yeh's 2009 dissertation, Figs. 2.2
 * through 2.4: Vi feeds C1 directly and feeds the C2/C3 node through R4. The
 * Mesa values are from the 3-channel Dual Rectifier preamp PT2 schematic.
 */

/** Published Blackface Twin, JCM800, Dual Rectifier, and AC30 values. */
export const TONE_STACK_COMPONENTS = Object.freeze({
  fender: Object.freeze({
    topology: 'fmv',
    R_slope: 100_000,
    C_treble: 250e-12,
    R_treble_pot: 250_000,
    C_bass: 100e-9,
    R_bass_pot: 250_000,
    C_mid: 47e-9,
    R_mid_pot: 10_000,
    R_load: 1_000_000,
  }),
  marshall: Object.freeze({
    topology: 'fmv',
    R_slope: 33_000,
    C_treble: 470e-12,
    R_treble_pot: 220_000,
    C_bass: 22e-9,
    R_bass_pot: 1_000_000,
    C_mid: 22e-9,
    R_mid_pot: 22_000,
    R_load: 1_000_000,
  }),
  mesa: Object.freeze({
    topology: 'fmv',
    R_slope: 47_000,
    C_treble: 500e-12,
    R_treble_pot: 250_000,
    C_bass: 20e-9,
    R_bass_pot: 1_000_000,
    C_mid: 20e-9,
    R_mid_pot: 25_000,
    R_load: 1_000_000,
  }),
  vox: Object.freeze({
    topology: 'vox',
    R_slope: 100_000,
    C_treble: 50e-12,
    R_treble_pot: 1_000_000,
    C_bass: 22e-9,
    R_bass_pot: 1_000_000,
    C_mid: 22e-9,
    R_mid_pot: 10_000,
    R_load: 1_000_000,
  }),
});

/** Fixed recovery that retains insertion loss and nonlinear-stage headroom. */
export const TONE_STACK_MAKEUP_GAIN = Object.freeze({
  fender: 2.15,
  marshall: 1.65,
  mesa: 1.7,
  vox: 2.1,
});

const NODE_COUNT = 5;
const NODE_SLOPE = 0;
const NODE_TREBLE_TOP = 1;
const NODE_OUTPUT = 2;
const NODE_BASS_TOP = 3;
const NODE_MID = 4;
const CAP_COUNT = 3;
const MIN_RESISTANCE = 0.01;
const DEFAULT_SMOOTHING_MS = 12;
const CONTROL_EPSILON = 1e-7;

function clampControl(value) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

/** Approximation of the audio taper used by the bass pots in these circuits. */
export function toneStackAudioTaper(position) {
  const clamped = clampControl(position);
  return clamped * clamped;
}

function safeResistance(value) {
  return Math.max(MIN_RESISTANCE, value);
}

/**
 * Compatibility name retained for existing callers. Internally this is an
 * exact trapezoidal nodal solve rather than a reducible WDF adaptor tree.
 */
export class WdfToneStackSolver {
  sampleRate;
  model = 'fender';
  components = TONE_STACK_COMPONENTS.fender;
  makeupGain = TONE_STACK_MAKEUP_GAIN.fender;
  built = false;

  bass = 0.5;
  mid = 0.5;
  treble = 0.5;
  targetBass = 0.5;
  targetMid = 0.5;
  targetTreble = 0.5;
  smoothingAlpha = 1;

  // Retained buffers keep processSample allocation-free.
  baseMatrix = new Float64Array(NODE_COUNT * NODE_COUNT);
  solveMatrix = new Float64Array(NODE_COUNT * NODE_COUNT);
  rhs = new Float64Array(NODE_COUNT);
  voltage = new Float64Array(NODE_COUNT);

  // C1: input->treble top, C2: slope->bass top, C3: slope->mid.
  capacitorG = new Float64Array(CAP_COUNT);
  capacitorVoltage = new Float64Array(CAP_COUNT);
  capacitorCurrent = new Float64Array(CAP_COUNT);
  capacitorHistory = new Float64Array(CAP_COUNT);

  slopeConductance = 0;

  constructor(sampleRate = 48_000) {
    this.sampleRate = Math.max(1, sampleRate);
    this.setSmoothingTime(DEFAULT_SMOOTHING_MS);
  }

  build(model) {
    this.model = TONE_STACK_COMPONENTS[model] ? model : 'fender';
    this.components = TONE_STACK_COMPONENTS[this.model];
    this.makeupGain = TONE_STACK_MAKEUP_GAIN[this.model];
    this.slopeConductance = 1 / safeResistance(this.components.R_slope);

    const capacitorScale = 2 * this.sampleRate;
    this.capacitorG[0] = this.components.C_treble * capacitorScale;
    this.capacitorG[1] = this.components.C_bass * capacitorScale;
    this.capacitorG[2] = this.components.C_mid * capacitorScale;

    this.built = true;
    this.reset();
    this.updateBaseMatrix();
  }

  /**
   * Set target knob positions. Changes are one-pole smoothed in processSample.
   * Pass immediate=true for offline setup or deterministic measurements.
   */
  setControls(bass, mid, treble, immediate = false) {
    this.targetBass = clampControl(bass);
    // A real AC30 Top Boost has no mid potentiometer.
    this.targetMid = this.components.topology === 'vox' ? this.mid : clampControl(mid);
    this.targetTreble = clampControl(treble);

    if (immediate) {
      this.bass = this.targetBass;
      this.mid = this.targetMid;
      this.treble = this.targetTreble;
      if (this.built) this.updateBaseMatrix();
    }
  }

  /** Configure control smoothing. Zero milliseconds applies on the next sample. */
  setSmoothingTime(milliseconds) {
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      this.smoothingAlpha = 1;
      return;
    }
    const seconds = milliseconds * 0.001;
    this.smoothingAlpha = 1 - Math.exp(-1 / (seconds * this.sampleRate));
  }

  processSample(vin) {
    if (!this.built) return vin;

    this.smoothControls();
    this.solveMatrix.set(this.baseMatrix);
    this.rhs.fill(0);

    // Source resistor from the known input node to NODE_SLOPE.
    this.rhs[NODE_SLOPE] += this.slopeConductance * vin;

    // Trapezoidal capacitor companion histories:
    // i[n] = G * v[n] + I_history, positive first node -> second node.
    for (let index = 0; index < CAP_COUNT; index++) {
      this.capacitorHistory[index] =
        -this.capacitorG[index] * this.capacitorVoltage[index] - this.capacitorCurrent[index];
    }

    // C1 is input -> treble-top. C2 and C3 are slope -> bass/mid.
    this.rhs[NODE_TREBLE_TOP] += this.capacitorG[0] * vin + this.capacitorHistory[0];
    this.rhs[NODE_SLOPE] -= this.capacitorHistory[1] + this.capacitorHistory[2];
    this.rhs[NODE_BASS_TOP] += this.capacitorHistory[1];
    this.rhs[NODE_MID] += this.capacitorHistory[2];

    this.solveLinearSystem();
    this.updateCapacitorStates(vin);

    return this.voltage[NODE_OUTPUT] * this.makeupGain;
  }

  processBuffer(input, output) {
    const length = Math.min(input.length, output.length);
    for (let index = 0; index < length; index++) {
      output[index] = this.processSample(input[index]);
    }
  }

  reset() {
    this.voltage.fill(0);
    this.rhs.fill(0);
    this.capacitorVoltage.fill(0);
    this.capacitorCurrent.fill(0);
    this.capacitorHistory.fill(0);
  }

  getModel() {
    return this.model;
  }

  getMakeupGain() {
    return this.makeupGain;
  }

  smoothControls() {
    let changed = false;

    const bassDelta = this.targetBass - this.bass;
    if (Math.abs(bassDelta) > CONTROL_EPSILON) {
      this.bass += bassDelta * this.smoothingAlpha;
      changed = true;
    } else if (bassDelta !== 0) {
      this.bass = this.targetBass;
      changed = true;
    }

    const midDelta = this.targetMid - this.mid;
    if (Math.abs(midDelta) > CONTROL_EPSILON) {
      this.mid += midDelta * this.smoothingAlpha;
      changed = true;
    } else if (midDelta !== 0) {
      this.mid = this.targetMid;
      changed = true;
    }

    const trebleDelta = this.targetTreble - this.treble;
    if (Math.abs(trebleDelta) > CONTROL_EPSILON) {
      this.treble += trebleDelta * this.smoothingAlpha;
      changed = true;
    } else if (trebleDelta !== 0) {
      this.treble = this.targetTreble;
      changed = true;
    }

    if (changed) this.updateBaseMatrix();
  }

  updateBaseMatrix() {
    const c = this.components;
    const matrix = this.baseMatrix;
    matrix.fill(0);

    // Input-source resistor; the known input contribution goes into the RHS.
    matrix[NODE_SLOPE * NODE_COUNT + NODE_SLOPE] += this.slopeConductance;

    this.stampConductanceToKnown(NODE_TREBLE_TOP, this.capacitorG[0]);
    this.stampConductance(NODE_SLOPE, NODE_BASS_TOP, this.capacitorG[1]);
    this.stampConductance(NODE_SLOPE, NODE_MID, this.capacitorG[2]);

    // At maximum treble the three-terminal pot wiper approaches C1.
    const trebleTop = safeResistance((1 - this.treble) * c.R_treble_pot);
    const trebleBottom = safeResistance(this.treble * c.R_treble_pot);
    this.stampConductance(NODE_TREBLE_TOP, NODE_OUTPUT, 1 / trebleTop);
    this.stampConductance(NODE_OUTPUT, NODE_BASS_TOP, 1 / trebleBottom);

    const bassFraction = toneStackAudioTaper(this.bass);
    this.stampConductance(NODE_BASS_TOP, NODE_MID, 1 / safeResistance(bassFraction * c.R_bass_pot));

    if (c.topology === 'vox') {
      // Top Boost: lower bass-pot segment and fixed 10 kOhm resistor both
      // shunt the bass wiper. There is intentionally no mid control.
      this.stampConductanceToKnown(NODE_MID, 1 / safeResistance((1 - bassFraction) * c.R_bass_pot));
      this.stampConductanceToKnown(NODE_MID, 1 / safeResistance(c.R_mid_pot));
    } else {
      this.stampConductanceToKnown(NODE_MID, 1 / safeResistance(this.mid * c.R_mid_pot));
    }

    // Grid/master load, also ensuring a strictly positive-definite matrix.
    this.stampConductanceToKnown(NODE_OUTPUT, 1 / safeResistance(c.R_load));
  }

  stampConductance(left, right, conductance) {
    const matrix = this.baseMatrix;
    matrix[left * NODE_COUNT + left] += conductance;
    matrix[right * NODE_COUNT + right] += conductance;
    matrix[left * NODE_COUNT + right] -= conductance;
    matrix[right * NODE_COUNT + left] -= conductance;
  }

  stampConductanceToKnown(node, conductance) {
    this.baseMatrix[node * NODE_COUNT + node] += conductance;
  }

  /** Gaussian elimination without pivoting; the passive RC matrix is SPD. */
  solveLinearSystem() {
    const matrix = this.solveMatrix;
    const rhs = this.rhs;

    for (let pivotIndex = 0; pivotIndex < NODE_COUNT; pivotIndex++) {
      const pivot = matrix[pivotIndex * NODE_COUNT + pivotIndex];
      for (let row = pivotIndex + 1; row < NODE_COUNT; row++) {
        const factor = matrix[row * NODE_COUNT + pivotIndex] / pivot;
        matrix[row * NODE_COUNT + pivotIndex] = 0;
        for (let column = pivotIndex + 1; column < NODE_COUNT; column++) {
          matrix[row * NODE_COUNT + column] -= factor * matrix[pivotIndex * NODE_COUNT + column];
        }
        rhs[row] -= factor * rhs[pivotIndex];
      }
    }

    for (let row = NODE_COUNT - 1; row >= 0; row--) {
      let sum = rhs[row];
      for (let column = row + 1; column < NODE_COUNT; column++) {
        sum -= matrix[row * NODE_COUNT + column] * this.voltage[column];
      }
      this.voltage[row] = sum / matrix[row * NODE_COUNT + row];
    }
  }

  updateCapacitorStates(vin) {
    const c1Voltage = vin - this.voltage[NODE_TREBLE_TOP];
    const c2Voltage = this.voltage[NODE_SLOPE] - this.voltage[NODE_BASS_TOP];
    const c3Voltage = this.voltage[NODE_SLOPE] - this.voltage[NODE_MID];

    this.capacitorVoltage[0] = c1Voltage;
    this.capacitorVoltage[1] = c2Voltage;
    this.capacitorVoltage[2] = c3Voltage;
    this.capacitorCurrent[0] = this.capacitorG[0] * c1Voltage + this.capacitorHistory[0];
    this.capacitorCurrent[1] = this.capacitorG[1] * c2Voltage + this.capacitorHistory[1];
    this.capacitorCurrent[2] = this.capacitorG[2] * c3Voltage + this.capacitorHistory[2];
  }
}

/** AudioWorklet-friendly short name; both exports reference the same class. */
export { WdfToneStackSolver as WdfToneStack };
