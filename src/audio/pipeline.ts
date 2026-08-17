/**
 * Audio Pipeline — Graph-to-WebAudio DSP Synthesizer & Filter Chain
 *
 * Converts solved circuit graph paths into dynamic Web Audio API nodes:
 * - Pickup Sources: Authentic Physical Modeling (Tele twang, Strat chime, Gibson humbucker)
 * - Pedalboard, tube preamp, tone stack, power amp, speaker cabinet, and room return
 * - Potentiometers: Volume (Audio taper pos^2.5), Tone (Lowpass RC roll-off), Concentric, Blend & Push-Pull
 * - Dynamics Processor: Soft-knee compressor preventing digital clipping
 */

import { audioEngine } from './context';
import { renderKarplusStrong, sustainSeconds } from './karplusStrong';
import { SampleBank } from './sampleBank';
import { WdfGuitarCircuitSolver } from './wdf/wdfCircuitSolver';
import type { SolverResult } from '@graph/solver';
import type { Graph } from '@graph/Graph';
import { useCircuitStore } from '@store/circuitStore';
import dspWasmUrl from './wasm-pkg/dsp_bg.wasm?url';

export type InputSourceType = 'pluck' | 'strum' | 'mic';

export const GUITAR_DEMO_GENRES = [
  { id: 'rock', label: 'Rock' },
  { id: 'blues', label: 'Blues' },
  { id: 'hard-rock', label: 'Hard Rock' },
  { id: 'alternative-rock', label: 'Alternative Rock' },
  { id: 'dream-pop', label: 'Dream Pop' },
] as const;

export type GuitarDemoGenre = (typeof GUITAR_DEMO_GENRES)[number]['id'];

export const GUITAR_STRINGS: Record<string, number> = {
  E2: 82.41, // Low E
  A2: 110.0, // A
  D3: 146.83, // D
  G3: 196.0, // G
  B3: 246.94, // B
  E4: 329.63, // High E
};

export const GUITAR_CHORDS: Record<string, readonly number[]> = {
  E_MAJOR: [82.41, 123.47, 164.81, 207.65, 246.94, 329.63],
  A_MINOR: [110.0, 164.81, 220.0, 261.63, 329.63],
  A_MINOR7: [110.0, 164.81, 220.0, 261.63, 329.63, 392.0],
  A7: [110.0, 164.81, 196.0, 277.18, 329.63],
  E_MINOR7: [82.41, 146.83, 196.0, 246.94, 293.66, 329.63],
  D_SUS2_F_SHARP: [92.5, 146.83, 220.0, 293.66, 369.99],
  C_MAJOR7: [65.41, 130.81, 196.0, 261.63, 329.63, 392.0],
  G_SIX: [98.0, 146.83, 196.0, 246.94, 329.63, 392.0],
  G_MAJOR: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0],
  D7: [146.83, 220.0, 261.63, 293.66, 369.99],
  E7: [82.41, 123.47, 146.83, 196.0, 246.94, 329.63],
  A5_POWER: [110.0, 164.81, 220.0],
  D5_POWER: [146.83, 220.0, 293.66],
  G5_POWER: [98.0, 146.83, 196.0],
  D_MAJOR: [146.83, 220.0, 293.66, 369.99],
  E5_POWER: [82.41, 123.47, 164.81],
};

export interface ActivePickupState {
  id: string;
  type: string;
  resonantFreq: number;
  resonantQ: number;
  isOutofPhase: boolean;
  blendGain: number; // 0.0 to 1.0 (controlled by blender pots)
  delayTimeMs: number; // Comb filter delay (pickup position along string)
}

export interface CircuitTopologyState {
  pickups: ActivePickupState[];
  isSeries: boolean;
  masterVolume: number;
  masterTone: number;
}

export type AmpModelType = 'clean_twin' | 'crunch_800' | 'high_gain' | 'vox_chime';
export type CabinetModelType = '1x12_open' | '2x12_tweed' | '4x12_stack' | '4x12_metal';
export type DriveType = 'overdrive' | 'tube_screamer' | 'distortion' | 'fuzz_muff';

export interface AmpPedalboardState {
  // Stompbox Pedals
  compressorEnabled: boolean;
  compressorSustain: number;
  compressorLevel: number;

  overdriveEnabled: boolean;
  overdriveType: DriveType;
  overdriveDrive: number;
  overdriveTone: number;
  overdriveLevel: number;

  chorusEnabled: boolean;
  chorusRate: number;
  chorusDepth: number;
  chorusMix: number;

  delayEnabled: boolean;
  delayTimeMs: number;
  delayFeedback: number;
  delayMix: number;

  reverbEnabled: boolean;
  reverbSize: number;
  reverbDecay: number;
  reverbMix: number;

  // Tube Amp Head
  ampModel: AmpModelType;
  ampGain: number;
  ampBass: number;
  ampMid: number;
  ampTreble: number;
  ampPresence: number;
  ampMaster: number;

  // Speaker Cabinet
  cabModel: CabinetModelType;
  micDistance: number;

  // Signal Chain
  cableLengthMeters: number;
  ampInputImpedanceOhms: number;
}

export const DEFAULT_AMP_PEDALBOARD_STATE: AmpPedalboardState = {
  compressorEnabled: false,
  compressorSustain: 0.4,
  compressorLevel: 0.8,

  overdriveEnabled: false,
  overdriveType: 'overdrive',
  overdriveDrive: 0.5,
  overdriveTone: 0.6,
  overdriveLevel: 0.7,

  chorusEnabled: false,
  chorusRate: 1.2,
  chorusDepth: 0.4,
  chorusMix: 0.35,

  delayEnabled: false,
  delayTimeMs: 320,
  delayFeedback: 0.38,
  delayMix: 0.3,

  reverbEnabled: true,
  reverbSize: 0.4,
  reverbDecay: 0.3,
  reverbMix: 0.15,

  ampModel: 'clean_twin',
  ampGain: 0.6,
  ampBass: 0.5,
  ampMid: 0.5,
  ampTreble: 0.5,
  ampPresence: 0.5,
  ampMaster: 0.85,

  cabModel: '1x12_open',
  micDistance: 0.2,

  cableLengthMeters: 5,
  ampInputImpedanceOhms: 1000000,
};

export interface RigPreset {
  id: string;
  name: string;
  description: string;
  state: Partial<AmpPedalboardState>;
}

export const RIG_PRESETS: Record<string, RigPreset> = {
  gilmour_lead: {
    id: 'gilmour_lead',
    name: 'David Gilmour Lead Rig (Big Muff + 480ms Echo + Hiwatt)',
    description: 'Electro-Harmonix Big Muff Pi fuzz saturation, singing sustain, 4x12 stack cab, liquid chorus, and 480ms tape echo.',
    state: {
      compressorEnabled: true,
      compressorSustain: 0.65,
      compressorLevel: 0.9,

      overdriveEnabled: true,
      overdriveType: 'fuzz_muff',
      overdriveDrive: 0.88,
      overdriveTone: 0.72,
      overdriveLevel: 0.85,

      chorusEnabled: true,
      chorusRate: 0.25,
      chorusDepth: 0.35,
      chorusMix: 0.26,

      delayEnabled: true,
      delayTimeMs: 480,
      delayFeedback: 0.42,
      delayMix: 0.38,

      ampModel: 'crunch_800',
      ampGain: 0.85,
      ampBass: 0.55,
      ampMid: 0.75,
      ampTreble: 0.65,
      ampPresence: 0.75,
      ampMaster: 0.9,

      cabModel: '4x12_stack',
      micDistance: 0.15,

      reverbEnabled: true,
      reverbMix: 0.32,
      reverbSize: 0.6,
      reverbDecay: 0.5,
    },
  },
  classic_rock_crunch: {
    id: 'classic_rock_crunch',
    name: 'Marshall JCM800 Crunch (Plexi Drive)',
    description: 'Classic British tube crunch with 4x12 stack cab and subtle room reverb for AC/DC and Guns N Roses.',
    state: {
      compressorEnabled: false,
      overdriveEnabled: true,
      overdriveType: 'tube_screamer',
      overdriveDrive: 0.65,
      overdriveTone: 0.6,
      overdriveLevel: 0.75,
      chorusEnabled: false,
      delayEnabled: false,
      ampModel: 'crunch_800',
      ampGain: 0.75,
      ampBass: 0.6,
      ampMid: 0.65,
      ampTreble: 0.7,
      ampPresence: 0.65,
      ampMaster: 0.85,
      cabModel: '4x12_stack',
      reverbEnabled: true,
      reverbMix: 0.18,
    },
  },
  clean_chime: {
    id: 'clean_chime',
    name: 'Fender Twin Reverb Clean (Lush Chorus & Space)',
    description: 'Sparkling clean Blackface tube amp with 2x12 Tweed cab, optical compressor, and stereo chorus.',
    state: {
      compressorEnabled: true,
      compressorSustain: 0.45,
      compressorLevel: 0.8,
      overdriveEnabled: false,
      chorusEnabled: true,
      chorusRate: 0.8,
      chorusDepth: 0.4,
      chorusMix: 0.3,
      delayEnabled: true,
      delayTimeMs: 320,
      delayFeedback: 0.25,
      delayMix: 0.2,
      ampModel: 'clean_twin',
      ampGain: 0.45,
      ampBass: 0.5,
      ampMid: 0.55,
      ampTreble: 0.65,
      ampPresence: 0.5,
      ampMaster: 0.85,
      cabModel: '2x12_tweed',
      reverbEnabled: true,
      reverbMix: 0.25,
    },
  },
  metal_high_gain: {
    id: 'metal_high_gain',
    name: 'High Gain Modern Lead (Tight Rectifier)',
    description: 'Cascaded high gain tube preamp with scooped mids and aggressive 4x12 V30 cabinet punch.',
    state: {
      compressorEnabled: true,
      compressorSustain: 0.5,
      compressorLevel: 0.85,
      overdriveEnabled: true,
      overdriveType: 'distortion',
      overdriveDrive: 0.8,
      overdriveTone: 0.7,
      overdriveLevel: 0.8,
      chorusEnabled: false,
      delayEnabled: false,
      ampModel: 'high_gain',
      ampGain: 0.9,
      ampBass: 0.65,
      ampMid: 0.45,
      ampTreble: 0.75,
      ampPresence: 0.8,
      ampMaster: 0.85,
      cabModel: '4x12_metal',
      reverbEnabled: true,
      reverbMix: 0.15,
    },
  },
  bypass_clean: {
    id: 'bypass_clean',
    name: 'Direct Input (Clean Studio Bypass)',
    description: 'Pure clean direct input for testing uncolored passive pickup circuits and wiring harnesses.',
    state: {
      compressorEnabled: false,
      overdriveEnabled: false,
      chorusEnabled: false,
      delayEnabled: false,
      ampModel: 'clean_twin',
      ampGain: 0.3,
      cabModel: '1x12_open',
      reverbEnabled: false,
      reverbMix: 0.0,
    },
  },
};

const tubeCurveCache = new Map<string, Float32Array<ArrayBuffer>>();
const cabinetIrCache = new Map<string, AudioBuffer>();
const roomIrCache = new Map<number, AudioBuffer>();

/**
 * Koren triode model parameters per amp type.
 *
 * Based on Norman Koren's triode plate-current equation, these parameters
 * produce physically realistic asymmetric soft-knee saturation:
 * - Positive half: grid conduction clipping with strong even-order harmonics (2nd, 4th)
 * - Negative half: cutoff region — softer compression, preserving odd harmonics
 *
 * `mu`: amplification factor (higher = more gain before saturation)
 * `biasShift`: DC offset that controls where the operating point sits on the curve
 * `satOnset`: amplitude where saturation begins (lower = earlier breakup)
 * `asymmetry`: ratio of positive to negative clipping intensity (>1 = harder positive clip)
 */
const AMP_TUBE_PARAMS: Record<
  AmpModelType,
  {
    mu: number;
    biasShift: number;
    satOnset: number;
    asymmetry: number;
  }
