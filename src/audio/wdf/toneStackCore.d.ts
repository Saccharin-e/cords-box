export type ToneStackModel = 'fender' | 'marshall' | 'mesa' | 'vox';

export type ToneStackTopology = 'fmv' | 'vox';

export interface ToneStackComponents {
  topology: ToneStackTopology;
  R_slope: number;
  C_treble: number;
  R_treble_pot: number;
  C_bass: number;
  R_bass_pot: number;
  C_mid: number;
  /** Variable mid pot for FMV; fixed shunt resistor for Vox. */
  R_mid_pot: number;
  R_load: number;
}

export const TONE_STACK_COMPONENTS: Readonly<Record<ToneStackModel, ToneStackComponents>>;
export const TONE_STACK_MAKEUP_GAIN: Readonly<Record<ToneStackModel, number>>;

export function toneStackAudioTaper(position: number): number;

export class WdfToneStackSolver {
  constructor(sampleRate?: number);
  build(model: ToneStackModel): void;
  setControls(bass: number, mid: number, treble: number, immediate?: boolean): void;
  setSmoothingTime(milliseconds: number): void;
  processSample(vin: number): number;
  processBuffer(input: Float32Array, output: Float32Array): void;
  reset(): void;
  getModel(): ToneStackModel;
  getMakeupGain(): number;
}

export { WdfToneStackSolver as WdfToneStack };
