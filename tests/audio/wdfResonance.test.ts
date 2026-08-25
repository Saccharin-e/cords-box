/**
 * Frequency-domain behavior of the production guitar-circuit solver. Pickup
 * self-resonance now comes from Lcoil || Cwinding instead of a synthetic EQ.
 */
import { describe, expect, it } from 'vitest';
import {
  WdfGuitarCircuitSolver,
  type WdfCircuitParams,
} from '../../src/audio/wdf/wdfCircuitSolver';

const SAMPLE_RATE = 48000;
const DEFAULTS: WdfCircuitParams = {
  pickupInductanceH: 2.4,
  pickupResistanceOhms: 6500,
  pickupWindingCapFarads: 120e-12,
  volumePotMaxOhms: 250000,
  volumePotPos: 1,
  volumePotTaper: 'audio',
  tonePotMaxOhms: 250000,
  tonePotPos: 1,
  tonePotTaper: 'linear',
  toneCapFarads: 47e-9,
  cableCapacitanceFarads: 500e-12,
  ampInputImpedanceOhms: 1_000_000,
};

function measureSineGain(params: WdfCircuitParams, frequency: number): number {
  const solver = new WdfGuitarCircuitSolver(SAMPLE_RATE);
  solver.buildCircuit(params);
  let inputEnergy = 0;
  let outputEnergy = 0;

  for (let i = 0; i < 4096; i++) {
    const input = Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE);
    const output = solver.processSample(input);
    if (i >= 2048) {
      inputEnergy += input * input;
      outputEnergy += output * output;
    }
  }

  return Math.sqrt(outputEnergy / inputEnergy);
}

function findPeak(params: WdfCircuitParams): { frequency: number; gain: number } {
  let peakFrequency = 0;
  let peakGain = -Infinity;
  for (let frequency = 2000; frequency <= 8000; frequency += 250) {
    const gain = measureSineGain(params, frequency);
    if (gain > peakGain) {
      peakGain = gain;
      peakFrequency = frequency;
    }
  }
  return { frequency: peakFrequency, gain: peakGain };
}

describe('WDF passive guitar circuit response', () => {
  it('uses the three-terminal volume divider for strong level roll-off', () => {
    const fullVolume = measureSineGain(DEFAULTS, 1000);
    const rolledDown = measureSineGain({ ...DEFAULTS, volumePotPos: 0.1 }, 1000);

    expect(rolledDown).toBeLessThan(fullVolume * 0.05);
  });

  it('tone roll-off darkens the high end', () => {
    const bright = measureSineGain(DEFAULTS, 6000);
    const dark = measureSineGain({ ...DEFAULTS, tonePotPos: 0.05 }, 6000);

    expect(dark).toBeLessThan(bright * 0.3);
  });

  it('pickup winding capacitance creates a natural resonant peak', () => {
    const lightlyLoaded = { ...DEFAULTS, cableCapacitanceFarads: 100e-12 };
    const withoutWindingCap = findPeak({ ...lightlyLoaded, pickupWindingCapFarads: 0 });
    const withWindingCap = findPeak(lightlyLoaded);

    expect(withWindingCap.gain).toBeGreaterThan(withoutWindingCap.gain * 1.1);
  });

  it('moves the pickup resonant peak lower as winding capacitance increases', () => {
    const lightlyLoaded = { ...DEFAULTS, cableCapacitanceFarads: 100e-12 };
    const lowCapacitance = findPeak({ ...lightlyLoaded, pickupWindingCapFarads: 80e-12 });
    const highCapacitance = findPeak({ ...lightlyLoaded, pickupWindingCapFarads: 400e-12 });

    expect(highCapacitance.frequency).toBeLessThan(lowCapacitance.frequency);
  });
});