> = {
  // 12AX7 Fender Blackface: very linear, gentle compression above 0.7
  clean_twin: { mu: 100, biasShift: 0.05, satOnset: 0.72, asymmetry: 1.25 },
  // EL34 Marshall JCM800: earlier saturation, strong 2nd harmonic crunch
  crunch_800: { mu: 60, biasShift: 0.12, satOnset: 0.42, asymmetry: 1.55 },
  // Mesa Rectifier cascaded gain: hard compression above 0.25
  high_gain: { mu: 35, biasShift: 0.22, satOnset: 0.25, asymmetry: 1.85 },
  // EL84 Class-A Vox AC30: prominent cutoff-region softness, chimey character
  vox_chime: { mu: 80, biasShift: 0.08, satOnset: 0.55, asymmetry: 1.15 },
};

/**
 * Maps each pipeline amp model to the WDF passive tone-stack model in
 * processor.js.  The tone stack is now solved per-sample inside the
 * AudioWorklet's WdfToneStack (a coupled RC network where bass/mid/treble
 * pots interact through a shared resistive ladder), replacing the previous
 * three independent BiquadFilterNodes.
 */
const AMP_TONE_STACK_MODEL: Record<AmpModelType, string> = {
  clean_twin: 'fender',
  crunch_800: 'marshall',
  high_gain: 'mesa',
  vox_chime: 'vox',
};

/**
 * Koren-inspired asymmetric triode saturation waveshaper curve.
 *
 * Produces physically realistic soft-knee clipping where:
 * - Positive half (grid conduction): exponential saturation onset generates
 *   strong even-order harmonics (2nd, 4th) — the characteristic "tube warmth"
 * - Negative half (cutoff region): gentler compression with a higher threshold,
 *   preserving odd harmonics and keeping the waveform's negative excursion cleaner
 *
 * The asymmetry between positive and negative halves is what distinguishes tube
 * saturation from symmetric digital clipping or simple tanh() curves.
 */
function createTubeCurve(model: AmpModelType = 'clean_twin'): Float32Array<ArrayBuffer> {
  const cached = tubeCurveCache.get(model);
  if (cached) return cached;

  const p = AMP_TUBE_PARAMS[model];
  const N = 4096; // Higher resolution for smoother saturation transitions
  const curve = new Float32Array(new ArrayBuffer(N * Float32Array.BYTES_PER_ELEMENT));

  for (let i = 0; i < N; i += 1) {
    const x = (i * 2) / (N - 1) - 1; // -1.0 to +1.0

    // Apply bias shift (models the DC operating point of the tube)
    const biased = x + p.biasShift;

    if (biased >= 0) {
      // Positive half — grid conduction clipping (even harmonics)
      // Soft-knee: linear below satOnset, then exponential compression
      const drive = biased / p.satOnset;
      if (drive <= 1.0) {
        // Below saturation onset: near-linear with gentle 2nd-order curve
        curve[i] = biased * (1.0 - 0.15 * drive * drive);
      } else {
        // Above onset: exponential saturation approaching ceiling
        const excess = drive - 1.0;
        const ceiling = p.satOnset * 0.85; // Value at onset point
        curve[i] = ceiling + (1.0 - ceiling) * (1.0 - Math.exp(-excess * p.asymmetry * 1.8));
      }
    } else {
      // Negative half — cutoff clipping (odd harmonics preserved)
      // Softer compression with a later onset and gentler knee
      const absBiased = -biased;
      const cutoffOnset = p.satOnset * (1.0 + 0.3 / p.asymmetry);
      const drive = absBiased / cutoffOnset;
      if (drive <= 1.0) {
        curve[i] = biased * (1.0 - 0.08 * drive * drive);
      } else {
        const excess = drive - 1.0;
        const ceiling = cutoffOnset * 0.92;
        curve[i] = -(ceiling + (1.0 - ceiling) * (1.0 - Math.exp(-excess * 1.2)));
      }
    }
  }

  // Normalize curve to [-1, 1] range
  let maxAbs = 0;
  for (let i = 0; i < N; i++) {
    const abs = Math.abs(curve[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 0 && maxAbs !== 1.0) {
    const scale = 1.0 / maxAbs;
    for (let i = 0; i < N; i++) {
      curve[i] *= scale;
    }
  }

  tubeCurveCache.set(model, curve);
  return curve;
}

const driveCurveCache = new Map<DriveType, Float32Array<ArrayBuffer>>();

function createOverdriveCurve(type: DriveType = 'overdrive'): Float32Array<ArrayBuffer> {
  const cached = driveCurveCache.get(type);
  if (cached) return cached;

  const N = 4096;
  const curve = new Float32Array(new ArrayBuffer(N * Float32Array.BYTES_PER_ELEMENT));

  if (type === 'fuzz_muff') {
    // Big Muff Pi / Ram's Head: aggressive dual-diode clipping with sustained saturation
    for (let i = 0; i < N; i += 1) {
      const x = (i * 2) / (N - 1) - 1;
      const driven = x * 7.5;
      curve[i] = (2 / Math.PI) * Math.atan(driven * 1.8) * 0.92;
    }
  } else if (type === 'distortion') {
    // Hard clipping distortion (DS-1 style)
    for (let i = 0; i < N; i += 1) {
      const x = (i * 2) / (N - 1) - 1;
      const driven = x * 4.0;
      curve[i] = Math.max(-0.85, Math.min(0.85, driven));
    }
  } else if (type === 'tube_screamer') {
    // Symmetrical soft-knee overdrive with mid-forward saturation
    for (let i = 0; i < N; i += 1) {
      const x = (i * 2) / (N - 1) - 1;
      const sign = x < 0 ? -1 : 1;
      const mag = Math.abs(x);
      curve[i] = sign * (1 - Math.exp(-mag * 2.8)) * 0.88;
    }
  } else {
    // Transparent mild overdrive
    for (let i = 0; i < N; i += 1) {
      const input = (i * 2) / (N - 1) - 1;
      const sign = input < 0 ? -1 : 1;
      const magnitude = Math.abs(input);
      const softKnee =
        magnitude < 0.24 ? magnitude * 1.12 : 0.24 + (1 - Math.exp(-(magnitude - 0.24) * 2.2)) * 0.76;
      curve[i] = sign * softKnee;
    }
  }

  driveCurveCache.set(type, curve);
  return curve;
}

// Per-cabinet-model modal resonance tables.
// Each mode is [frequencyHz, decayRate (1/s), relativeAmplitude].
// Lower modes ring longer (smaller decay rate); higher breakup modes die fast.
const CABINET_MODES: Record<CabinetModelType, Array<[number, number, number]>> = {
  '1x12_open': [
    [105, 90, 0.40],    // baffle fundamental
    [245, 110, 0.28],   // back-panel reflection (open back)
    [680, 160, 0.18],   // first cone breakup
    [1250, 200, 0.14],  // cone/surround coupling
    [2600, 280, 0.09],  // high cone breakup
    [4200, 380, 0.04],  // edge diffraction
  ],
  '2x12_tweed': [
    [95, 80, 0.42],     // larger baffle fundamental
    [210, 100, 0.30],   // cabinet depth mode
    [450, 130, 0.22],   // inter-speaker coupling
    [820, 170, 0.15],   // cone breakup
    [1800, 240, 0.10],  // high-mid breakup
    [3200, 320, 0.06],  // presence peak
    [5000, 420, 0.03],  // air/diffusion
  ],
  '4x12_stack': [
    [120, 70, 0.45],    // sealed box fundamental
    [280, 95, 0.32],    // cabinet depth standing wave
    [520, 130, 0.22],   // inter-speaker mode
    [900, 170, 0.16],   // first cone breakup (G12T-75 style)
    [1600, 220, 0.11],  // second breakup
    [2800, 300, 0.07],  // presence dip/peak
    [4500, 400, 0.04],  // high breakup
    [6200, 500, 0.02],  // air mode
  ],
  '4x12_metal': [
    [130, 65, 0.48],    // tight sealed box
    [310, 85, 0.35],    // box mode (tighter Q)
    [580, 120, 0.24],   // inter-speaker coupling
    [1050, 160, 0.18],  // V30-style early breakup
    [2200, 240, 0.12],  // aggressive presence
    [3600, 320, 0.08],  // cone edge
    [5200, 420, 0.04],  // sizzle
    [7000, 550, 0.02],  // air/fizz
  ],
};

function createCabinetImpulseResponse(
  ctx: AudioContext,
  model: CabinetModelType = '1x12_open',
): AudioBuffer {
  const cacheKey = `${ctx.sampleRate}:${model}`;
  const cached = cabinetIrCache.get(cacheKey);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * 0.055); // 55ms IR
  const impulse = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = impulse.getChannelData(0);

  const modes = CABINET_MODES[model] || CABINET_MODES['1x12_open'];

  // 1. Additive modal synthesis: sum exponentially-decaying sinusoidal modes
  //    representing the speaker cone's breakup modes and cabinet resonances.
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    let sample = 0;
    for (const [freq, decayRate, amplitude] of modes) {
      sample += amplitude * Math.sin(2 * Math.PI * freq * t) * Math.exp(-t * decayRate);
    }
    data[i] = sample;
  }

  // 2. Direct impulse: the initial transient of the speaker's first excursion
  data[0] += 0.9;
  data[1] += -0.4;

  // 3. Blend a small amount of filtered noise for high-frequency diffusion
  //    realism (~20 dB below the modal content). A real cone has micro-texture
  //    that isn't purely modal.
  let noiseFilterState = 0;
  // Use a deterministic LCG so the IR is reproducible across sessions
  let noiseSeed = 54321;
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 140);
    noiseSeed = (noiseSeed * 1664525 + 1013904223) | 0;
    const noise = ((noiseSeed >>> 0) / 4294967296) * 2 - 1;
    noiseFilterState = noiseFilterState * 0.45 + noise * 0.55;
    data[i] += noiseFilterState * 0.04 * env; // ~20 dB below modes
  }

  // Peak-normalize impulse
  let maxAbs = 0;
  for (let i = 0; i < length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > maxAbs) maxAbs = abs;
  }
  if (maxAbs > 0) {
    for (let i = 0; i < length; i++) {
      data[i] = (data[i] / maxAbs) * 0.85;
    }
  }

  cabinetIrCache.set(cacheKey, impulse);
  return impulse;
}

function createRoomImpulseResponse(ctx: AudioContext): AudioBuffer {
  const cached = roomIrCache.get(ctx.sampleRate);
  if (cached) return cached;

  const length = Math.floor(ctx.sampleRate * 0.22);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  // Dense stereo broadband noise room reflections (studio acoustic ambience):
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 18);
    left[i] = (Math.random() * 2 - 1) * env * 0.08;
    right[i] = (Math.random() * 2 - 1) * env * 0.08;
  }

  // Early reflections
  const reflections = [
    [0.012, 0.35],
    [0.034, 0.22],
    [0.068, 0.14],
    [0.112, 0.08],
  ];

  left[0] = 0.8;
  right[0] = 0.75;

  for (const [delaySec, gain] of reflections) {
    const idx = Math.floor(delaySec * ctx.sampleRate);
    if (idx < length) {
      left[idx] += gain;
      right[idx] += gain * 0.9;
    }
  }

  roomIrCache.set(ctx.sampleRate, impulse);
  return impulse;
}

