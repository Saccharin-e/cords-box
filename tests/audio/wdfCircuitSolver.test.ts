import { describe, it, expect, beforeEach } from 'vitest';
import { WdfGuitarCircuitSolver } from '@audio/wdf/wdfCircuitSolver';
import { Graph } from '@graph/Graph';

describe('WdfGuitarCircuitSolver', () => {
  let solver: WdfGuitarCircuitSolver;

  beforeEach(() => {
    solver = new WdfGuitarCircuitSolver(48000);
  });

  it('should build circuit from parameters and process audio samples without NaN', () => {
    solver.buildCircuit({
      pickupInductanceH: 3.2,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: 250000,
      volumePotPos: 1.0,
      tonePotMaxOhms: 250000,
      tonePotPos: 1.0,
      toneCapFarads: 47e-9,
      cableCapacitanceFarads: 500e-12,
    });

    const samples = new Float32Array([0.1, 0.5, -0.2, 0.8, -0.4]);
    solver.processBuffer(samples);

    for (let i = 0; i < samples.length; i++) {
      expect(Number.isNaN(samples[i])).toBe(false);
      expect(Number.isFinite(samples[i])).toBe(true);
    }
  });

  it('should build circuit from Graph and adapt pot values', () => {
    const graph = new Graph('Guitar');
    graph.addComponent({
      id: 'vol-1',
      type: 'pot_volume',
      label: 'Volume',
      value: { resistance_kohms: 250, taper: 'audio', position: 0.5 },
    });

    solver.buildFromGraph(graph, null);

    const inputBuffer = new Float32Array([0.5, 0.5, 0.5]);
    solver.processBuffer(inputBuffer);

    expect(Number.isNaN(inputBuffer[0])).toBe(false);
  });
});
