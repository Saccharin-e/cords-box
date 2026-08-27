import { describe, expect, it } from 'vitest';
import { createTubeCurve } from '@audio/pipeline';
import type { AmpModelType } from '@audio/pipeline';

const AMP_MODELS: readonly AmpModelType[] = ['clean_twin', 'crunch_800', 'high_gain', 'vox_chime'];

function sampleCurve(curve: Float32Array, input: number): number {
  const position = ((Math.max(-1, Math.min(1, input)) + 1) * (curve.length - 1)) / 2;
  const left = Math.floor(position);
  const fraction = position - left;
  return curve[left] + (curve[Math.min(curve.length - 1, left + 1)] - curve[left]) * fraction;
}

describe('triode saturation curve', () => {
  it('is finite and normalized for every amp model', () => {
    for (const model of AMP_MODELS) {
      const curve = createTubeCurve(model);
      for (const sample of curve) {
        expect(Number.isFinite(sample)).toBe(true);
        expect(Math.abs(sample)).toBeLessThanOrEqual(1.000001);
      }
    }
  });

  it('maps silence to silence while retaining asymmetric saturation', () => {
    for (const model of AMP_MODELS) {
      const curve = createTubeCurve(model);
      expect(sampleCurve(curve, 0)).toBeCloseTo(0, 4);
      const positive = sampleCurve(curve, 0.8);
      const negative = sampleCurve(curve, -0.8);
      expect(Math.abs(positive + negative)).toBeGreaterThan(0.005);
    }
  });

  it('has a monotonic, near-linear small-signal region', () => {
    const curve = createTubeCurve('clean_twin');
    const negative = sampleCurve(curve, -0.05);
    const zero = sampleCurve(curve, 0);
    const positive = sampleCurve(curve, 0.05);
    expect(negative).toBeLessThan(zero);
    expect(positive).toBeGreaterThan(zero);
    expect(positive - negative).toBeGreaterThan(0.05);
    expect(positive - negative).toBeLessThan(0.2);
  });

  it('gives each amp model a distinct transfer curve', () => {
    const curves = AMP_MODELS.map((model) => createTubeCurve(model));
    for (let left = 0; left < curves.length; left++) {
      for (let right = left + 1; right < curves.length; right++) {
        let difference = 0;
        for (let index = 0; index < curves[left].length; index++) {
          difference += Math.abs(curves[left][index] - curves[right][index]);
        }
        expect(difference / curves[left].length).toBeGreaterThan(0.001);
      }
    }
  });
});

describe('cable capacitance calculation', () => {
  it('scales linearly at 100 pF per metre', () => {
    const shortCable = 1 * 100e-12;
    const longCable = 15 * 100e-12;
    expect(longCable / shortCable).toBeCloseTo(15, 5);
  });
});
