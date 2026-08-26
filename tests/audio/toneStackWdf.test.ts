/**
 * Passive amplifier tone-stack verification.
 *
 * The time-domain implementation is checked against an independent complex
 * AC nodal solve of the published analogue schematics. Trapezoidal integration
 * is a bilinear transform, so the analogue reference is evaluated at the
 * corresponding warped frequency.
 */
import { describe, expect, it } from 'vitest';
import {
  TONE_STACK_COMPONENTS,
  TONE_STACK_MAKEUP_GAIN,
  WdfToneStack,
  WdfToneStackSolver,
  toneStackAudioTaper,
  type ToneStackComponents,
  type ToneStackModel,
} from '../../src/audio/wdf/wdfToneStack';

const SAMPLE_RATE = 48_000;
const NODE_COUNT = 5;
const SLOPE = 0;
const TREBLE_TOP = 1;
const OUTPUT = 2;
const BASS_TOP = 3;
const MID = 4;
const MIN_R = 0.01;
const MODELS: ToneStackModel[] = ['fender', 'marshall', 'mesa', 'vox'];

interface Complex {
  re: number;
  im: number;
}

function complex(re = 0, im = 0): Complex {
  return { re, im };
}

function subtract(left: Complex, right: Complex): Complex {
  return complex(left.re - right.re, left.im - right.im);
}

function multiply(left: Complex, right: Complex): Complex {
  return complex(left.re * right.re - left.im * right.im, left.re * right.im + left.im * right.re);
}

function divide(left: Complex, right: Complex): Complex {
  const denominator = right.re * right.re + right.im * right.im;
  return complex(
    (left.re * right.re + left.im * right.im) / denominator,
    (left.im * right.re - left.re * right.im) / denominator,
  );
}

function magnitude(value: Complex): number {
  return Math.hypot(value.re, value.im);
}

function matrixIndex(row: number, column: number): number {
  return row * NODE_COUNT + column;
}

function accumulate(target: Complex, value: Complex): void {
  target.re += value.re;
  target.im += value.im;
}

function stampBetween(matrix: Complex[], left: number, right: number, y: Complex): void {
  accumulate(matrix[matrixIndex(left, left)], y);
  accumulate(matrix[matrixIndex(right, right)], y);
  accumulate(matrix[matrixIndex(left, right)], complex(-y.re, -y.im));
  accumulate(matrix[matrixIndex(right, left)], complex(-y.re, -y.im));
}

/** Stamp a branch from a known voltage to an unknown node. */
function stampKnown(
  matrix: Complex[],
  rhs: Complex[],
  node: number,
  y: Complex,
  knownVoltage: number,
): void {
  accumulate(matrix[matrixIndex(node, node)], y);
  accumulate(rhs[node], complex(y.re * knownVoltage, y.im * knownVoltage));
}

function solveComplex(matrix: Complex[], rhs: Complex[]): Complex[] {
  for (let pivotIndex = 0; pivotIndex < NODE_COUNT; pivotIndex++) {
    let pivotRow = pivotIndex;
    let pivotMagnitude = magnitude(matrix[matrixIndex(pivotIndex, pivotIndex)]);
    for (let row = pivotIndex + 1; row < NODE_COUNT; row++) {
      const candidate = magnitude(matrix[matrixIndex(row, pivotIndex)]);
      if (candidate > pivotMagnitude) {
        pivotMagnitude = candidate;
        pivotRow = row;
      }
    }

    if (pivotRow !== pivotIndex) {
      for (let column = 0; column < NODE_COUNT; column++) {
        const left = matrixIndex(pivotIndex, column);
        const right = matrixIndex(pivotRow, column);
        [matrix[left], matrix[right]] = [matrix[right], matrix[left]];
      }
      [rhs[pivotIndex], rhs[pivotRow]] = [rhs[pivotRow], rhs[pivotIndex]];
    }

    const pivot = matrix[matrixIndex(pivotIndex, pivotIndex)];
    for (let row = pivotIndex + 1; row < NODE_COUNT; row++) {
      const factor = divide(matrix[matrixIndex(row, pivotIndex)], pivot);
      for (let column = pivotIndex; column < NODE_COUNT; column++) {
        const index = matrixIndex(row, column);
        matrix[index] = subtract(
          matrix[index],
          multiply(factor, matrix[matrixIndex(pivotIndex, column)]),
        );
      }
      rhs[row] = subtract(rhs[row], multiply(factor, rhs[pivotIndex]));
    }
  }

  const solution = Array.from({ length: NODE_COUNT }, () => complex());
  for (let row = NODE_COUNT - 1; row >= 0; row--) {
    let value = rhs[row];
    for (let column = row + 1; column < NODE_COUNT; column++) {
      value = subtract(value, multiply(matrix[matrixIndex(row, column)], solution[column]));
    }
    solution[row] = divide(value, matrix[matrixIndex(row, row)]);
  }
  return solution;
}

function safeResistance(value: number): number {
  return Math.max(MIN_R, value);
}