export class AudioPipeline {
  private wdfWorkletNode: AudioWorkletNode | null = null;
  private masterGain: GainNode | null = null;
  private finalOutputGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }
  private micStream: MediaStream | null = null;
  private strumIntervalId: number | null = null;
  private autoStrumming = false;
  private songTimeoutIds: number[] = [];
  private demoSongPlaying = false;

  private inputNode: GainNode | null = null;
  private sampleInputNode: GainNode | null = null;
  private topologyRouted = false;
  private sampleBank = new SampleBank();
  private wdfSolver = new WdfGuitarCircuitSolver(48000);
  private activeSampleSources = new Map<number, { source: AudioBufferSourceNode; gain: GainNode }>();

  constructor() {
    audioEngine.subscribe(() => {
      const ctx = audioEngine.getContext();
      if (ctx && audioEngine.isWorkletReady() && !this.wdfWorkletNode) {
        const currentGraph = useCircuitStore.getState().graph;
        this.instantiateWdfWorklet(ctx, currentGraph);
        this.topologyRouted = false;
        this.routeInputThroughTopology(ctx, 1.0);
      }
    });
  }

  private async instantiateWdfWorklet(ctx: AudioContext, graph?: Graph): Promise<void> {
    if (!audioEngine.isWorkletReady() || !ctx.audioWorklet) return;
    if (this.wdfWorkletNode) return;
    try {
      const node = new AudioWorkletNode(ctx, 'guitar-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      this.wdfWorkletNode = node;
      const res = await fetch(dspWasmUrl);
      const wasmBytes = await res.arrayBuffer();
      node.port.postMessage({ type: 'init', wasmBytes }, [wasmBytes]);
      this.postWdfUpdate(graph);

      // Listen for sag-level feedback from the worklet: modulate preamp gain
      // upward when sag is high (less headroom = more saturation, the coupled
      // gain-up/volume-down behavior of real tube power-amp sag)
      node.port.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'sag-level' && msg.level > 0) {
          const preampGain = this.activeNodes.get('preamp-gain') as GainNode | undefined;
          if (preampGain && ctx.state === 'running') {
            // Increase drive into preamp proportional to sag (more sag = more crunch)
            const sagDriveBoost = 1.0 + msg.level * 0.8; // up to +80% gain boost
            preampGain.gain.setTargetAtTime(
              sagDriveBoost * (this.ampPedalState.ampGain * 1.35 + 0.5),
              ctx.currentTime, 0.05,
            );
          }
        }
      };

      // Sync the WDF tone stack with the current amp model and knob state
      this.postToneStackUpdate();
    } catch {
      this.wdfWorkletNode = null;
    }
  }

  private postWdfUpdate(graph?: Graph): void {
    if (!this.wdfWorkletNode) return;
    const comps = graph ? graph.getComponents() : [];
    const volPot = comps.find((c) => c.type === 'pot_volume');
    const tonePot = comps.find((c) => c.type === 'pot_tone');
    const toneCap = comps.find((c) => c.type === 'capacitor');

    let volPotMaxR = 250000;
    if (volPot?.value && 'resistance_kohms' in volPot.value) {
      volPotMaxR = (volPot.value.resistance_kohms ?? 250) * 1000;
    }

    let tonePotMaxR = 250000;
    if (tonePot?.value && 'resistance_kohms' in tonePot.value) {
      tonePotMaxR = (tonePot.value.resistance_kohms ?? 250) * 1000;
    }

    let toneCapFarads = 47e-9;
    if (toneCap?.value && 'capacitance_pf' in toneCap.value) {
      toneCapFarads = (toneCap.value.capacitance_pf ?? 47000) * 1e-12;
    }

    const wdfPickups = this.activeTopology.pickups.map((p) => {
      let l = 2.4;
      let r = 6500;
      if (p.id.includes('humbucker')) {
        l = 4.2;
        r = 8500;
      } else if (p.id.includes('p90')) {
        l = 3.2;
        r = 7200;
      }
      return {
        inductanceH: l,
        resistanceR: r,
        delayMs: p.delayTimeMs,
        resonantFreq: p.resonantFreq,
        resonantQ: p.resonantQ,
        isOutofPhase: p.isOutofPhase,
        blendGain: p.blendGain,
      };
    });

    this.wdfWorkletNode.port.postMessage({
      type: 'wdf-update',
      params: {
        volumePos: volPot?.value && 'position' in volPot.value ? volPot.value.position : 1.0,
        tonePos: tonePot?.value && 'position' in tonePot.value ? tonePot.value.position : 1.0,
        volPotMaxR,
        tonePotMaxR,
        toneCapFarads,
        pickups: wdfPickups, // Send full array of pickups
        isSeries: this.activeTopology.isSeries,
        cableCapFarads: this.ampPedalState.cableLengthMeters * 100e-12, // 100pF/m typical instrument cable
        ampInputImpedanceOhms: this.ampPedalState.ampInputImpedanceOhms,
      },
    });
  }

  /**
   * Sync the WDF passive tone stack in the AudioWorklet with the current
   * amp model and bass/mid/treble knob positions.  The worklet solves the
   * coupled RC network per-sample, replacing the previous independent
   * BiquadFilterNodes in the main-thread Web Audio graph.
   */
  private postToneStackUpdate(): void {
    if (!this.wdfWorkletNode) return;
    const s = this.ampPedalState;
    this.wdfWorkletNode.port.postMessage({
      type: 'tone-stack-update',
      model: AMP_TONE_STACK_MODEL[s.ampModel],
      bass: s.ampBass,
      mid: s.ampMid,
      treble: s.ampTreble,
    });
  }

  private activeNodes: Map<string, AudioNode> = new Map();
  private stateListeners = new Set<() => void>();
  private activeTopology: CircuitTopologyState = {
    pickups: [],
    isSeries: false,
    masterVolume: 1.0,
    masterTone: 1.0,
  };
  private ampPedalState: AmpPedalboardState = { ...DEFAULT_AMP_PEDALBOARD_STATE };
  private masterVolumeBoost = 1.8;

  public getMasterVolumeBoost(): number {
    return this.masterVolumeBoost;
  }

  public setMasterVolumeBoost(boost: number): void {
    this.masterVolumeBoost = Math.max(0.3, Math.min(4.0, boost));
    const ctx = audioEngine.getContext();
    if (ctx && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.setValueAtTime(1.0, now);
    }
    if (ctx && this.finalOutputGain) {
      const now = ctx.currentTime;
      const s = this.ampPedalState;
      this.finalOutputGain.gain.setValueAtTime(s.ampMaster * 2.8 * this.masterVolumeBoost, now);
    }
    this.emitStateChange();
  }

  // Live parameter automation refs — these let knob changes update existing
  // nodes instead of tearing down and rebuilding the whole Web Audio graph.
  private structuralKey: string | null = null;
  private pickupBranchGains = new Map<string, GainNode>();
  private masterToneFilter: BiquadFilterNode | null = null;
  private outputGainNode: GainNode | null = null;

  public getAmpPedalboardState(): AmpPedalboardState {
    return { ...this.ampPedalState };
  }

  /**
   * Subscribe to engine state changes (auto-strum, demo song, sample bank
   * readiness). Returns an unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitStateChange(): void {
    for (const listener of this.stateListeners) {
      listener();
    }
  }

  public updateAmpPedalboardState(updates: Partial<AmpPedalboardState>): void {
    this.ampPedalState = { ...this.ampPedalState, ...updates };
    const ctx = audioEngine.getContext();
    if (ctx && this.masterGain) {
      this.applyPedalboardStateToNodes(ctx);
    }
  }

  private applyPedalboardStateToNodes(ctx: AudioContext): void {
    const s = this.ampPedalState;
    const now = ctx.currentTime;

    const presence = this.activeNodes.get('amp-presence') as BiquadFilterNode | undefined;
    const preampGain = this.activeNodes.get('preamp-gain') as GainNode | undefined;
    const pedalCompressor = this.activeNodes.get('pedal-compressor') as
      DynamicsCompressorNode | undefined;
    const pedalDry = this.activeNodes.get('pedal-dry') as GainNode | undefined;
    const pedalDrive = this.activeNodes.get('pedal-drive') as GainNode | undefined;
    const overdriveShaper = this.activeNodes.get('overdrive-shaper') as WaveShaperNode | undefined;
    const overdriveTone = this.activeNodes.get('overdrive-tone') as BiquadFilterNode | undefined;
    const overdriveWet = this.activeNodes.get('pedal-wet') as GainNode | undefined;
    const cabinetNode = this.activeNodes.get('cabinet-convolver') as ConvolverNode | undefined;
    const delayNode = this.activeNodes.get('delay-node') as DelayNode | undefined;
    const delayFeedback = this.activeNodes.get('delay-feedback') as GainNode | undefined;
    const delayWet = this.activeNodes.get('delay-wet') as GainNode | undefined;
    const chorusWet = this.activeNodes.get('chorus-wet') as GainNode | undefined;
    const roomSend = this.activeNodes.get('room-send') as GainNode | undefined;
    const roomReturn = this.activeNodes.get('room-return') as GainNode | undefined;

    // Tone stack is now solved per-sample inside the AudioWorklet's WdfToneStack
    // (a coupled passive RC network). Sync knob positions via postMessage.
    this.postToneStackUpdate();
    if (presence) presence.gain.setValueAtTime((s.ampPresence - 0.5) * 8, now);

    if (preampGain) {
      let gainBase = 0.5;
      let gainMult = 0.8;
      if (s.ampModel === 'crunch_800') {
        gainBase = 0.7;
        gainMult = 1.6;
      } else if (s.ampModel === 'high_gain') {
        gainBase = 0.9;
        gainMult = 2.4;
      } else if (s.ampModel === 'vox_chime') {
        gainBase = 0.6;
        gainMult = 1.1;
      }
      preampGain.gain.setValueAtTime(gainBase + s.ampGain * gainMult, now);
    }

    if (pedalCompressor) {
      if (s.compressorEnabled) {
        pedalCompressor.threshold.setValueAtTime(-10 - s.compressorSustain * 25, now);
        pedalCompressor.ratio.setValueAtTime(1.5 + s.compressorSustain * 4.5, now);
      } else {
        pedalCompressor.threshold.setValueAtTime(0, now);
        pedalCompressor.ratio.setValueAtTime(1.0, now); // Pristine 1:1 linear pass-through
      }
    }

    if (overdriveShaper) {
      overdriveShaper.curve = createOverdriveCurve(s.overdriveType);
    }

    if (pedalDrive) {
      const driveMul = s.overdriveType === 'fuzz_muff' ? 4.5 : (s.overdriveType === 'distortion' ? 3.0 : 1.8);
      pedalDrive.gain.setValueAtTime(1.0 + s.overdriveDrive * driveMul, now);
    }

    if (overdriveTone) {
      overdriveTone.frequency.setValueAtTime(1800 + s.overdriveTone * 3500, now);
    }

    if (pedalDry && overdriveWet) {
      if (s.overdriveEnabled) {
        pedalDry.gain.setValueAtTime(s.overdriveType === 'fuzz_muff' ? 0.08 : 0.3, now);
        overdriveWet.gain.setValueAtTime(s.overdriveLevel * (s.overdriveType === 'fuzz_muff' ? 1.1 : 0.8), now);
      } else {
        pedalDry.gain.setValueAtTime(1.0, now); // 100% clean bypass
        overdriveWet.gain.setValueAtTime(0.0, now); // 0% overdrive leakage
      }
    }

    if (cabinetNode) {
      cabinetNode.buffer = createCabinetImpulseResponse(ctx, s.cabModel);
    }

    if (delayNode) {
      delayNode.delayTime.setValueAtTime(Math.max(0.05, s.delayTimeMs / 1000), now);
    }

    if (delayFeedback) {
      delayFeedback.gain.setValueAtTime(s.delayEnabled ? s.delayFeedback : 0.0, now);
    }

    if (delayWet) {
      delayWet.gain.setValueAtTime(s.delayEnabled ? s.delayMix : 0.0, now);
    }

    if (chorusWet) {
      chorusWet.gain.setValueAtTime(s.chorusEnabled ? s.chorusMix : 0.0, now);
    }

    if (roomSend && roomReturn) {
      const roomVal = s.reverbEnabled ? 0.05 + s.reverbMix * 0.3 : 0.0;
      roomSend.gain.setValueAtTime(roomVal, now);
      roomReturn.gain.setValueAtTime(roomVal * 1.2, now);
    }

    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(1.0, now);
    }
    if (this.finalOutputGain) {
      this.finalOutputGain.gain.setValueAtTime(s.ampMaster * 2.8 * this.masterVolumeBoost, now);
    }
  }

  public applyRigPreset(presetId: string): void {
    const preset = RIG_PRESETS[presetId];
    if (preset) {
      this.updateAmpPedalboardState(preset.state);
    }
  }

  /**
   * Rebuild or update Web Audio nodes based on the latest solved circuit state.
   *
   * Full teardown + rebuild only runs when the circuit topology actually
   * changed (pickup selection, series wiring, phase, delay structure). Knob
   * value changes — volume, tone, blend, amp/pedalboard settings — hit the
   * live parameter path and just schedule new values on existing nodes.
   */
  updatePipeline(graph: Graph, solverResult: SolverResult | null) {
    let ctx = audioEngine.getContext();
    if (!ctx) {
      void audioEngine.initialize();
      ctx = audioEngine.getContext();
    }
    if (!ctx) return;

    // Evaluate active components in solved graph
    const activeNodes = solverResult?.activeNodes;
    const activeComponents = activeNodes
      ? graph
          .getComponents()
          .filter((c) => graph.getComponentNodes(c.id).some((n) => activeNodes.has(n.id)))
      : [];

    const result: SolverResult = solverResult ?? {
      activeNodes: new Set(),
      activeEdges: new Set(),
      activePaths: [],
      deadEndNodes: new Set(),
    };

    // Detect Active Pickup Characteristics & Topology
    const topology = this.detectActiveTopology(activeComponents, graph, result);
    this.wdfSolver.buildFromGraph(graph, result);

    if (audioEngine.isWorkletReady() && ctx.audioWorklet) {
      this.instantiateWdfWorklet(ctx, graph);
    }

    // Topology signature: structural features only, excluding value knobs.
    // Blend gains and master volume/tone are live parameters applied below.
    const structureKey =
      topology.pickups
        .map(
          (p) =>
            `${p.id}|${p.type}|${p.resonantFreq}|${p.resonantQ}|${p.isOutofPhase ? 1 : 0}|${p.delayTimeMs}`,
        )
        .join(';') + `|${topology.isSeries ? 1 : 0}`;

    if (this.masterGain && this.structuralKey === structureKey) {
      // Same circuit — knob automation path, no node churn.
      this.applyPedalboardStateToNodes(ctx);
      this.applyLiveTopologyParams(ctx);
      return;
    }

    // Disconnect old nodes
    this.cleanupNodes();
    this.structuralKey = structureKey;

    // 1. Input trim.
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // 2. Magnetic pickup model: bypassed. The dynamic circuit routing in
    // routeInputThroughTopology already provides accurate per-pickup comb
    // filtering and resonance peaks. The redundant global EQ has been removed.

    // 3. Stompbox pedalboard: a restrained compressor and transparent
    // overdrive before the amp. The dry blend keeps pick attack intact.
    // A dedicated headroom limiter sits first: fast attack, high threshold,
    // steep ratio — it stops summed strum transients from slamming into the
    // waveshaper stages over unity, while the musical compressor below stays
    // free for tone and sustain shaping.
    const headroomLimiter = ctx.createDynamicsCompressor();
    headroomLimiter.threshold.setValueAtTime(-2, ctx.currentTime);
    headroomLimiter.knee.setValueAtTime(0, ctx.currentTime);
    headroomLimiter.ratio.setValueAtTime(12, ctx.currentTime);
    headroomLimiter.attack.setValueAtTime(0.002, ctx.currentTime);
    headroomLimiter.release.setValueAtTime(0.08, ctx.currentTime);

    const pedalCompressor = ctx.createDynamicsCompressor();
    pedalCompressor.threshold.setValueAtTime(-25, ctx.currentTime);
    pedalCompressor.knee.setValueAtTime(18, ctx.currentTime);
    pedalCompressor.ratio.setValueAtTime(3, ctx.currentTime);
    pedalCompressor.attack.setValueAtTime(0.028, ctx.currentTime);
    pedalCompressor.release.setValueAtTime(0.09, ctx.currentTime);

    const pedalDry = ctx.createGain();
    pedalDry.gain.value = 0.82;
    const pedalDrive = ctx.createGain();
    pedalDrive.gain.value = 1.05;
    const overdrive = ctx.createWaveShaper();
    overdrive.curve = createOverdriveCurve(this.ampPedalState.overdriveType);
    overdrive.oversample = '4x';
    const overdriveTone = ctx.createBiquadFilter();
    overdriveTone.type = 'lowpass';
    overdriveTone.frequency.value = 4600;
    overdriveTone.Q.value = 0.35;
    const pedalWet = ctx.createGain();
    pedalWet.gain.value = 0.12;
    const pedalMix = ctx.createGain();

    // 4. Two-stage tube preamp and a simple Fender/Marshall-like tone stack.
    const preampInput = ctx.createBiquadFilter();
    preampInput.type = 'highpass';
    preampInput.frequency.value = 95;
    preampInput.Q.value = 0.65;

    const preampGain = ctx.createGain();
    preampGain.gain.value = 1.35;
    const preampTube = ctx.createWaveShaper();
    preampTube.curve = createTubeCurve(this.ampPedalState.ampModel);
    preampTube.oversample = '4x';

    const interstage = ctx.createBiquadFilter();
    interstage.type = 'peaking';
    interstage.frequency.value = 720;
    interstage.Q.value = 0.7;
    interstage.gain.value = 1.2;

    const secondTubeGain = ctx.createGain();
    secondTubeGain.gain.value = 1.05;
    const secondTube = ctx.createWaveShaper();
    secondTube.curve = createTubeCurve(this.ampPedalState.ampModel);
    secondTube.oversample = '4x';

    // 4b. Passive tone stack — the coupled RC network (bass/mid/treble pots
    // sharing a resistive ladder) is now solved per-sample inside the
    // AudioWorklet's WdfToneStack.  A unity-gain pass-through replaces the
    // old three-band BiquadFilterNode chain here so the signal path stays
    // continuous without double-filtering.
    const toneStackPassthrough = ctx.createGain();
    toneStackPassthrough.gain.value = 1.0;

    // 5. Power amp: a second tube stage drives the speaker. Sag/compression
    // is handled by the single final limiter below — stacked generic browser
    // compressors risk audible pumping.
    const powerAmpGain = ctx.createGain();
    powerAmpGain.gain.value = 1.05;
    const powerAmpTube = ctx.createWaveShaper();
    powerAmpTube.curve = createTubeCurve(this.ampPedalState.ampModel);
    powerAmpTube.oversample = '4x';

    // 6. Speaker/cabinet impulse response and speaker roll-off.
    const cabinet = ctx.createConvolver();
    cabinet.buffer = createCabinetImpulseResponse(ctx, this.ampPedalState.cabModel);
    cabinet.normalize = true;
    const cabHighpass = ctx.createBiquadFilter();
    cabHighpass.type = 'highpass';
    cabHighpass.frequency.value = 85;
    cabHighpass.Q.value = 0.65;
    const cabBody = ctx.createBiquadFilter();
    cabBody.type = 'peaking';
    cabBody.frequency.value = 155;
    cabBody.Q.value = 0.75;
    cabBody.gain.value = 0.3;
    const cabConePeak = ctx.createBiquadFilter();
    cabConePeak.type = 'peaking';
    cabConePeak.frequency.value = 2100;
    cabConePeak.Q.value = 0.7;
    cabConePeak.gain.value = 0.6;
    const ampPresence = ctx.createBiquadFilter();
    ampPresence.type = 'peaking';
    ampPresence.frequency.value = 3200;
    ampPresence.Q.value = 0.75;
    ampPresence.gain.value = 0.3;
    const cabLowpass = ctx.createBiquadFilter();
    cabLowpass.type = 'lowpass';
    cabLowpass.frequency.value = 5000;
    cabLowpass.Q.value = 0.6;

    // 6b. Analog / Tape Echo Delay Stage
    const delayNode = ctx.createDelay(2.0);
    delayNode.delayTime.value = Math.max(0.05, this.ampPedalState.delayTimeMs / 1000);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 2800; // Warm tape/analog repeats
    delayFilter.Q.value = 0.5;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = this.ampPedalState.delayEnabled ? this.ampPedalState.delayFeedback : 0.0;
    const delayWet = ctx.createGain();
    delayWet.gain.value = this.ampPedalState.delayEnabled ? this.ampPedalState.delayMix : 0.0;

    // 6c. Stereo Chorus / Liquid Flanger Modulation Stage
    const chorusDelay = ctx.createDelay(0.1);
    chorusDelay.delayTime.value = 0.024;
    if (typeof ctx.createOscillator === 'function') {
      const chorusLfo = ctx.createOscillator();
      chorusLfo.type = 'sine';
      chorusLfo.frequency.value = this.ampPedalState.chorusRate;
      const chorusLfoGain = ctx.createGain();
      chorusLfoGain.gain.value = this.ampPedalState.chorusDepth * 0.0035;
      chorusLfo.connect(chorusLfoGain);
      chorusLfoGain.connect(chorusDelay.delayTime);
      chorusLfo.start();
      this.activeNodes.set('chorus-lfo', chorusLfo as unknown as AudioNode);
    }
    const chorusWet = ctx.createGain();
    chorusWet.gain.value = this.ampPedalState.chorusEnabled ? this.ampPedalState.chorusMix : 0.0;

    // 7. Stereo Room & Output Mixer
    const ampBus = ctx.createGain();
    ampBus.gain.value = 1.0;
    const roomSend = ctx.createGain();
    roomSend.gain.value = 0.08;
    const room = ctx.createConvolver();
    room.buffer = createRoomImpulseResponse(ctx);
    room.normalize = true;
    const roomReturn = ctx.createGain();
    roomReturn.gain.value = 0.12;

    const stereoMerger = ctx.createChannelMerger(2);

    // 8. Final anti-clipping dynamics limiter.
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-3, ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(6, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(8, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.15, ctx.currentTime);

    // Analyser Node for Visual Oscilloscope
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Register active nodes for live parameter updates
    this.activeNodes.set('pedal-compressor', pedalCompressor);
    this.activeNodes.set('pedal-dry', pedalDry);
    this.activeNodes.set('pedal-drive', pedalDrive);
    this.activeNodes.set('overdrive-shaper', overdrive);
    this.activeNodes.set('overdrive-tone', overdriveTone);
    this.activeNodes.set('pedal-wet', pedalWet);
    this.activeNodes.set('preamp-gain', preampGain);
    this.activeNodes.set('amp-presence', ampPresence);
    this.activeNodes.set('cabinet-convolver', cabinet);
    this.activeNodes.set('delay-node', delayNode);
    this.activeNodes.set('delay-feedback', delayFeedback);
    this.activeNodes.set('delay-wet', delayWet);
    this.activeNodes.set('chorus-wet', chorusWet);
    this.activeNodes.set('room-send', roomSend);
    this.activeNodes.set('room-return', roomReturn);

    // Connect pickup -> pedals -> tube amp -> cabinet -> delay -> chorus & room -> output.
    this.masterGain.connect(headroomLimiter);
    headroomLimiter.connect(pedalCompressor);
    pedalCompressor.connect(pedalDry);
    pedalCompressor.connect(pedalDrive);
    pedalDrive.connect(overdrive);
    overdrive.connect(overdriveTone);
    overdriveTone.connect(pedalWet);
    pedalDry.connect(pedalMix);
    pedalWet.connect(pedalMix);
    pedalMix.connect(preampInput);
    preampInput.connect(preampGain);
    preampGain.connect(preampTube);
    preampTube.connect(interstage);
    interstage.connect(secondTubeGain);
    secondTubeGain.connect(secondTube);
    secondTube.connect(toneStackPassthrough);
    toneStackPassthrough.connect(powerAmpGain);
    powerAmpGain.connect(powerAmpTube);
    powerAmpTube.connect(cabinet);

    cabinet.connect(cabHighpass);
    cabHighpass.connect(cabBody);
    cabBody.connect(cabConePeak);
    cabConePeak.connect(ampPresence);
    ampPresence.connect(cabLowpass);

    // Delay routing (filtered feedback loop)
    cabLowpass.connect(delayNode);
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayFilter.connect(delayWet);

    cabLowpass.connect(ampBus);
    delayWet.connect(ampBus);

    // Chorus modulation routing
    ampBus.connect(chorusDelay);
    chorusDelay.connect(chorusWet);

    // Reverb send/return
    ampBus.connect(roomSend);
    roomSend.connect(room);
    room.connect(roomReturn);

    // Direct stereo routing
    ampBus.connect(stereoMerger, 0, 0); // Left channel (dry + delay)
    ampBus.connect(stereoMerger, 0, 1); // Right channel (dry + delay)
    chorusWet.connect(stereoMerger, 0, 1); // Right channel (modulated chorus for liquid stereo width)
    roomReturn.connect(stereoMerger);

    this.finalOutputGain = ctx.createGain();
    this.finalOutputGain.gain.value = this.ampPedalState.ampMaster * 2.8 * this.masterVolumeBoost;

    stereoMerger.connect(this.compressorNode);
    this.compressorNode.connect(this.finalOutputGain);
    this.finalOutputGain.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    // Preload the real-guitar sample bank while the graph is being solved.
    void this.initializeSampleBank(ctx);

    this.applyPedalboardStateToNodes(ctx);
    this.routeInputThroughTopology(ctx, 1.0);
  }

  private useSamples = true;

  public setUseSamples(use: boolean): void {
    this.useSamples = use;
    this.emitStateChange();
  }

  public isUsingSamples(): boolean {
    return this.useSamples;
  }

  /**
   * Kick off the local sample-bank load. Non-blocking — callers that need
   * the bank before playing await the returned promise.
   */
  private initializeSampleBank(ctx: AudioContext): Promise<void> {
    return this.sampleBank.startLoad(ctx).then(() => {
      this.emitStateChange();
    });
  }

  private findGuitarSampleBuffer(
    targetMidi: number,
    velocity: number,
  ): { buffer: AudioBuffer; rootMidi: number } | null {
    return this.sampleBank.findNote(targetMidi, velocity);
  }

  /**
   * Applies realistic non-linear physical pitch automation:
   * 1. Sigmoidal S-curve tension build-up and release for bends and releases.
   * 2. Automatic singing apex vibrato (~5.8 Hz, +-25 cents) during the sustain of bent notes.
   * 3. Friction glissando for slides.
   */
  private applySigmoidalPitchAutomation(
    rateParam: AudioParam,
    startPitchShift: number,
    endPitchShift: number,
    now: number,
    articulation: string,
  ): void {
    if (articulation === 'bend') {
      const durationSec = 0.22;
      rateParam.setValueAtTime(startPitchShift, now);
      // S-curve tension phase 1 (slow initial stretch): 25% time -> 15% pitch delta
      const t1 = now + durationSec * 0.25;
      const r1 = startPitchShift + (endPitchShift - startPitchShift) * 0.15;
      rateParam.linearRampToValueAtTime(r1, t1);

      // S-curve tension phase 2 (rapid transit): 70% time -> 85% pitch delta
      const t2 = now + durationSec * 0.70;
      const r2 = startPitchShift + (endPitchShift - startPitchShift) * 0.85;
      rateParam.linearRampToValueAtTime(r2, t2);

      // S-curve apex arrival
      const tApex = now + durationSec;
      rateParam.linearRampToValueAtTime(endPitchShift, tApex);

      // Apex singing vibrato: sinusoidal wrist modulation at ~5.8 Hz across sustain
      const vibDepth = 0.015; // ~25 cents
      const cycleSec = 0.086;
      for (let i = 0; i < 8; i++) {
        const tCycle = tApex + i * cycleSec * 2;
        rateParam.linearRampToValueAtTime(endPitchShift * (1 + vibDepth), tCycle + cycleSec * 0.5);
        rateParam.linearRampToValueAtTime(endPitchShift * (1 - vibDepth), tCycle + cycleSec * 1.5);
      }
    } else if (articulation === 'release') {
      const durationSec = 0.18;
      rateParam.setValueAtTime(startPitchShift, now);
      // Fast drop from bent pitch
      const t1 = now + durationSec * 0.4;
      const r1 = startPitchShift + (endPitchShift - startPitchShift) * 0.65;
      rateParam.linearRampToValueAtTime(r1, t1);
      // Decelerate into resting fret pitch
      rateParam.linearRampToValueAtTime(endPitchShift, now + durationSec);
    } else if (articulation === 'slide_up' || articulation === 'slide_down') {
      const durationSec = 0.16;
      rateParam.setValueAtTime(startPitchShift, now);
      const tMid = now + durationSec * 0.5;
      const rMid = startPitchShift + (endPitchShift - startPitchShift) * 0.75;
      rateParam.linearRampToValueAtTime(rMid, tMid);
      rateParam.linearRampToValueAtTime(endPitchShift, now + durationSec);
    } else if (articulation === 'hammer' || articulation === 'pull') {
      rateParam.setValueAtTime(startPitchShift, now);
      rateParam.linearRampToValueAtTime(endPitchShift, now + 0.06);
    } else if (articulation === 'vibrato') {
      rateParam.setValueAtTime(startPitchShift, now);
      const vibDepth = 0.015;
      const cycleSec = 0.08;
      for (let i = 0; i < 6; i++) {
        const t = now + i * cycleSec * 2;
        rateParam.linearRampToValueAtTime(startPitchShift * (1 + vibDepth), t + cycleSec * 0.5);
        rateParam.linearRampToValueAtTime(startPitchShift * (1 - vibDepth), t + cycleSec * 1.5);
      }
    } else {
      rateParam.setValueAtTime(startPitchShift, now);
    }
  }

  private triggerRecordedGuitar(
    ctx: AudioContext,
    freq: number,
    velocity: number,
    chordSize: number = 1,
    startTime?: number,
    articulation: string = 'none',
    targetFreq?: number,
    stringIndex: number = 0,
  ): boolean {
    const targetMidi = Math.round(69 + 12 * Math.log2(freq / 440));
    const sample = this.findGuitarSampleBuffer(targetMidi, velocity);
    if (!sample || !this.sampleInputNode) return false;

    const now = startTime && startTime > ctx.currentTime ? startTime : ctx.currentTime + 0.001;

    // Use closest sample for all target pitches across the fretboard
    const source = ctx.createBufferSource();
    source.buffer = sample.buffer;
    const exactTargetMidi = 69 + 12 * Math.log2(freq / 440);
    const pitchShift = 2 ** ((exactTargetMidi - sample.rootMidi) / 12);

    // Apply Non-Linear Articulation Pitch Automations (Sigmoidal S-Curve Bends, Apex Vibrato, Friction Slides)
    const endFreq = targetFreq || (
      articulation === 'slide_up' ? freq * 1.122 :
      articulation === 'slide_down' ? freq * 0.89 :
      articulation === 'bend' ? freq * 1.122 :
      articulation === 'release' ? freq * 0.89 : freq
    );
    const endTargetMidi = 69 + 12 * Math.log2(endFreq / 440);
    const endPitchShift = 2 ** ((endTargetMidi - sample.rootMidi) / 12);

    this.applySigmoidalPitchAutomation(
      source.playbackRate,
      pitchShift,
      endPitchShift,
      now,
      articulation,
    );

    const sampleGain = ctx.createGain();
    const pitchCompensation = Math.max(1.0, Math.sqrt(pitchShift));
    // Polyphony-aware gain floor: without the chord-size term every note
    // contributes a hardcoded 0.3 into the shared bus, so a 6-note chord
    // guarantees 1.8× before any velocity scaling — clipping on arrival.
    const gainFloor = 0.3 / Math.sqrt(chordSize);
    const gainVal = Math.min(1.2, Math.max(gainFloor, (velocity * 1.25) / pitchCompensation));
    sampleGain.gain.setValueAtTime(gainVal, ctx.currentTime);

    // Non-linear Touch & Pick Brightness / Bite Filter
    // Harder digging excites 3kHz-6kHz pick transients; softer touch keeps warmth
    const touchFilter = ctx.createBiquadFilter();
    touchFilter.type = 'highshelf';
    const brightnessDb = (velocity - 0.5) * 6.0;
    touchFilter.frequency.setValueAtTime(3200, now);
    touchFilter.gain.setValueAtTime(brightnessDb, now);

    // Dedicated DSP filtering for dead notes (mute), palm muting, harmonics, and ghost notes
    if (articulation === 'mute') {
      const deadBand = ctx.createBiquadFilter();
      deadBand.type = 'bandpass';
      deadBand.frequency.setValueAtTime(1200, now);
      deadBand.Q.setValueAtTime(2.0, now);
      sampleGain.gain.setValueAtTime(gainVal * 0.45, now);
      sampleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      source.connect(deadBand);
      deadBand.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else if (articulation === 'palm_mute') {
      const pmLowpass = ctx.createBiquadFilter();
      pmLowpass.type = 'lowpass';
      pmLowpass.frequency.setValueAtTime(800, now);
      pmLowpass.Q.setValueAtTime(1.2, now);
      sampleGain.gain.setValueAtTime(gainVal * 0.7, now);
      sampleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      source.connect(pmLowpass);
      pmLowpass.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else if (articulation === 'harmonic') {
      const bellHigh = ctx.createBiquadFilter();
      bellHigh.type = 'highpass';
      bellHigh.frequency.setValueAtTime(900, now);
      bellHigh.Q.setValueAtTime(1.5, now);
      source.connect(bellHigh);
      bellHigh.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else if (articulation === 'ghost') {
      sampleGain.gain.setValueAtTime(gainVal * 0.4, now);
      source.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else if (pitchShift < 0.85) {
      // Slowing down a sample (playbackRate < 0.85) drops body formants into sub-bass,
      // making it sound like a bass guitar. A dynamic highpass filter removes the mud.
      const lowCut = ctx.createBiquadFilter();
      lowCut.type = 'highpass';
      const cutoff = Math.min(160, Math.max(80, 110 / Math.sqrt(pitchShift)));
      lowCut.frequency.setValueAtTime(cutoff, ctx.currentTime);
      lowCut.Q.setValueAtTime(0.55, ctx.currentTime);
      source.connect(lowCut);
      lowCut.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else if (pitchShift > 1.05) {
      const highDamp = ctx.createBiquadFilter();
      highDamp.type = 'lowpass';
      const cutoff = Math.max(4500, Math.min(6500, 7200 / Math.sqrt(pitchShift)));
      highDamp.frequency.setValueAtTime(cutoff, ctx.currentTime);
      highDamp.Q.setValueAtTime(0.55, ctx.currentTime);
      source.connect(highDamp);
      highDamp.connect(touchFilter);
      touchFilter.connect(sampleGain);
    } else {
      source.connect(touchFilter);
      touchFilter.connect(sampleGain);
    }
    sampleGain.connect(this.sampleInputNode);
    this.activeSampleSources.set(stringIndex, { source, gain: sampleGain });
    this.updateSampleBusGain(ctx);

    source.onended = () => {
      // Only remove if this source is still the active one for this string
      const current = this.activeSampleSources.get(stringIndex);
      if (current && current.source === source) {
        this.activeSampleSources.delete(stringIndex);
      }
      this.updateSampleBusGain(ctx);
      try {
        source.disconnect();
        sampleGain.disconnect();
      } catch {
        // Ignored: the source may already be disconnected during cleanup.
      }
    };
    source.start(startTime && startTime > ctx.currentTime ? startTime : ctx.currentTime + 0.001);
    return true;
  }

  /**
   * Polyphony compensation on the sample bus: scale the shared input gain
   * inversely with the number of simultaneously ringing notes (1/sqrt(n)
   * power normalization) so already-ringing notes duck alongside the new
   * note instead of stacking toward clipping. Smoothed to avoid clicks.
   */
  private updateSampleBusGain(ctx: AudioContext): void {
    if (!this.sampleInputNode) return;
    const count = Math.max(1, this.activeSampleSources.size);
    const comp = 1 / Math.sqrt(count);
    this.sampleInputNode.gain.setTargetAtTime(comp, ctx.currentTime, 0.012);
  }

  /**
   * Damp (silence/mute) the currently ringing note on a specific string.
   * amount: 0.0 (soft fretting-hand release) to 1.0 (hard palm/dead-note mute).
   */
  dampString(stringIndex: number, amount: number = 1.0, time?: number): void {
    const ctx = audioEngine.getContext();
    if (!ctx) return;
    const dampTime = time && time > ctx.currentTime ? time : ctx.currentTime;
    const clampedAmount = Math.max(0.0, Math.min(1.0, amount));

    // Damp sample-based source on this string
    const entry = this.activeSampleSources.get(stringIndex);
    if (entry) {
      try {
        const tau = 0.008 + 0.04 * (1.0 - clampedAmount);
        entry.gain.gain.setTargetAtTime(0.0001, dampTime, tau);
        // Schedule stop slightly after the ramp finishes
        setTimeout(() => {
          try {
            entry.source.stop();
            entry.source.disconnect();
            entry.gain.disconnect();
          } catch {
            // Ignored: source may already have ended
          }
          // Only remove if still the current entry for this string
          const current = this.activeSampleSources.get(stringIndex);
          if (current && current.source === entry.source) {
            this.activeSampleSources.delete(stringIndex);
            this.updateSampleBusGain(ctx);
          }
        }, Math.max(0, (dampTime - ctx.currentTime) * 1000) + 60);
      } catch {
        // Ignored
      }
    }

    // Damp WDF / physical string worklet node
    if (this.wdfWorkletNode) {
      this.wdfWorkletNode.port.postMessage({
        type: 'damp',
        string_idx: stringIndex,
        amount: clampedAmount,
        time: dampTime,
      });
    }
  }

  /**
   * Check whether the sample bank is available for direct recorded playback.
   */
  isSampleBankReady(): boolean {
    return this.sampleBank.isReady();
  }

  private triggerSynthesizedGuitar(
    ctx: AudioContext,
    freq: number,
    velocity: number,
    startTime?: number,
    articulation: string = 'none',
    targetFreq?: number,
    stringIndex: number = 0,
  ): boolean {
    if (this.wdfWorkletNode) {
      // Always pluck at the starting frequency
      this.wdfWorkletNode.port.postMessage({
        type: 'pluck',
        string_idx: stringIndex,
        freq: freq,
        velocity: velocity,
        time: startTime,
      });

      // For articulations that involve pitch glide, send a bend message
      if (articulation === 'slide_up' || articulation === 'slide_down') {
        const endFreq = targetFreq || (articulation === 'slide_up' ? freq * 1.122 : freq * 0.89);
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: endFreq,
          durationMs: 150,
          time: startTime,
        });
      } else if (articulation === 'bend') {
        const endFreq = targetFreq || freq * 1.122;
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: endFreq,
          durationMs: 180,
          time: startTime,
        });
      } else if (articulation === 'release') {
        const endFreq = targetFreq || freq * 0.89;
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: endFreq,
          durationMs: 150,
          time: startTime,
        });
      } else if (articulation === 'hammer' || articulation === 'pull') {
        // Legato: glide to target with no new pick transient
        if (targetFreq) {
          this.wdfWorkletNode.port.postMessage({
            type: 'bend',
            string_idx: stringIndex,
            targetFreq: targetFreq,
            durationMs: 60,
            time: startTime,
          });
        }
      } else if (articulation === 'vibrato') {
        // Vibrato: schedule multiple small bends
        const vibratoDepth = 1.015; // ~25 cents
        const cycleSec = 0.08;
        const baseTime = startTime && startTime > ctx.currentTime ? startTime : ctx.currentTime;
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: freq * vibratoDepth,
          durationMs: 80,
          time: baseTime,
        });
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: freq / vibratoDepth,
          durationMs: 80,
          time: baseTime + cycleSec,
        });
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: freq,
          durationMs: 80,
          time: baseTime + cycleSec * 2,
        });
      } else if (targetFreq && targetFreq !== freq) {
        // Direct retune glide
        this.wdfWorkletNode.port.postMessage({
          type: 'bend',
          string_idx: stringIndex,
          targetFreq: targetFreq,
          durationMs: 120,
          time: startTime,
        });
      }

      return true;
    }

    if (!this.inputNode) return false;
    const now = startTime && startTime > ctx.currentTime ? startTime : ctx.currentTime + 0.001;

    // Physical String Waveguide Model (Direct Target Pitch - No Pitch Shifting).
    // Pure renderer in karplusStrong.ts so the string physics stay testable.
    const isMuted = articulation === 'palm_mute' || articulation === 'mute';
    const ksData = renderKarplusStrong(freq, velocity, ctx.sampleRate, { muted: isMuted });
    const ksBuffer = ctx.createBuffer(1, ksData.length, ctx.sampleRate);
    ksBuffer.getChannelData(0).set(ksData);

    const stringSource = ctx.createBufferSource();
    stringSource.buffer = ksBuffer;
    stringSource.playbackRate.value = 1.0;

    const rawStringMix = ctx.createGain();
    rawStringMix.gain.setValueAtTime(1.0, now);

    // Body voicing: kill subsonic rumble, add the hollow body/air bump and a
    // touch of presence so the string reads as a guitar rather than a plink.
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(70, now);
    highpass.Q.setValueAtTime(0.7, now);

    const bodyResonance = ctx.createBiquadFilter();
    bodyResonance.type = 'peaking';
    bodyResonance.frequency.setValueAtTime(150, now);
    bodyResonance.Q.setValueAtTime(1.1, now);
    bodyResonance.gain.setValueAtTime(4.5, now);

    const presence = ctx.createBiquadFilter();
    presence.type = 'highshelf';
    presence.frequency.setValueAtTime(2600, now);
    presence.gain.setValueAtTime(3.5, now);

    const env = ctx.createGain();
    const peakGain = Math.min(0.8, Math.max(0.04, velocity));
    const sustain = isMuted ? 0.5 : sustainSeconds(freq);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.0015);
    const releaseStart = now + Math.max(0.05, sustain * 0.7);
    const releaseTau = Math.max(0.3, sustain * 0.3);
    env.gain.setTargetAtTime(0.0001, releaseStart, releaseTau);

    // Apply Non-Linear Articulation Pitch Automations (Sigmoidal S-Curve Bends, Apex Vibrato, Friction Slides)
    const endFreq = targetFreq || (
      articulation === 'slide_up' ? freq * 1.122 :
      articulation === 'slide_down' ? freq * 0.89 :
      articulation === 'bend' ? freq * 1.122 :
      articulation === 'release' ? freq * 0.89 : freq
    );
    const endShift = endFreq / freq;

    this.applySigmoidalPitchAutomation(
      stringSource.playbackRate,
      1.0,
      endShift,
      now,
      articulation,
    );

    stringSource.connect(rawStringMix);
    rawStringMix.connect(highpass);
    highpass.connect(bodyResonance);
    bodyResonance.connect(presence);

    // Palm Muting (mute articulation) Filter & Fast Envelope
    if (articulation === 'mute') {
      const muteFilter = ctx.createBiquadFilter();
      muteFilter.type = 'lowpass';
      muteFilter.frequency.setValueAtTime(850, now);
      muteFilter.Q.setValueAtTime(1.0, now);
      env.gain.setValueAtTime(peakGain * 0.6, now + 0.0015);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      presence.connect(muteFilter);
      muteFilter.connect(env);
    } else {
      presence.connect(env);
    }

    env.connect(this.inputNode);

    stringSource.start(now);

    setTimeout(() => {
      try {
        stringSource.disconnect();
        rawStringMix.disconnect();
        highpass.disconnect();
        bodyResonance.disconnect();
        presence.disconnect();
        env.disconnect();
      } catch {
        // Ignored
      }
    }, 8500);

    return true;
  }

  /**
   * Determine physical pickup resonant profile, routing, and series/parallel/phase status.
   */
  private detectActiveTopology(
    activeComponents: ReturnType<Graph['getComponents']>,
    graph: Graph,
    solverResult: SolverResult,
  ): CircuitTopologyState {
    const pickupComps = activeComponents.filter(
      (c) =>
        c.type === 'pickup_single_coil' || c.type === 'pickup_humbucker' || c.type === 'pickup_p90',
    );

    if (pickupComps.length === 0) {
      this.activeTopology = {
        pickups: [
          {
            id: 'fallback-single-coil',
            type: 'pickup_single_coil',
            resonantFreq: 3400,
            resonantQ: 2.2,
            isOutofPhase: false,
            blendGain: 1.0,
            delayTimeMs: 1.5,
          },
        ],
        isSeries: false,
        masterVolume: 1.0,
        masterTone: 1.0,
      };
      return this.activeTopology;
    }

    // Parse Master Volume & Tone pots
    let masterVol = 1.0;
    let masterTone = 1.0;
    let blendGain = 0.0;

    for (const comp of activeComponents) {
      if (comp.type === 'pot_volume' || comp.type === 'pot_pushpull') {
        const val = comp.value as { position: number; taper: string } | undefined;
        masterVol = val?.position ?? 1.0;
        if (val?.taper !== 'linear') masterVol = Math.pow(masterVol, 2.5);
      } else if (comp.type === 'pot_tone') {
        const val = comp.value as { position: number } | undefined;
        masterTone = val?.position ?? 1.0;
      } else if (comp.type === 'pot_concentric') {
        // Assume concentric outer is tone, inner is blend (simplification for indie rock tele)
        const val = comp.value as { position: number } | undefined;
        blendGain = val?.position ?? 1.0;
      }
    }

    // Check for Series Connection (Bridge ground connected to Neck hot path)
    let isSeries = false;
    const neckComp = pickupComps.find((c) => c.id.includes('neck'));
    const bridgeComp = pickupComps.find((c) => c.id.includes('bridge'));
    if (neckComp && bridgeComp) {
      // Very basic heuristic for series: check if bridge ground reaches output tip
      const bridgeGroundNodes = graph
        .getComponentNodes(bridgeComp.id)
        .filter((n) => n.role === 'ground');
      isSeries = bridgeGroundNodes.some(
        (n) => solverResult.activeNodes.has(n.id) && !solverResult.deadEndNodes.has(n.id),
      );
    }

    // Determine Phase Reversal (DPDT Push-Pull state)
    const hasDpdtPhase = activeComponents.some((c) => {
      const swState = graph.getSwitchState(c.id);
      return (
        (c.type === 'switch_dpdt' || c.type === 'pot_pushpull') && swState?.currentPosition === 2
      );
    });

    const pickups: ActivePickupState[] = pickupComps.map((p, idx) => {
      const idLower = `${p.id} ${p.label ?? ''}`.toLowerCase();
      const isNeck =
        idLower.includes('neck') ||
        idLower.includes('front') ||
        (idx === 0 && pickupComps.length > 1);
      const isBridge =
        idLower.includes('bridge') ||
        idLower.includes('rear') ||
        (idx === 1 && pickupComps.length > 1);
      const isMiddle = idLower.includes('middle') || idx === 2;

      let resonantFreq = 3400;
      let resonantQ = 2.2;
      let delayMs = 1.1; // Middle default

      if (p.type === 'pickup_humbucker') {
        resonantFreq = isBridge ? 2800 : isNeck ? 2100 : isMiddle ? 2400 : 2400;
        resonantQ = 2.8;
        delayMs = isBridge ? 0.3 : isNeck ? 2.0 : isMiddle ? 1.1 : 1.1;
      } else if (p.type === 'pickup_p90') {
        resonantFreq = isBridge ? 4100 : isNeck ? 2600 : isMiddle ? 3200 : 3200;
        resonantQ = 2.4;
        delayMs = isBridge ? 0.2 : isNeck ? 2.1 : isMiddle ? 1.2 : 1.2;
      } else {
        // Single Coil
        resonantFreq = isBridge ? 4800 : isNeck ? 2800 : isMiddle ? 3600 : 3600;
        resonantQ = 3.2;
        delayMs = isBridge ? 0.2 : isNeck ? 2.2 : isMiddle ? 1.2 : 1.2;
      }

      // If it's the neck pickup on a phase-reversible circuit, invert phase
      const isOutofPhase = hasDpdtPhase && (isNeck || idx === 0);

      // Handle concentric blender pots
      const isBlendNeck = isNeck && activeComponents.some((c) => c.type === 'pot_concentric');
      const gain = isBlendNeck ? blendGain : 1.0;

      return {
        id: p.id,
        type: p.type,
        resonantFreq,
        resonantQ,
        isOutofPhase,
        blendGain: gain,
        delayTimeMs: delayMs,
      };
    });

    this.activeTopology = {
      pickups,
      isSeries,
      masterVolume: masterVol,
      masterTone,
    };
    return this.activeTopology;
  }

  /**
   * Knob automation: schedule updated volume/tone/blend values on the
   * existing pickup routing nodes without rebuilding the graph.
   */
  private applyLiveTopologyParams(ctx: AudioContext): void {
    const topology = this.activeTopology;
    const now = ctx.currentTime;

    const currentGraph = useCircuitStore.getState().graph;
    this.postWdfUpdate(currentGraph);

    if (this.masterToneFilter) {
      const minFreq = 350;
      const maxFreq = 10000;
      this.masterToneFilter.frequency.setValueAtTime(
        minFreq + Math.pow(topology.masterTone, 2) * (maxFreq - minFreq),
        now,
      );
    }

    if (this.outputGainNode) {
      this.outputGainNode.gain.setValueAtTime(topology.masterVolume, now);
    }

    const seriesBoost = topology.isSeries && topology.pickups.length > 1 ? 1.4 : 1.0;
    for (const pickup of topology.pickups) {
      const branchGain = this.pickupBranchGains.get(pickup.id);
      if (!branchGain) continue;
      let gainVal = pickup.blendGain * seriesBoost;
      if (pickup.isOutofPhase) gainVal *= -1;
      branchGain.gain.setValueAtTime(gainVal, now);
    }
  }

  /**
   * Set input audio source type
   */
  async setSourceType(type: InputSourceType) {
    if (type === 'mic') {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn('Microphone access denied:', err);
      }
    } else {
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
    }
  }

  /**
   * Trigger an authentic real-guitar string pluck from decoded sample bank
   */
  async triggerPluck(
    freq: number = 329.63,
    velocity: number = 0.55,
    _stringIndex: number = 0,
    chordSize: number = 1,
    startTime?: number,
    articulation: string = 'none',
    targetFreq?: number,
  ): Promise<void> {
    let ctx = audioEngine.getContext();
    if (!ctx) {
      await audioEngine.initialize();
      ctx = audioEngine.getContext();
    }
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Check if graph needs building
    if (!this.masterGain) {
      this.updatePipeline(
        useCircuitStore.getState().graph,
        useCircuitStore.getState().solverResult,
      );
    }
    if (!this.masterGain) return;

    // Kick off the local sample-bank load without blocking the pluck. On the
    // first pluck the bank may still be decoding, so fall back to waiting for
    // it (local WAV files — fast, no network round trip).
    const bankPromise = this.initializeSampleBank(ctx);
    this.routeInputThroughTopology(ctx, velocity);

    if (this.useSamples) {
      if (
        !this.triggerRecordedGuitar(
          ctx,
          freq,
          velocity,
          chordSize,
          startTime,
          articulation,
          targetFreq,
          _stringIndex,
        )
      ) {
        await bankPromise;
        if (this.inputNode) {
          if (
            !this.triggerRecordedGuitar(
              ctx,
              freq,
              velocity,
              chordSize,
              startTime,
              articulation,
              targetFreq,
              _stringIndex,
            )
          ) {
            this.triggerSynthesizedGuitar(ctx, freq, velocity, startTime, articulation, targetFreq, _stringIndex);
          }
        }
      }
    } else {
      this.triggerSynthesizedGuitar(ctx, freq, velocity, startTime, articulation, targetFreq, _stringIndex);
    }
  }

  private routeInputThroughTopology(ctx: AudioContext, _velocity: number) {
    if (!this.masterGain) return;
    if (this.topologyRouted) return;

    const now = ctx.currentTime;
    const topology = this.activeTopology;

    if (!this.inputNode) {
      this.inputNode = ctx.createGain();
      this.inputNode.gain.setValueAtTime(1.0, now);
      this.activeNodes.set('input-bus', this.inputNode);
    }
    if (!this.sampleInputNode) {
      this.sampleInputNode = ctx.createGain();
      this.sampleInputNode.gain.setValueAtTime(1.0, now);
      this.activeNodes.set('sample-input-bus', this.sampleInputNode);
    }
    const rawStringMix = this.inputNode;

    // Connect sampleInputNode to rawStringMix so real guitar DI samples
    // are processed by the canvas circuit (WDF passive solver & pickup EQ).
    this.sampleInputNode.disconnect();
    this.sampleInputNode.connect(rawStringMix);

    if (this.wdfWorkletNode) {
      // Clean rewire: on the worklet-ready reroute the bus may already be
      // connected straight to masterGain from the no-worklet fallback route.
      rawStringMix.disconnect();
      this.wdfWorkletNode.disconnect();
      try {
        rawStringMix.connect(this.wdfWorkletNode);
        this.wdfWorkletNode.connect(this.masterGain);
      } catch {
        rawStringMix.connect(this.masterGain);
      }
      this.topologyRouted = true;
      return;
    }

    // 2. Pickup Branches (Parallel physical filtering with power-normalized mix bus)
    const numPickups = Math.max(1, topology.pickups.length);
    const mixNorm = 1 / Math.sqrt(numPickups);
    const pickupMixNode = ctx.createGain();
    pickupMixNode.gain.setValueAtTime(mixNorm, now);

    if (topology.pickups.length === 0) {
      // Direct fallback routing so audio always plays even on open/empty circuits
      rawStringMix.disconnect();
      rawStringMix.connect(this.masterGain);
      this.topologyRouted = true;
      return;
    }

    const isSeries = topology.isSeries && topology.pickups.length > 1;
    const seriesBoost = isSeries ? 1.4 : 1.0;
    const seriesFreqShift = isSeries ? 0.75 : 1.0;

    for (const pickup of topology.pickups) {
      const delayNode = ctx.createDelay(0.01);
      delayNode.delayTime.setValueAtTime(pickup.delayTimeMs / 1000, now);
      const directPosition = ctx.createGain();
      directPosition.gain.setValueAtTime(0.72, now);
      const delayedPosition = ctx.createGain();
      delayedPosition.gain.setValueAtTime(0.28, now);

      rawStringMix.connect(directPosition);
      rawStringMix.connect(delayNode);
      delayNode.connect(delayedPosition);

      const pickupResonance = ctx.createBiquadFilter();
      pickupResonance.type = 'peaking';
      pickupResonance.frequency.setValueAtTime(pickup.resonantFreq * seriesFreqShift, now);
      pickupResonance.Q.setValueAtTime(pickup.resonantQ, now);
      pickupResonance.gain.setValueAtTime(1.8, now); // Smooth physical pickup resonant peak
      directPosition.connect(pickupResonance);
      delayedPosition.connect(pickupResonance);

      const branchGain = ctx.createGain();
      let gainVal = pickup.blendGain * seriesBoost;
      if (pickup.isOutofPhase) gainVal *= -1;
      branchGain.gain.setValueAtTime(gainVal, now);

      pickupResonance.connect(branchGain);
      branchGain.connect(pickupMixNode);

      this.pickupBranchGains.set(pickup.id, branchGain);
      this.activeNodes.set(`pickup-${pickup.id}-${now}`, delayNode);
      this.activeNodes.set(`pickup-direct-${pickup.id}-${now}`, directPosition);
      this.activeNodes.set(`pickup-delayed-${pickup.id}-${now}`, delayedPosition);
      this.activeNodes.set(`pickupRes-${pickup.id}-${now}`, pickupResonance);
      this.activeNodes.set(`pickupGain-${pickup.id}-${now}`, branchGain);
    }

    // Master Tone
    const masterToneFilter = ctx.createBiquadFilter();
    masterToneFilter.type = 'lowpass';
    const minFreq = 350;
    const maxFreq = 10000;
    masterToneFilter.frequency.setValueAtTime(
      minFreq + Math.pow(topology.masterTone, 2) * (maxFreq - minFreq),
      now,
    );
    masterToneFilter.Q.setValueAtTime(1.0, now);
    pickupMixNode.connect(masterToneFilter);
    this.masterToneFilter = masterToneFilter;

    // The WASM string model owns each note's natural attack and decay. Use a
    // single stable output gain for the solved circuit instead of creating a
    // new full-mix envelope for every chord note.
    const outputGain = ctx.createGain();
    outputGain.gain.setValueAtTime(topology.masterVolume, now);
    masterToneFilter.connect(outputGain);
    outputGain.connect(this.masterGain);
    this.outputGainNode = outputGain;

    this.activeNodes.set(`pickupMix-${now}`, pickupMixNode);
    this.activeNodes.set(`tone-${now}`, masterToneFilter);
    this.activeNodes.set(`outputGain-${now}`, outputGain);
    this.topologyRouted = true;
  }

  /**
   * Trigger a guitar chord strum with normalized velocity & staggered timing
   */
  triggerStrum(freqs: readonly number[] = GUITAR_CHORDS.E_MAJOR, delayMs: number = 35) {
    // Keep the combined chord energy close to a single pluck while giving
    // every note its own physical-model string. Reusing slot 0 made each
    // staggered note overwrite the previous one, which made chords quiet.
    const chordVelocity = Math.min(0.9, 0.85 / Math.sqrt(freqs.length / 3.0));
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        void this.triggerPluck(freq, chordVelocity, idx % 6, freqs.length);
      }, idx * delayMs);
    });
  }

  /**
   * Toggle automated guitar strumming loop for continuous audio testing
   */
  toggleAutoStrum(enable?: boolean): boolean {
    const nextState = enable !== undefined ? enable : !this.autoStrumming;
    this.autoStrumming = nextState;

    if (this.strumIntervalId) {
      clearInterval(this.strumIntervalId);
      this.strumIntervalId = null;
    }

    if (this.autoStrumming) {
      let chordIndex = 0;
      const chords = [
        GUITAR_CHORDS.E_MAJOR,
        GUITAR_CHORDS.A_MINOR,
        GUITAR_CHORDS.G_MAJOR,
        GUITAR_CHORDS.D_MAJOR,
      ];
      this.triggerStrum(chords[0]);

      this.strumIntervalId = window.setInterval(() => {
        chordIndex = (chordIndex + 1) % chords.length;
        this.triggerStrum(chords[chordIndex]);
      }, 1900);
    }

    this.emitStateChange();
    return this.autoStrumming;
  }

  isAutoStrumming(): boolean {
    return this.autoStrumming;
  }

  /**
   * Original song-style genre demo with distinct sections and arrangements.
   */
  playGenreDemo(genre: GuitarDemoGenre = 'rock'): boolean {
    this.stopDemoSong();
    this.toggleAutoStrum(false);

    const beatDurationMs = 520;
    const barDurationMs = beatDurationMs * 4;

    const scheduleStrum = (
      chord: readonly number[],
      startMs: number,
      velocity: number,
      noteDelayMs = 24,
    ) => {
      this.songTimeoutIds.push(
        window.setTimeout(() => {
          chord.forEach((note, noteIndex) => {
            this.songTimeoutIds.push(
              window.setTimeout(
                () => void this.triggerPluck(note, velocity, noteIndex % 6),
                noteIndex * noteDelayMs,
              ),
            );
          });
        }, startMs),
      );
    };

    const scheduleArpeggio = (
      chord: readonly number[],
      startMs: number,
      velocity: number,
      stepMs: number,
      order: readonly number[],
    ) => {
      order.forEach((chordIndex, noteIndex) => {
        this.songTimeoutIds.push(
          window.setTimeout(
            () =>
              void this.triggerPluck(chord[chordIndex % chord.length], velocity, chordIndex % 6),
            startMs + noteIndex * stepMs,
          ),
        );
      });
    };

    const scheduleNote = (
      frequency: number,
      startMs: number,
      velocity: number,
      stringIndex = 0,
    ) => {
      this.songTimeoutIds.push(
        window.setTimeout(
          () => void this.triggerPluck(frequency, velocity, stringIndex % 6),
          startMs,
        ),
      );
    };

    const scheduleBassLine = (
      notes: readonly number[],
      startMs: number,
      stepMs: number,
      velocity = 0.13,
    ) => {
      notes.forEach((note, noteIndex) => {
        scheduleNote(note, startMs + noteIndex * stepMs, velocity, noteIndex % 3);
      });
    };

    const scheduleFourBarSection = (
      chords: readonly (readonly number[])[],
      startMs: number,
      beats: readonly number[],
      velocity: number,
      noteDelayMs = 24,
    ) => {
      chords.forEach((chord, barIndex) => {
        beats.forEach((beat, beatIndex) => {
          scheduleStrum(
            chord,
            startMs + barIndex * barDurationMs + beat * beatDurationMs,
            beatIndex === 0 ? velocity * 1.12 : velocity,
            noteDelayMs,
          );
        });
      });
    };

    // Every arrangement is 16 bars: intro, verse, chorus, bridge, final
    // chorus/outro. The sections intentionally vary rhythm and single-note
    // movement so this behaves like a small song rather than a chord test.
    switch (genre) {
      case 'rock': {
        const intro = [82.41, 82.41, 98.0, 110.0, 82.41, 123.47];
        scheduleBassLine(intro, 0, beatDurationMs / 2, 0.16);
        scheduleBassLine(intro, barDurationMs, beatDurationMs / 2, 0.16);
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E_MINOR7,
            GUITAR_CHORDS.G_MAJOR,
            GUITAR_CHORDS.D_MAJOR,
            GUITAR_CHORDS.A_MINOR,
          ],
          barDurationMs * 2,
          [0, 2.5],
          0.1,
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.G_MAJOR,
            GUITAR_CHORDS.D_MAJOR,
            GUITAR_CHORDS.E_MINOR7,
          ],
          barDurationMs * 6,
          [0, 1, 2, 3],
          0.12,
        );
        scheduleBassLine([65.41, 98.0, 73.42, 82.41], barDurationMs * 6, barDurationMs, 0.14);
        scheduleArpeggio(
          GUITAR_CHORDS.A_MINOR7,
          barDurationMs * 10,
          0.09,
          180,
          [0, 2, 3, 4, 2, 3, 5, 3],
        );
        scheduleArpeggio(
          GUITAR_CHORDS.C_MAJOR7,
          barDurationMs * 11,
          0.09,
          180,
          [0, 2, 3, 4, 2, 3, 5, 3],
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.G_MAJOR,
            GUITAR_CHORDS.D_MAJOR,
            GUITAR_CHORDS.E_MINOR7,
          ],
          barDurationMs * 12,
          [0, 1, 2, 3],
          0.13,
        );
        break;
      }
      case 'blues': {
        const intro = [110.0, 130.81, 146.83, 164.81, 196.0, 164.81];
        scheduleBassLine(intro, 0, beatDurationMs / 2, 0.14);
        scheduleBassLine(intro.slice().reverse(), barDurationMs, beatDurationMs / 2, 0.14);
        const twelveBarBlues = [
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.D7,
          GUITAR_CHORDS.D7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.E7,
          GUITAR_CHORDS.D7,
          GUITAR_CHORDS.A7,
          GUITAR_CHORDS.E7,
        ];
        scheduleFourBarSection(
          twelveBarBlues.slice(0, 4),
          barDurationMs * 2,
          [0, 1.5, 2, 3.5],
          0.105,
        );
        scheduleFourBarSection(
          twelveBarBlues.slice(4, 8),
          barDurationMs * 6,
          [0, 1.5, 2, 3.5],
          0.115,
        );
        scheduleFourBarSection(twelveBarBlues.slice(8), barDurationMs * 10, [0, 1.5, 2, 3.5], 0.12);
        scheduleBassLine(
          [220.0, 246.94, 261.63, 277.18, 293.66],
          barDurationMs * 6,
          beatDurationMs / 2,
          0.1,
        );
        scheduleBassLine(
          [293.66, 277.18, 261.63, 246.94, 220.0],
          barDurationMs * 10,
          beatDurationMs / 2,
          0.1,
        );
        scheduleFourBarSection(
          [GUITAR_CHORDS.A7, GUITAR_CHORDS.D7, GUITAR_CHORDS.A7, GUITAR_CHORDS.E7],
          barDurationMs * 14,
          [0, 1.5, 2, 3.5],
          0.11,
        );
        break;
      }
      case 'hard-rock': {
        const riff = [82.41, 82.41, 123.47, 82.41, 146.83, 123.47];
        scheduleBassLine(riff, 0, beatDurationMs / 2, 0.19);
        scheduleBassLine(riff, barDurationMs, beatDurationMs / 2, 0.19);
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E5_POWER,
            GUITAR_CHORDS.E5_POWER,
            GUITAR_CHORDS.A5_POWER,
            GUITAR_CHORDS.D5_POWER,
          ],
          barDurationMs * 2,
          [0, 1.5, 2.5, 3.5],
          0.16,
          16,
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E5_POWER,
            GUITAR_CHORDS.G5_POWER,
            GUITAR_CHORDS.A5_POWER,
            GUITAR_CHORDS.D5_POWER,
          ],
          barDurationMs * 6,
          [0, 2],
          0.18,
          16,
        );
        scheduleBassLine(
          [82.41, 82.41, 98.0, 110.0, 123.47, 110.0],
          barDurationMs * 10,
          beatDurationMs / 2,
          0.17,
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E5_POWER,
            GUITAR_CHORDS.G5_POWER,
            GUITAR_CHORDS.A5_POWER,
            GUITAR_CHORDS.D5_POWER,
          ],
          barDurationMs * 12,
          [0, 1.5, 2, 3.5],
          0.18,
          16,
        );
        break;
      }
      case 'alternative-rock': {
        scheduleArpeggio(GUITAR_CHORDS.E_MINOR7, 0, 0.09, 180, [0, 2, 3, 4, 2, 3, 5, 3]);
        scheduleArpeggio(
          GUITAR_CHORDS.C_MAJOR7,
          barDurationMs,
          0.09,
          180,
          [0, 2, 3, 4, 2, 3, 5, 3],
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E_MINOR7,
            GUITAR_CHORDS.G_SIX,
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.D_SUS2_F_SHARP,
          ],
          barDurationMs * 2,
          [0, 2.5],
          0.095,
          30,
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.G_SIX,
            GUITAR_CHORDS.D_SUS2_F_SHARP,
            GUITAR_CHORDS.E_MINOR7,
          ],
          barDurationMs * 6,
          [0, 1.5, 2.5, 3.5],
          0.105,
          30,
        );
        scheduleArpeggio(
          GUITAR_CHORDS.A_MINOR7,
          barDurationMs * 10,
          0.085,
          200,
          [0, 2, 3, 4, 5, 3, 2, 1],
        );
        scheduleArpeggio(
          GUITAR_CHORDS.D_SUS2_F_SHARP,
          barDurationMs * 11,
          0.085,
          200,
          [0, 2, 3, 4, 2, 3, 4, 1],
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.G_SIX,
            GUITAR_CHORDS.D_SUS2_F_SHARP,
            GUITAR_CHORDS.E_MINOR7,
          ],
          barDurationMs * 12,
          [0, 1.5, 2.5, 3.5],
          0.11,
          28,
        );
        break;
      }
      case 'dream-pop': {
        const dreamOrder = [0, 2, 3, 5, 4, 3, 2, 1];
        const introChords = [
          GUITAR_CHORDS.E_MINOR7,
          GUITAR_CHORDS.C_MAJOR7,
          GUITAR_CHORDS.G_SIX,
          GUITAR_CHORDS.D_SUS2_F_SHARP,
        ];
        introChords.forEach((chord, barIndex) =>
          scheduleArpeggio(chord, barIndex * barDurationMs, 0.075, 220, dreamOrder),
        );
        const verseChords = [
          GUITAR_CHORDS.A_MINOR7,
          GUITAR_CHORDS.C_MAJOR7,
          GUITAR_CHORDS.G_SIX,
          GUITAR_CHORDS.D_SUS2_F_SHARP,
        ];
        verseChords.forEach((chord, barIndex) =>
          scheduleArpeggio(
            chord,
            barDurationMs * 4 + barIndex * barDurationMs,
            0.08,
            210,
            dreamOrder,
          ),
        );
        scheduleFourBarSection(
          [
            GUITAR_CHORDS.E_MINOR7,
            GUITAR_CHORDS.C_MAJOR7,
            GUITAR_CHORDS.G_SIX,
            GUITAR_CHORDS.D_SUS2_F_SHARP,
          ],
          barDurationMs * 8,
          [0, 2],
          0.075,
          34,
        );
        [329.63, 392.0, 440.0, 493.88].forEach((note, noteIndex) => {
          scheduleNote(note, barDurationMs * 8 + noteIndex * beatDurationMs * 2, 0.065, 5);
        });
        const outroChords = [
          GUITAR_CHORDS.E_MINOR7,
          GUITAR_CHORDS.D_SUS2_F_SHARP,
          GUITAR_CHORDS.C_MAJOR7,
          GUITAR_CHORDS.G_SIX,
        ];
        outroChords.forEach((chord, barIndex) =>
          scheduleArpeggio(
            chord,
            barDurationMs * 12 + barIndex * barDurationMs,
            0.07,
            250,
            dreamOrder,
          ),
        );
        break;
      }
    }

    this.demoSongPlaying = true;

    this.songTimeoutIds.push(
      window.setTimeout(
        () => {
          this.demoSongPlaying = false;
          this.songTimeoutIds = [];
          this.emitStateChange();
        },
        barDurationMs * 16 + 1800,
      ),
    );

    this.emitStateChange();
    return true;
  }

  stopDemoSong(): void {
    for (const timeoutId of this.songTimeoutIds) {
      clearTimeout(timeoutId);
    }
    this.songTimeoutIds = [];
    this.demoSongPlaying = false;
    this.emitStateChange();
  }

  isDemoSongPlaying(): boolean {
    return this.demoSongPlaying;
  }

  /**
   * Copy current audio time domain waveform data into provided buffer
   */
  getWaveformData(dataArray: Uint8Array): void {
    if (this.analyserNode) {
      this.analyserNode.getByteTimeDomainData(dataArray as any);
    } else {
      dataArray.fill(128);
    }
  }

  public cleanupNodes() {
    for (const node of this.activeNodes.values()) {
      try {
        node.disconnect();
      } catch {
        // Ignored
      }
    }
    this.activeNodes.clear();

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch {
        // Ignored
      }
      this.analyserNode = null;
    }

    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch {
        // Ignored
      }
      this.compressorNode = null;
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {
        // Ignored
      }
      this.masterGain = null;
    }

    this.inputNode = null;
    this.sampleInputNode = null;
    this.topologyRouted = false;
    this.structuralKey = null;
    this.pickupBranchGains.clear();
    this.masterToneFilter = null;
    this.outputGainNode = null;

    if (this.wdfWorkletNode) {
      try {
        this.wdfWorkletNode.disconnect();
      } catch {
        // Ignored
      }
    }

    for (const [, entry] of this.activeSampleSources) {
      try {
        entry.source.stop();
        entry.source.disconnect();
        entry.gain.disconnect();
      } catch {
        // Ignored: a source may already have ended.
      }
    }
    this.activeSampleSources.clear();
  }

  dispose() {
    this.autoStrumming = false;
    this.stopDemoSong();
    if (this.strumIntervalId) {
      clearInterval(this.strumIntervalId);
      this.strumIntervalId = null;
    }
    this.cleanupNodes();
    this.emitStateChange();
  }
}

export const audioPipeline = new AudioPipeline();
