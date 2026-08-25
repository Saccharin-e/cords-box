/**
 * wdfCircuitSolver.ts — Dynamic WDF Passive Circuit Solver for Guitar Wiring
 *
 * Translates canvas circuit graph components (pickups, tone pots, volume pots, caps)
 * into a physically loaded Wave Digital Filter tree and processes audio sample-by-sample.
 */

import {
  type WdfElement,
  type PotTaper,
  applyPotTaper,
  WdfVoltageSourceResistor,
  WdfCapacitor,
  WdfInductor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfParallelAdaptor,
  WdfResistor,
  WdfVoltageProbe,
} from './wdfNodes';
import type { Graph } from '@graph/Graph';
import type { SolverResult } from '@graph/solver';

export interface WdfCircuitParams {
  pickupInductanceH: number;
  pickupResistanceOhms: number;
  pickupWindingCapFarads?: number;
  volumePotMaxOhms: number;
  volumePotPos: number;
  volumePotTaper?: PotTaper;
  tonePotMaxOhms: number;
  tonePotPos: number;
  tonePotTaper?: PotTaper;
  toneCapFarads: number;
  cableCapacitanceFarads: number;
  trebleBleedCapFarads?: number;
  ampInputImpedanceOhms?: number;
}

export class WdfGuitarCircuitSolver {
  private rootAdaptor: WdfElement | null = null;
  private volumePot: WdfPotentiometer | null = null;
  private volumeTopPot: WdfPotentiometer | null = null;
  private tonePot: WdfPotentiometer | null = null;
  private toneCap: WdfCapacitor | null = null;
  private pickupSource: WdfVoltageSourceResistor | null = null;
  private outputProbe: WdfVoltageProbe | null = null;
  private sampleRate: number;

  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /**
   * Build WDF tree from circuit parameters
   */
  buildCircuit(params: WdfCircuitParams): void {
    this.pickupSource = new WdfVoltageSourceResistor(params.pickupResistanceOhms);
    const pickupL = new WdfInductor(params.pickupInductanceH, this.sampleRate);
    const pickupRL = new WdfSeriesAdaptor(this.pickupSource, pickupL);

    // Pickup coil self-resonance via distributed winding capacitance (80-200pF)
    let pickupBranch: WdfElement = pickupRL;
    const pickupWindingCapFarads = params.pickupWindingCapFarads ?? 120e-12;
    if (pickupWindingCapFarads > 0) {
      const windingCap = new WdfCapacitor(pickupWindingCapFarads, this.sampleRate);
      pickupBranch = new WdfParallelAdaptor(pickupRL, windingCap);
    }

    this.tonePot = new WdfPotentiometer(
      params.tonePotMaxOhms,
      params.tonePotPos,
      params.tonePotTaper ?? 'linear',
    );
    this.toneCap = new WdfCapacitor(params.toneCapFarads, this.sampleRate);
    const toneBranch = new WdfSeriesAdaptor(this.tonePot, this.toneCap);

    // A real three-lug volume pot is a divider. The tapered position is the
    // wiper-to-ground fraction; the complementary section runs hot-to-wiper.
    const volumeTaper = params.volumePotTaper ?? 'audio';
    const wiperFraction = applyPotTaper(params.volumePotPos, volumeTaper);
    this.volumeTopPot = new WdfPotentiometer(params.volumePotMaxOhms, 1 - wiperFraction, 'linear');
    this.volumePot = new WdfPotentiometer(params.volumePotMaxOhms, wiperFraction, 'linear');

    // A treble bleed bridges the hot and wiper lugs, so it is parallel with
    // the upper section of the divider rather than with the cable load.
    let upperVolumeBranch: WdfElement = this.volumeTopPot;
    const trebleBleedCapFarads = params.trebleBleedCapFarads ?? 0;
    if (trebleBleedCapFarads > 0) {
      const tbCap = new WdfCapacitor(trebleBleedCapFarads, this.sampleRate);
      upperVolumeBranch = new WdfParallelAdaptor(this.volumeTopPot, tbCap);
    }

    const cableCap = new WdfCapacitor(params.cableCapacitanceFarads, this.sampleRate);
    const ampInput = new WdfResistor(params.ampInputImpedanceOhms ?? 1_000_000);
    const cableAndAmp = new WdfParallelAdaptor(cableCap, ampInput);
    const lowerVolumeBranch = new WdfParallelAdaptor(this.volumePot, cableAndAmp);
    this.outputProbe = new WdfVoltageProbe(lowerVolumeBranch);
    const volumeDivider = new WdfSeriesAdaptor(upperVolumeBranch, this.outputProbe);

    const pickupAndTone = new WdfParallelAdaptor(pickupBranch, toneBranch);
    this.rootAdaptor = new WdfParallelAdaptor(pickupAndTone, volumeDivider);
  }