/** Independent continuous-time AC solve of the published five-node circuit. */
function analogueGain(
  components: ToneStackComponents,
  frequency: number,
  bass: number,
  mid: number,
  treble: number,
): number {
  const matrix = Array.from({ length: NODE_COUNT * NODE_COUNT }, () => complex());
  const rhs = Array.from({ length: NODE_COUNT }, () => complex());
  const resistor = (resistance: number) => complex(1 / safeResistance(resistance), 0);
  const capacitor = (capacitance: number) => complex(0, 2 * Math.PI * frequency * capacitance);

  stampKnown(matrix, rhs, SLOPE, resistor(components.R_slope), 1);
  stampKnown(matrix, rhs, TREBLE_TOP, capacitor(components.C_treble), 1);
  stampBetween(matrix, SLOPE, BASS_TOP, capacitor(components.C_bass));
  stampBetween(matrix, SLOPE, MID, capacitor(components.C_mid));

  stampBetween(matrix, TREBLE_TOP, OUTPUT, resistor((1 - treble) * components.R_treble_pot));
  stampBetween(matrix, OUTPUT, BASS_TOP, resistor(treble * components.R_treble_pot));

  const bassFraction = toneStackAudioTaper(bass);
  stampBetween(matrix, BASS_TOP, MID, resistor(bassFraction * components.R_bass_pot));

  if (components.topology === 'vox') {
    stampKnown(matrix, rhs, MID, resistor((1 - bassFraction) * components.R_bass_pot), 0);
    stampKnown(matrix, rhs, MID, resistor(components.R_mid_pot), 0);
  } else {
    stampKnown(matrix, rhs, MID, resistor(mid * components.R_mid_pot), 0);
  }
  stampKnown(matrix, rhs, OUTPUT, resistor(components.R_load), 0);

  return magnitude(solveComplex(matrix, rhs)[OUTPUT]);
}

function measureDigitalGain(
  model: ToneStackModel,
  frequency: number,
  bass: number,
  mid: number,
  treble: number,
): number {
  const solver = new WdfToneStackSolver(SAMPLE_RATE);
  solver.build(model);
  solver.setControls(bass, mid, treble, true);

  const settleSamples = Math.round(SAMPLE_RATE * 0.3);
  const measureSamples = Math.round(SAMPLE_RATE * 0.4);
  let inputReal = 0;
  let inputImag = 0;
  let outputReal = 0;
  let outputImag = 0;

  for (let index = 0; index < settleSamples + measureSamples; index++) {
    const phase = (2 * Math.PI * frequency * index) / SAMPLE_RATE;
    const input = Math.cos(phase);
    const output = solver.processSample(input);
    if (index >= settleSamples) {
      const cosine = Math.cos(phase);
      const sine = Math.sin(phase);
      inputReal += input * cosine;
      inputImag -= input * sine;
      outputReal += output * cosine;
      outputImag -= output * sine;
    }
  }

  return Math.hypot(outputReal, outputImag) / Math.hypot(inputReal, inputImag);
}

function db(gain: number): number {
  return 20 * Math.log10(gain);
}

