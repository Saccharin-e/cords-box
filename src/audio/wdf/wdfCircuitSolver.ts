/**
 * wdfCircuitSolver.ts — Dynamic WDF Passive Circuit Solver for Guitar Wiring
 *
 * Translates canvas circuit graph components (pickups, tone pots, volume pots, caps)
 * into a physically loaded Wave Digital Filter tree and processes audio sample-by-sample.
 */

import {
  type WdfElement,
  WdfResistor,
  WdfCapacitor,
  WdfInductor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfParallelAdaptor,
} from './wdfNodes';
import type { Graph } from '@graph/Graph';
import type { SolverResult } from '@graph/solver';

export interface WdfCircuitParams {
  pickupInductanceH: number;
  pickupResistanceOhms: number;
  volumePotMaxOhms: number;
  volumePotPos: number;
  tonePotMaxOhms: number;
  tonePotPos: number;
  toneCapFarads: number;
  cableCapacitanceFarads: number;
}

export class WdfGuitarCircuitSolver {
  private rootAdaptor: WdfElement | null = null;
  private volumePot: WdfPotentiometer | null = null;
  private tonePot: WdfPotentiometer | null = null;
  private toneCap: WdfCapacitor | null = null;
  private sampleRate: number;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Build WDF tree from circuit parameters
   */
  buildCircuit(params: WdfCircuitParams): void {
    const pickupR = new WdfResistor(params.pickupResistanceOhms);
    const pickupL = new WdfInductor(params.pickupInductanceH, this.sampleRate);
    const pickupBranch = new WdfSeriesAdaptor(pickupR, pickupL);

    this.tonePot = new WdfPotentiometer(params.tonePotMaxOhms, params.tonePotPos);
    this.toneCap = new WdfCapacitor(params.toneCapFarads, this.sampleRate);
    const toneBranch = new WdfSeriesAdaptor(this.tonePot, this.toneCap);

    this.volumePot = new WdfPotentiometer(params.volumePotMaxOhms, params.volumePotPos);
    const cableCap = new WdfCapacitor(params.cableCapacitanceFarads, this.sampleRate);
    const loadBranch = new WdfParallelAdaptor(this.volumePot, cableCap);

    const toneAndLoad = new WdfParallelAdaptor(toneBranch, loadBranch);
    this.rootAdaptor = new WdfParallelAdaptor(pickupBranch, toneAndLoad);
  }

  /**
   * Extract parameters from canvas Graph & SolverResult and build WDF tree
   */
  buildFromGraph(graph: Graph, solverResult: SolverResult | null): void {
    const activeNodes = solverResult?.activeNodes;
    const activeComponents = activeNodes
      ? graph.getComponents().filter((c) => graph.getComponentNodes(c.id).some((n) => activeNodes.has(n.id)))
      : graph.getComponents();

    let volumePos = 1.0;
    let tonePos = 1.0;
    let volumeMaxOhms = 250000;
    let toneMaxOhms = 250000;
    let toneCapFarads = 47e-9; // Default 0.047 uF
    let trebleBleedCapFarads = 0;

    for (const comp of activeComponents) {
      if (comp.type === 'pot_volume' || comp.type === 'pot_pushpull' || comp.type === 'pot_concentric') {
        const val = comp.value as { position?: number; maxOhms?: number } | undefined;
        volumePos = val?.position ?? volumePos;
        volumeMaxOhms = val?.maxOhms ?? volumeMaxOhms;
      } else if (comp.type === 'pot_tone') {
        const val = comp.value as { position?: number; maxOhms?: number } | undefined;
        tonePos = val?.position ?? tonePos;
        toneMaxOhms = val?.maxOhms ?? toneMaxOhms;
      } else if (comp.type === 'capacitor' || comp.type === 'treble_bleed') {
        const val = comp.value as { farads?: number } | number | undefined;
        const capValue = typeof val === 'number' ? val : (val?.farads ?? 47e-9);
        if (capValue < 5e-9) {
          // Small capacitor (<5nF e.g. 1nF) -> Treble Bleed Network
          trebleBleedCapFarads = capValue;
        } else {
          // Main tone capacitor
          toneCapFarads = capValue;
        }
      }
    }

    this.buildCircuit({
      pickupInductanceH: 3.2,
      pickupResistanceOhms: 6500,
      volumePotMaxOhms: volumeMaxOhms,
      volumePotPos: volumePos,
      tonePotMaxOhms: toneMaxOhms,
      tonePotPos: tonePos,
      toneCapFarads: toneCapFarads,
      cableCapacitanceFarads: 500e-12 + trebleBleedCapFarads, // High-frequency bypass compensation
    });
  }

  /**
   * Process a single audio sample v_in through WDF circuit tree
   */
  processSample(vin: number): number {
    if (!this.rootAdaptor) return vin;

    // Convert incident voltage v_in to incident wave a
    const b = this.rootAdaptor.waveReflect(vin);
    this.rootAdaptor.step(vin);

    // Compute node voltage v_out = (a + b) / 2
    return (vin + b) * 0.5;
  }

  /**
   * Process a buffer of audio samples in place
   */
  processBuffer(buffer: Float32Array): void {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = this.processSample(buffer[i]);
    }
  }

  reset(): void {
    if (this.rootAdaptor) {
      this.rootAdaptor.reset();
    }
  }
}
