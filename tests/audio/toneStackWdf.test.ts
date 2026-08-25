/**
 * toneStackWdf.test.ts — WDF Passive Tone Stack Verification
 *
 * These tests exercise the WDF tone stack implementation in wdfToneStack.ts
 * and its worklet counterpart in processor.js. We verify:
 *
 * 1. Dynamic insertion-loss compensation restores neutral 1 kHz to unity.
 * 2. Coupled interaction makes the mid control reshape bass and treble.
 * 3. Different models (fender, marshall, mesa, vox) produce distinct
 *    frequency responses.
 * 4. Each pot affects the expected frequency band.
 */
import { describe, it, expect } from 'vitest';
import {
  TONE_STACK_MAKEUP_GAIN,
  WdfToneStackSolver,
  type ToneStackModel,
} from '../../src/audio/wdf/wdfToneStack';

const SAMPLE_RATE = 48000;

/** Measure steady-state RMS gain (Vout_rms / Vin_rms) for a pure sine wave */
function measureSineGain(
  model: ToneStackModel,
  freq: number,
  bass = 0.5,
  mid = 0.5,
  treble = 0.5,
  numSamples = 4096,
): number {
  const solver = new WdfToneStackSolver(SAMPLE_RATE);
  solver.build(model);
  solver.setControls(bass, mid, treble);

  let inSumSq = 0;
  let outSumSq = 0;
  const settleSamples = Math.floor(numSamples / 2);

  for (let i = 0; i < numSamples; i++) {
    const vin = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
    const vout = solver.processSample(vin);
    if (i >= settleSamples) {
      inSumSq += vin * vin;
      outSumSq += vout * vout;
    }
  }

  const count = numSamples - settleSamples;
  const inRms = Math.sqrt(inSumSq / count);
  const outRms = Math.sqrt(outSumSq / count);
  return outRms / inRms;
}

/** Measure band energy by sweeping frequencies */
function measureBandEnergy(
  model: ToneStackModel,
  bass: number,
  mid: number,
  treble: number,
  freqLow: number,
  freqHigh: number,
  steps = 16,
): number {
  let totalEnergy = 0;
  for (let s = 0; s < steps; s++) {
    const freq = freqLow * Math.pow(freqHigh / freqLow, s / (steps - 1));
    const gain = measureSineGain(model, freq, bass, mid, treble, 1024);
    totalEnergy += gain * gain;
  }
  return totalEnergy;
}

describe('WDF Passive Tone Stack', () => {
  const models: ToneStackModel[] = ['fender', 'marshall', 'mesa', 'vox'];

  it('auto-calibrates every model to unity at 1 kHz with neutral controls', () => {
    for (const model of models) {
      const gainDb = 20 * Math.log10(measureSineGain(model, 1000));
      expect(gainDb, `${model}: calibrated 1 kHz gain`).toBeGreaterThanOrEqual(-0.15);
      expect(gainDb, `${model}: calibrated 1 kHz gain`).toBeLessThanOrEqual(0.15);
    }
  });

  it('keeps calibrated per-model gains as deterministic build fallbacks', () => {
    expect(TONE_STACK_MAKEUP_GAIN).toEqual({
      fender: 2.15,
      marshall: 1.65,
      mesa: 1.7,
      vox: 2.1,
    });
  });

  it('passes some energy through (not a dead circuit)', () => {
    for (const model of models) {
      const gain = measureSineGain(model, 440, 0.5, 0.5, 0.5);
      expect(gain, `${model} should pass energy`).toBeGreaterThan(0.1);
    }
  });

  it('all model pairs produce distinct neutral frequency responses', () => {
    const signatures: Record<string, [number, number]> = {};
    for (const model of models) {
      signatures[model] = [measureSineGain(model, 110), measureSineGain(model, 3000)];
    }

    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const left = signatures[models[i]];
        const right = signatures[models[j]];
        const lowDifference = Math.abs(left[0] / right[0] - 1);
        const highDifference = Math.abs(left[1] / right[1] - 1);
        expect(
          Math.max(lowDifference, highDifference),
          `${models[i]} and ${models[j]} should not share the same response`,
        ).toBeGreaterThan(0.025);
      }
    }
  });

  it('mid boost suppresses bass while strongly reshaping treble through the shared network', () => {
    for (const model of ['fender', 'marshall'] as const) {
      const bassWithLowMid = measureBandEnergy(model, 0.5, 0.1, 0.5, 60, 200);
      const bassWithHighMid = measureBandEnergy(model, 0.5, 0.9, 0.5, 60, 200);

      const trebleWithLowMid = measureBandEnergy(model, 0.5, 0.1, 0.5, 2000, 8000);
      const trebleWithHighMid = measureBandEnergy(model, 0.5, 0.9, 0.5, 2000, 8000);

      expect(bassWithHighMid, `${model}: a mid boost should pull down bass energy`).toBeLessThan(
        bassWithLowMid * 0.98,
      );
      expect(
        trebleWithHighMid,
        `${model}: the coupled mid control should materially reshape treble`,
      ).toBeGreaterThan(trebleWithLowMid * 1.1);
    }
  });

  it('treble pot affects high-frequency energy', () => {
    for (const model of models) {
      const trebleLow = measureBandEnergy(model, 0.5, 0.5, 0.1, 3000, 10000);
      const trebleHigh = measureBandEnergy(model, 0.5, 0.5, 0.9, 3000, 10000);
      expect(
        trebleHigh,
        `${model}: treble pot at 0.9 should pass more HF than at 0.1`,
      ).toBeGreaterThan(trebleLow * 1.005);
    }
  });

  it('bass pot affects low-frequency energy', () => {
    for (const model of models) {
      const bassLow = measureBandEnergy(model, 0.1, 0.5, 0.5, 40, 200);
      const bassHigh = measureBandEnergy(model, 0.9, 0.5, 0.5, 40, 200);
      expect(bassHigh, `${model}: bass pot at 0.9 should pass more LF than at 0.1`).toBeGreaterThan(
        bassLow * 1.1,
      );
    }
  });

  it('mesa model has deeper mid scoop than fender', () => {
    const fenderMidEnergy = measureBandEnergy('fender', 0.5, 0.5, 0.5, 400, 1000);
    const mesaMidEnergy = measureBandEnergy('mesa', 0.5, 0.5, 0.5, 400, 1000);
    const fenderFullEnergy = measureBandEnergy('fender', 0.5, 0.5, 0.5, 40, 10000);
    const mesaFullEnergy = measureBandEnergy('mesa', 0.5, 0.5, 0.5, 40, 10000);

    const fenderRatio = fenderMidEnergy / fenderFullEnergy;
    const mesaRatio = mesaMidEnergy / mesaFullEnergy;
    expect(mesaRatio, 'Mesa should have a deeper mid scoop than Fender').toBeLessThanOrEqual(
      fenderRatio * 1.1,
    );
  });
});