describe('physical passive amplifier tone stacks', () => {
  it('shares one runtime class between the worklet and TypeScript entry points', () => {
    expect(WdfToneStack).toBe(WdfToneStackSolver);
  });

  it('uses the published Fender, JCM800, Dual Rectifier, and AC30 component sets', () => {
    expect(TONE_STACK_COMPONENTS).toEqual({
      fender: {
        topology: 'fmv',
        R_slope: 100_000,
        C_treble: 250e-12,
        R_treble_pot: 250_000,
        C_bass: 100e-9,
        R_bass_pot: 250_000,
        C_mid: 47e-9,
        R_mid_pot: 10_000,
        R_load: 1_000_000,
      },
      marshall: {
        topology: 'fmv',
        R_slope: 33_000,
        C_treble: 470e-12,
        R_treble_pot: 220_000,
        C_bass: 22e-9,
        R_bass_pot: 1_000_000,
        C_mid: 22e-9,
        R_mid_pot: 22_000,
        R_load: 1_000_000,
      },
      mesa: {
        topology: 'fmv',
        R_slope: 47_000,
        C_treble: 500e-12,
        R_treble_pot: 250_000,
        C_bass: 20e-9,
        R_bass_pot: 1_000_000,
        C_mid: 20e-9,
        R_mid_pot: 25_000,
        R_load: 1_000_000,
      },
      vox: {
        topology: 'vox',
        R_slope: 100_000,
        C_treble: 50e-12,
        R_treble_pot: 1_000_000,
        C_bass: 22e-9,
        R_bass_pot: 1_000_000,
        C_mid: 22e-9,
        R_mid_pot: 10_000,
        R_load: 1_000_000,
      },
    });
  });

  it('matches an independent analogue AC solve after bilinear frequency warping', () => {
    const cases: Array<[ToneStackModel, number, number, number, number]> = [
      ['fender', 80, 0.7, 0.4, 0.6],
      ['fender', 5_000, 0.2, 0.8, 0.9],
      ['marshall', 250, 0.85, 0.25, 0.55],
      ['marshall', 7_000, 0.4, 0.7, 0.15],
      ['mesa', 700, 0.55, 0.1, 0.65],
      ['mesa', 4_000, 0.3, 0.9, 0.8],
      ['vox', 120, 0.8, 0.1, 0.4],
      ['vox', 6_000, 0.25, 0.9, 0.85],
    ];

    for (const [model, frequency, bass, mid, treble] of cases) {
      const warpedFrequency =
        (SAMPLE_RATE / Math.PI) * Math.tan((Math.PI * frequency) / SAMPLE_RATE);
      const expected =
        analogueGain(TONE_STACK_COMPONENTS[model], warpedFrequency, bass, mid, treble) *
        TONE_STACK_MAKEUP_GAIN[model];
      const actual = measureDigitalGain(model, frequency, bass, mid, treble);
      expect(db(actual / expected), `${model} at ${frequency} Hz`).toBeCloseTo(0, 1);
    }
  });

  it('uses fixed, headroom-aware recovery instead of runtime unity calibration', () => {
    expect(TONE_STACK_MAKEUP_GAIN).toEqual({
      fender: 2.15,
      marshall: 1.65,
      mesa: 1.7,
      vox: 2.1,
    });

    for (const model of MODELS) {
      const solver = new WdfToneStackSolver(SAMPLE_RATE);
      solver.build(model);
      expect(solver.getMakeupGain()).toBe(TONE_STACK_MAKEUP_GAIN[model]);
      expect(
        db(measureDigitalGain(model, 1_000, 0.5, 0.5, 0.5)),
        `${model} retains insertion loss`,
      ).toBeLessThan(-4);
    }
  });

  it('gives every FMV control a strong response in its intended band', () => {
    for (const model of ['fender', 'marshall', 'mesa'] as const) {
      const bassCut = measureDigitalGain(model, 80, 0.05, 0.5, 0.5);
      const bassBoost = measureDigitalGain(model, 80, 0.95, 0.5, 0.5);
      const midCut = measureDigitalGain(model, 500, 0.5, 0.05, 0.5);
      const midBoost = measureDigitalGain(model, 500, 0.5, 0.95, 0.5);
      const trebleCut = measureDigitalGain(model, 5_000, 0.5, 0.5, 0.05);
      const trebleBoost = measureDigitalGain(model, 5_000, 0.5, 0.5, 0.95);

      expect(db(bassBoost / bassCut), `${model} bass range`).toBeGreaterThan(8);
      expect(db(midBoost / midCut), `${model} mid range`).toBeGreaterThan(3.5);
      expect(db(trebleBoost / trebleCut), `${model} treble range`).toBeGreaterThan(8);
    }
  });

  it('models the Vox bass pot as three-terminal and its mid resistor as fixed', () => {
    const lowBassLow = measureDigitalGain('vox', 100, 0.05, 0.1, 0.5);
    const highBassLow = measureDigitalGain('vox', 100, 0.95, 0.1, 0.5);
    expect(db(highBassLow / lowBassLow)).toBeGreaterThan(8);

    const lowMid = measureDigitalGain('vox', 800, 0.5, 0, 0.5);
    const highMid = measureDigitalGain('vox', 800, 0.5, 1, 0.5);
    expect(highMid).toBeCloseTo(lowMid, 12);
  });

  it('smooths live control changes and supports explicit immediate updates', () => {
    const smooth = new WdfToneStackSolver(SAMPLE_RATE);
    const immediate = new WdfToneStackSolver(SAMPLE_RATE);
    smooth.build('marshall');
    immediate.build('marshall');
    smooth.setControls(0.1, 0.1, 0.1, true);
    immediate.setControls(0.1, 0.1, 0.1, true);

    for (let index = 0; index < 2_000; index++) {
      const input = Math.sin((2 * Math.PI * 1_000 * index) / SAMPLE_RATE);
      smooth.processSample(input);
      immediate.processSample(input);
    }

    smooth.setControls(0.9, 0.9, 0.9);
    immediate.setControls(0.9, 0.9, 0.9, true);
    let firstDifference = 0;
    let settledDifference = 0;
    for (let index = 0; index < 16_000; index++) {
      const input = Math.sin((2 * Math.PI * 1_000 * (index + 2_000)) / SAMPLE_RATE);
      const difference = Math.abs(smooth.processSample(input) - immediate.processSample(input));
      if (index < 64) firstDifference += difference;
      if (index >= 15_000) settledDifference += difference;
    }

    expect(firstDifference).toBeGreaterThan(0.05);
    expect(settledDifference / 1_000).toBeLessThan(1e-5);
  });

  it('stays finite at every potentiometer endpoint', () => {
    for (const model of MODELS) {
      for (const position of [0, 1]) {
        const solver = new WdfToneStackSolver(SAMPLE_RATE);
        solver.build(model);
        solver.setControls(position, position, position, true);
        for (let index = 0; index < 2_048; index++) {
          const output = solver.processSample(index === 0 ? 1 : 0);
          expect(Number.isFinite(output), `${model} at ${position}`).toBe(true);
        }
      }
    }
  });
});
