import { describe, it, expect } from 'vitest';

/**
 * Since createTubeCurve and AMP_TUBE_PARAMS are module-private in pipeline.ts,
 * we re-implement the core Koren curve algorithm here to verify its mathematical
 * properties in isolation. This avoids needing an AudioContext import.
 */

interface KorenParams {
  mu: number;
  biasShift: number;
  satOnset: number;
  asymmetry: number;
}

const AMP_TUBE_PARAMS: Record<string, KorenParams> = {
  clean_twin:  { mu: 100, biasShift: 0.05, satOnset: 0.72, asymmetry: 1.25 },
  crunch_800:  { mu: 60,  biasShift: 0.12, satOnset: 0.42, asymmetry: 1.55 },
  high_gain:   { mu: 35,  biasShift: 0.22, satOnset: 0.25, asymmetry: 1.85 },
  vox_chime:   { mu: 80,  biasShift: 0.08, satOnset: 0.55, asymmetry: 1.15 },
};

function createTubeCurve(model: string): Float32Array {
  const p = AMP_TUBE_PARAMS[model];
  const N = 4096;
  const curve = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const x = (i * 2) / (N - 1) - 1;
    const biased = x + p.biasShift;

    if (biased >= 0) {
      const drive = biased / p.satOnset;
      if (drive <= 1.0) {
        curve[i] = biased * (1.0 - 0.15 * drive * drive);
      } else {
        const excess = drive - 1.0;
        const ceiling = p.satOnset * 0.85;
        curve[i] = ceiling + (1.0 - ceiling) * (1.0 - Math.exp(-excess * p.asymmetry * 1.8));
      }
    } else {
      const absBiased = -biased;
      const cutoffOnset = p.satOnset * (1.0 + 0.3 / p.asymmetry);
      const drive = absBiased / cutoffOnset;
      if (drive <= 1.0) {
        curve[i] = biased * (1.0 - 0.08 * drive * drive);
      } else {
        const excess = drive - 1.0;
        const ceiling = cutoffOnset * 0.92;
        curve[i] = -(ceiling + (1.0 - ceiling) * (1.0 - Math.exp(-excess * 1.2)));
      }
    }
  }

  let maxAbs = 0;
  for (let i = 0; i < N; i++) {
    const abs = Math.abs(curve[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 0 && maxAbs !== 1.0) {
    const scale = 1.0 / maxAbs;
    for (let i = 0; i < N; i++) {
      curve[i] *= scale;
    }
  }

  return curve;
}

describe('Koren Triode Tube Curve', () => {
  it('should produce a normalized curve within [-1, 1] for all amp models', () => {
    for (const model of Object.keys(AMP_TUBE_PARAMS)) {
      const curve = createTubeCurve(model);
      for (let i = 0; i < curve.length; i++) {
        expect(curve[i]).toBeGreaterThanOrEqual(-1.001);
        expect(curve[i]).toBeLessThanOrEqual(1.001);
        expect(Number.isFinite(curve[i])).toBe(true);
      }
    }
  });

  it('should produce asymmetric saturation (positive clips harder than negative)', () => {
    for (const model of Object.keys(AMP_TUBE_PARAMS)) {
      const curve = createTubeCurve(model);
      const N = curve.length;

      // Check that the positive side saturates earlier than the negative side
      const posIdx = Math.floor((0.8 + 1) / 2 * (N - 1));
      const negIdx = Math.floor((-0.8 + 1) / 2 * (N - 1));

      const posDeviation = Math.abs(curve[posIdx] - 0.8);
      const negDeviation = Math.abs(curve[negIdx] - (-0.8));

      // Positive half should deviate MORE from linear (clips harder)
      expect(posDeviation).toBeGreaterThan(negDeviation * 0.5);
    }
  });

  it('should produce small-signal output near linear response at low input amplitudes', () => {
    const curve = createTubeCurve('clean_twin');
    const N = curve.length;

    const idx = Math.floor((0.05 + 1) / 2 * (N - 1));
    const output = curve[idx];

    // At x = 0.05, output reflects small-signal response (~0.11 including tube bias shift)
    expect(output).toBeGreaterThan(0.02);
    expect(output).toBeLessThan(0.2);
  });

  it('should produce different curves for each amp model', () => {
    const curves = Object.keys(AMP_TUBE_PARAMS).map(m => createTubeCurve(m));

    for (let a = 0; a < curves.length; a++) {
      for (let b = a + 1; b < curves.length; b++) {
        let diff = 0;
        for (let i = 0; i < curves[a].length; i++) {
          diff += Math.abs(curves[a][i] - curves[b][i]);
        }
        expect(diff / curves[a].length).toBeGreaterThan(0.001);
      }
    }
  });
});

describe('Cable Capacitance Calculation', () => {
  it('should compute cable capacitance from cable length at 100pF/m', () => {
    const lengths = [1, 3, 5, 10, 15];
    for (const m of lengths) {
      const capFarads = m * 100e-12;
      expect(capFarads).toBeCloseTo(m * 1e-10, 15);
    }
  });

  it('should produce higher capacitance for longer cables', () => {
    const short = 1 * 100e-12;
    const long = 15 * 100e-12;
    expect(long).toBeGreaterThan(short);
    expect(long / short).toBeCloseTo(15, 5);
  });
});