  /**
   * Extract parameters from canvas Graph & SolverResult and build WDF tree
   */
  buildFromGraph(graph: Graph, solverResult: SolverResult | null): void {
    const activeNodes = solverResult?.activeNodes;
    const activeComponents = activeNodes
      ? graph
          .getComponents()
          .filter((c) => graph.getComponentNodes(c.id).some((n) => activeNodes.has(n.id)))
      : graph.getComponents();

    let volumePos = 1.0;
    let tonePos = 1.0;
    let volumeMaxOhms = 250000;
    let toneMaxOhms = 250000;
    let volumeTaper: PotTaper = 'audio';
    let toneTaper: PotTaper = 'linear';
    let toneCapFarads = 47e-9; // Default 0.047 uF
    let trebleBleedCapFarads = 0;

    for (const comp of activeComponents) {
      if (
        comp.type === 'pot_volume' ||
        comp.type === 'pot_pushpull' ||
        comp.type === 'pot_concentric'
      ) {
        const val = comp.value as
          { position?: number; resistance_kohms?: number; taper?: PotTaper } | undefined;
        volumePos = val?.position ?? volumePos;
        volumeMaxOhms = (val?.resistance_kohms ?? volumeMaxOhms / 1000) * 1000;
        volumeTaper = val?.taper ?? volumeTaper;
      } else if (comp.type === 'pot_tone') {
        const val = comp.value as
          { position?: number; resistance_kohms?: number; taper?: PotTaper } | undefined;
        tonePos = val?.position ?? tonePos;
        toneMaxOhms = (val?.resistance_kohms ?? toneMaxOhms / 1000) * 1000;
        toneTaper = val?.taper ?? toneTaper;
      } else if (comp.type === 'capacitor') {
        const val = comp.value as { capacitance_pf?: number } | undefined;
        toneCapFarads = (val?.capacitance_pf ?? 47_000) * 1e-12;
      } else if (comp.type === 'treble_bleed') {
        const val = comp.value as { capacitance_pf?: number } | undefined;
        trebleBleedCapFarads = (val?.capacitance_pf ?? 1_000) * 1e-12;
      }
    }

    this.buildCircuit({
      pickupInductanceH: 3.2,
      pickupResistanceOhms: 6500,
      pickupWindingCapFarads: 120e-12,
      volumePotMaxOhms: volumeMaxOhms,
      volumePotPos: volumePos,
      volumePotTaper: volumeTaper,
      tonePotMaxOhms: toneMaxOhms,
      tonePotPos: tonePos,
      tonePotTaper: toneTaper,
      toneCapFarads: toneCapFarads,
      cableCapacitanceFarads: 500e-12,
      trebleBleedCapFarads: trebleBleedCapFarads,
      ampInputImpedanceOhms: 1_000_000,
    });
  }

  /**
   * Process a single audio sample v_in through WDF circuit tree
   */
  processSample(vin: number): number {
    if (!this.rootAdaptor || !this.pickupSource || !this.outputProbe) return vin;

    this.pickupSource.setVoltage(vin);
    const b = this.rootAdaptor.waveReflect(0);
    this.rootAdaptor.step(b);

    return this.outputProbe.voltage;
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
