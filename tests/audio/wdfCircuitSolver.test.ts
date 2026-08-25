import { describe, it, expect, beforeEach } from 'vitest';
import { WdfGuitarCircuitSolver } from '@audio/wdf/wdfCircuitSolver';
import type { WdfCircuitParams } from '@audio/wdf/wdfCircuitSolver';
import { Graph } from '@graph/Graph';

const BASE_PARAMS: WdfCircuitParams = {
  pickupInductanceH: 3.2,
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
  trebleBleedCapFarads: 0,
  ampInputImpedanceOhms: 1_000_000,
};

function measureSineGain(params: WdfCircuitParams, frequency: number): number {
  const testSolver = new WdfGuitarCircuitSolver(48000);
  testSolver.buildCircuit(params);
  let inputEnergy = 0;
  let outputEnergy = 0;
  for (let i = 0; i < 4096; i++) {
    const input = Math.sin((2 * Math.PI * frequency * i) / 48000);
    const output = testSolver.processSample(input);
    if (i >= 2048) {
      inputEnergy += input * input;
      outputEnergy += output * output;
    }
  }
  return Math.sqrt(outputEnergy / inputEnergy);
}

describe('WdfGuitarCircuitSolver', () => {
  let solver: WdfGuitarCircuitSolver;

  beforeEach(() => {
    solver = new WdfGuitarCircuitSolver(48000);
  });

  it('should build circuit from parameters and process audio samples without NaN', () => {
    solver.buildCircuit(BASE_PARAMS);

    const samples = new Float32Array([0.1, 0.5, -0.2, 0.8, -0.4]);
    solver.processBuffer(samples);

    for (let i = 0; i < samples.length; i++) {
      expect(Number.isNaN(samples[i])).toBe(false);
      expect(Number.isFinite(samples[i])).toBe(true);
    }
  });

  it('uses canonical graph pot and capacitor schemas without falling back to defaults', () => {
    const graph = new Graph('Guitar');
    graph.addComponent({
      id: 'vol-1',
      type: 'pot_volume',
      label: 'Volume',
      value: { resistance_kohms: 500, taper: 'reverse_audio', position: 0.35 },
    });
    graph.addComponent({
      id: 'tone-1',
      type: 'pot_tone',
      label: 'Tone',
      value: { resistance_kohms: 300, taper: 'audio', position: 0.6 },
    });
    graph.addComponent({
      id: 'cap-1',
      type: 'capacitor',
      label: 'Tone capacitor',
      value: { capacitance_pf: 22000 },
    });
    graph.addComponent({
      id: 'bleed-1',
      type: 'treble_bleed',
      label: 'Treble bleed',
      value: { capacitance_pf: 1500 },
    });

    solver.buildFromGraph(graph, null);

    const directSolver = new WdfGuitarCircuitSolver(48000);
    directSolver.buildCircuit({
      ...BASE_PARAMS,
      volumePotMaxOhms: 500000,
      volumePotPos: 0.35,
      volumePotTaper: 'reverse_audio',
      tonePotMaxOhms: 300000,
      tonePotPos: 0.6,
      tonePotTaper: 'audio',
      toneCapFarads: 22000e-12,
      trebleBleedCapFarads: 1500e-12,
    });

    for (let i = 0; i < 256; i++) {
      const input = i === 0 ? 1 : Math.sin(i * 0.17) * 0.25;
      expect(solver.processSample(input)).toBe(directSolver.processSample(input));
    }
  });

  it('treble bleed improves high-to-low frequency retention at rolled-down volume', () => {
    const rolledDown = { ...BASE_PARAMS, volumePotPos: 0.2 };
    const lowWithout = measureSineGain(rolledDown, 200);
    const highWithout = measureSineGain(rolledDown, 5000);
    const withBleed = { ...rolledDown, trebleBleedCapFarads: 1e-9 };
    const lowWith = measureSineGain(withBleed, 200);
    const highWith = measureSineGain(withBleed, 5000);

    expect(highWith / lowWith).toBeGreaterThan((highWithout / lowWithout) * 1.1);
  });

  it('pickup winding capacitance changes the resonant high-frequency response', () => {
    const withoutWindingCap = measureSineGain({ ...BASE_PARAMS, pickupWindingCapFarads: 0 }, 4000);
    const withWindingCap = measureSineGain(BASE_PARAMS, 4000);

    expect(Math.abs(withWindingCap - withoutWindingCap)).toBeGreaterThan(withoutWindingCap * 0.01);
  });
});
