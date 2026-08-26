/**
 * TypeScript entry point for the shared passive tone-stack runtime.
 *
 * The implementation lives in plain ESM so the AudioWorklet and application
 * tests execute the same allocation-free circuit solver.
 */
export {
  TONE_STACK_COMPONENTS,
  TONE_STACK_MAKEUP_GAIN,
  WdfToneStack,
  WdfToneStackSolver,
  toneStackAudioTaper,
} from './toneStackCore.js';

export type { ToneStackComponents, ToneStackModel, ToneStackTopology } from './toneStackCore.js';
