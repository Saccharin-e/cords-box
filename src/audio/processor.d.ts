export type WorkletPotTaper = 'linear' | 'audio' | 'reverse_audio';

export interface WorkletWdfElement {
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfResistor implements WorkletWdfElement {
  constructor(resistance: number);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfVoltageSourceResistor implements WorkletWdfElement {
  constructor(resistance: number);
  portResistance: number;
  setVoltage(voltage: number): void;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfCapacitor implements WorkletWdfElement {
  constructor(capacitanceFarads: number, sampleRate: number);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfInductor implements WorkletWdfElement {
  constructor(inductanceHenries: number, sampleRate: number);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfPotentiometer implements WorkletWdfElement {
  constructor(maxResistance: number, initialPosition?: number, taper?: WorkletPotTaper);
  portResistance: number;
  setPosition(position: number): void;
  setTaper(taper: WorkletPotTaper): void;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfSeriesAdaptor implements WorkletWdfElement {
  constructor(child1: WorkletWdfElement, child2: WorkletWdfElement);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfSeriesNAdaptor implements WorkletWdfElement {
  constructor(children: WorkletWdfElement[]);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfParallelAdaptor implements WorkletWdfElement {
  constructor(child1: WorkletWdfElement, child2: WorkletWdfElement);
  portResistance: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export class WdfVoltageProbe implements WorkletWdfElement {
  constructor(child: WorkletWdfElement);
  portResistance: number;
  voltage: number;
  waveReflect(a: number): number;
  step(a: number): void;
  reset(): void;
}

export interface WorkletPickupParams {
  inductanceH: number;
  resistanceR: number;
  windingCapFarads?: number;
  delayMs?: number;
  positionFraction?: number;
  blendGain?: number;
  isOutofPhase?: boolean;
}

export interface WorkletCircuitParams {
  pickups?: WorkletPickupParams[];
  isSeries?: boolean;
  volPotMaxR?: number;
  volumePos?: number;
  volumePotTaper?: WorkletPotTaper;
  tonePotMaxR?: number;
  tonePos?: number;
  tonePotTaper?: WorkletPotTaper;
  toneCapFarads?: number;
  trebleBleedCapFarads?: number;
  cableCapFarads?: number;
  ampInputImpedanceOhms?: number;
}

export class WdfCircuit {
  constructor(sampleRate: number);
  updateParams(params: WorkletCircuitParams): void;
  processSample(input: number | ArrayLike<number>): number;
  processBuffer(input: Float32Array, output: Float32Array): void;
}

export type WorkletToneStackModel = 'fender' | 'marshall' | 'mesa' | 'vox';

export class WdfToneStack {
  constructor(sampleRate: number);
  build(model: WorkletToneStackModel): void;
  setControls(bass: number, mid: number, treble: number, immediate?: boolean): void;
  setSmoothingTime(milliseconds: number): void;
  processSample(input: number): number;
  processBuffer(input: Float32Array, output: Float32Array): void;
  reset(): void;
  getModel(): WorkletToneStackModel;
  getMakeupGain(): number;
}

export class GuitarProcessor extends AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}

export class ToneStackProcessor extends AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
}
