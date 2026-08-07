/**
 * wdfResonance.test.ts — WDF passive circuit load response & pickup resonance
 *
 * The worklet's WdfCircuit (processor.js) models the passive guitar network
 * (pickup coil, volume/tone pots, tone cap, cable, amp input) as a one-port
 * load driven by the string signal. This test verifies two things:
 *
 * 1. The passive network is a sensible, control-responsive load: it rolls off
 *    the top end, and both the volume and tone pots change the response the
 *    way real guitar controls do.
 * 2. The pickup resonant peak (the "twang") is provided by the PeakingBiquad
 *    added in the worklet input path — the mirrored formula must show unity
 *    gain at DC/Nyquist and the configured boost at the resonant frequency.
 */
import { describe, it, expect } from 'vitest';
import {
  WdfResistor,
  WdfCapacitor,
  WdfInductor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfParallelAdaptor,
} from '../../src/audio/wdf/wdfNodes';

const SR = 48000;
const FFT_SIZE = 16384;

interface PickupCircuitParams {
  inductanceH: number;
  resistanceR: number;
  volPotMaxR: number;
  volPos: number;
  tonePotMaxR: number;
  tonePos: number;
  toneCapFarads: number;
  cableCapFarads: number;
  ampInputOhms: number;
}

function buildWorkletCircuit(p: PickupCircuitParams) {
  const pickupR = new WdfResistor(p.resistanceR);
  const pickupL = new WdfInductor(p.inductanceH, SR);
  const pickupBranch = new WdfSeriesAdaptor(pickupR, pickupL);

  const tonePot = new WdfPotentiometer(p.tonePotMaxR, p.tonePos);
  const toneCap = new WdfCapacitor(p.toneCapFarads, SR);
  const toneBranch = new WdfSeriesAdaptor(tonePot, toneCap);

  const volumePot = new WdfPotentiometer(p.volPotMaxR, p.volPos);
  const cableCap = new WdfCapacitor(p.cableCapFarads, SR);
  const ampInputR = new WdfResistor(p.ampInputOhms);
  const cableAndAmpLoad = new WdfParallelAdaptor(cableCap, ampInputR);
  const loadBranch = new WdfParallelAdaptor(volumePot, cableAndAmpLoad);

  const toneAndLoad = new WdfParallelAdaptor(toneBranch, loadBranch);
  return new WdfParallelAdaptor(pickupBranch, toneAndLoad);
}

function impulseResponse(p: PickupCircuitParams): Float64Array {
  const root = buildWorkletCircuit(p);
  const out = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    const input = i === 0 ? 1.0 : 0.0;
    const b = root.waveReflect(input);
    root.step(input);
    out[i] = (input + b) * 0.5;
  }
  return out;
}

function hannWindowedFft(signal: Float64Array): Float64Array {
  // Radix-2 FFT of FFT_SIZE with a Hann window to tame spectral leakage.
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    re[i] = signal[i] * w;
  }

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < FFT_SIZE; i++) {
    let bit = FFT_SIZE >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      const ti = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = tr;
      im[j] = ti;
    }
  }

  for (let len = 1; len < FFT_SIZE; len *= 2) {
    for (let start = 0; start < FFT_SIZE; start += len * 2) {
      for (let i = 0; i < len; i++) {
        const angle = (-Math.PI * i) / len;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const a = start + i;
        const b = a + len;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
  const mag = new Float64Array(FFT_SIZE);
  for (let i = 0; i < FFT_SIZE; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
}

function dbAt(p: PickupCircuitParams, freq: number): number {
  const mag = hannWindowedFft(impulseResponse(p));
  const bin = Math.round((freq / SR) * FFT_SIZE);
  return 20 * Math.log10(mag[bin] + 1e-12);
}

const WORKLET_DEFAULTS: PickupCircuitParams = {
  inductanceH: 2.4,
  resistanceR: 6500,
  volPotMaxR: 250000,
  volPos: 1.0,
  tonePotMaxR: 250000,
  tonePos: 1.0,
  toneCapFarads: 47e-9,
  cableCapFarads: 500e-12, // 5 m cable at 100 pF/m (pipeline default)
  ampInputOhms: 1000000,
};

describe('WDF passive circuit load response (worklet defaults)', () => {
  it('is a lowpass load: top end rolls off well below the low-mids', () => {
    expect(dbAt(WORKLET_DEFAULTS, 6000)).toBeLessThan(dbAt(WORKLET_DEFAULTS, 300) - 10);
  });

  it('volume pot changes the load the pickup sees', () => {
    const full = dbAt(WORKLET_DEFAULTS, 3000);
    const rolled = dbAt({ ...WORKLET_DEFAULTS, volPos: 0.1 }, 3000);
    expect(Math.abs(rolled - full)).toBeGreaterThan(1);
  });

  it('tone roll-off darkens the high end', () => {
    const bright = dbAt(WORKLET_DEFAULTS, 6000);
    const dull = dbAt({ ...WORKLET_DEFAULTS, tonePos: 0.05 }, 6000);
    expect(dull).toBeLessThan(bright - 1);
  });
});

// Mirrors the PeakingBiquad in src/audio/processor.js (worklet input path).
class PeakingBiquad {
  private _b: number[];
  private _a: number[];

  constructor(sampleRate: number, freq: number, q: number, gainDb: number) {
    const A = Math.pow(10, gainDb / 40);
    const w0 = (2 * Math.PI * freq) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cw = Math.cos(w0);
    const a0 = 1 + alpha / A;
    this._b = [(1 + alpha * A) / a0, (-2 * cw) / a0, (1 - alpha * A) / a0];
    this._a = [(-2 * cw) / a0, (1 - alpha / A) / a0];
  }
  magnitudeDb(freq: number): number {
    const w = (2 * Math.PI * freq) / SR;
    const num = Math.hypot(
      this._b[0] + this._b[1] * Math.cos(-w) + this._b[2] * Math.cos(-2 * w),
      this._b[1] * Math.sin(-w) + this._b[2] * Math.sin(-2 * w),
    );
    const den = Math.hypot(
      1 + this._a[0] * Math.cos(-w) + this._a[1] * Math.cos(-2 * w),
      this._a[0] * Math.sin(-w) + this._a[1] * Math.sin(-2 * w),
    );
    return 20 * Math.log10(num / den);
  }
}

describe('Pickup resonance biquad (worklet parity)', () => {
  const f0 = 3400; // fallback single-coil resonantFreq
  const q = 2.2;

  it('has unity gain at DC and Nyquist (peaking, not a shelf)', () => {
    const bq = new PeakingBiquad(SR, f0, q, 6);
    expect(Math.abs(bq.magnitudeDb(20))).toBeLessThan(0.5);
    expect(Math.abs(bq.magnitudeDb(20000))).toBeLessThan(0.5);
  });

  it('boosts the resonant frequency by the configured gain', () => {
    const bq = new PeakingBiquad(SR, f0, q, 6);
    expect(bq.magnitudeDb(f0)).toBeCloseTo(6, 1);
  });

  it('peaks only around the resonance: the flanks are below the peak', () => {
    const bq = new PeakingBiquad(SR, f0, q, 6);
    expect(bq.magnitudeDb(f0 / 3)).toBeLessThan(bq.magnitudeDb(f0) - 3);
    expect(bq.magnitudeDb(f0 * 3)).toBeLessThan(bq.magnitudeDb(f0) - 3);
  });
});
