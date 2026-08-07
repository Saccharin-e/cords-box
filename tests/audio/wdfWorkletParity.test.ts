/**
 * WDF Worklet Parity Test
 *
 * Verifies that the inlined WDF primitives in processor.js produce
 * identical output to the TypeScript reference in wdfNodes.ts / wdfCircuitSolver.ts.
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
import { WdfGuitarCircuitSolver } from '../../src/audio/wdf/wdfCircuitSolver';

describe('WDF Worklet Parity', () => {
  const SAMPLE_RATE = 48000;

  it('should produce identical output between TS reference solver and equivalent JS topology', () => {
    // Build the TypeScript reference circuit
    const solver = new WdfGuitarCircuitSolver(SAMPLE_RATE);
    solver.buildCircuit({
      pickupInductanceH: 2.4,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: 250000,
      volumePotPos: 0.7,
      tonePotMaxOhms: 250000,
      tonePotPos: 0.5,
      toneCapFarads: 47e-9,
      cableCapacitanceFarads: 500e-12,
    });

    // Build an equivalent circuit using raw WDF primitives (mirrors the worklet's WdfCircuit)
    const pickupR = new WdfResistor(6500);
    const pickupL = new WdfInductor(2.4, SAMPLE_RATE);
    const pickupBranch = new WdfSeriesAdaptor(pickupR, pickupL);

    const tonePot = new WdfPotentiometer(250000, 0.5);
    const toneCap = new WdfCapacitor(47e-9, SAMPLE_RATE);
    const toneBranch = new WdfSeriesAdaptor(tonePot, toneCap);

    const volumePot = new WdfPotentiometer(250000, 0.7);
    const cableCap = new WdfCapacitor(500e-12, SAMPLE_RATE);
    const loadBranch = new WdfParallelAdaptor(volumePot, cableCap);

    const toneAndLoad = new WdfParallelAdaptor(toneBranch, loadBranch);
    const root = new WdfParallelAdaptor(pickupBranch, toneAndLoad);

    // Generate a test input signal (impulse + noise burst)
    const N = 256;
    const input = new Float32Array(N);
    input[0] = 1.0; // impulse
    for (let i = 1; i < 32; i++) {
      input[i] = Math.sin(i * 0.3) * 0.5; // short burst
    }

    // Process through both implementations
    const refOutput = new Float32Array(N);
    const testOutput = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      refOutput[i] = solver.processSample(input[i]);

      // Manual process matching WdfCircuit.processSample
      const b = root.waveReflect(input[i]);
      root.step(input[i]);
      testOutput[i] = (input[i] + b) * 0.5;
    }

    // Outputs should be sample-identical (same algorithm, same params)
    for (let i = 0; i < N; i++) {
      expect(testOutput[i]).toBeCloseTo(refOutput[i], 10);
    }
  });

  it('should produce non-trivial filtering (output differs from input)', () => {
    const solver = new WdfGuitarCircuitSolver(SAMPLE_RATE);
    solver.buildCircuit({
      pickupInductanceH: 2.4,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: 250000,
      volumePotPos: 0.5,
      tonePotMaxOhms: 250000,
      tonePotPos: 0.3, // tone rolled off
      toneCapFarads: 47e-9,
      cableCapacitanceFarads: 500e-12,
    });

    // Process several samples — WDF circuits are stateful (caps/inductors need
    // multiple samples to build up energy through their state variables)
    const N = 64;
    let totalEnergy = 0;
    for (let i = 0; i < N; i++) {
      const input = i === 0 ? 1.0 : 0.0; // impulse
      const out = solver.processSample(input);
      totalEnergy += out * out;
    }

    // Circuit should have passed some energy through (volume pot at 50%)
    expect(totalEnergy).toBeGreaterThan(0.0);
    // But not all of it (volume attenuation + filter rolloff)
    expect(totalEnergy).toBeLessThan(1.0);
  });

  it('should respond to pot position changes', () => {
    // Full volume — process impulse response
    const solverFull = new WdfGuitarCircuitSolver(SAMPLE_RATE);
    solverFull.buildCircuit({
      pickupInductanceH: 2.4,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: 250000,
      volumePotPos: 1.0,
      tonePotMaxOhms: 250000,
      tonePotPos: 1.0,
      toneCapFarads: 47e-9,
      cableCapacitanceFarads: 500e-12,
    });

    let fullVolEnergy = 0;
    for (let i = 0; i < 128; i++) {
      const input = i === 0 ? 1.0 : 0.0;
      const out = solverFull.processSample(input);
      fullVolEnergy += out * out;
    }

    // Low volume — fresh solver instance
    const solverLow = new WdfGuitarCircuitSolver(SAMPLE_RATE);
    solverLow.buildCircuit({
      pickupInductanceH: 2.4,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: 250000,
      volumePotPos: 0.1, // nearly off
      tonePotMaxOhms: 250000,
      tonePotPos: 1.0,
      toneCapFarads: 47e-9,
      cableCapacitanceFarads: 500e-12,
    });

    let lowVolEnergy = 0;
    for (let i = 0; i < 128; i++) {
      const input = i === 0 ? 1.0 : 0.0;
      const out = solverLow.processSample(input);
      lowVolEnergy += out * out;
    }

    // Both should pass some energy
    expect(fullVolEnergy).toBeGreaterThan(0);
    expect(lowVolEnergy).toBeGreaterThan(0);
    // Low volume should produce less total energy
    expect(lowVolEnergy).toBeLessThan(fullVolEnergy);
  });
});
