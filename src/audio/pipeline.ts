/**
 * Audio Pipeline — Graph-to-WebAudio DSP Synthesizer & Filter Chain
 *
 * Converts solved circuit graph paths into dynamic Web Audio API nodes:
 * - Pickup Sources: Authentic Physical Modeling (Tele twang, Strat chime, Gibson humbucker)
 * - Amp Cabinet Simulation Stage: 12" Speaker Impulse Filter Chain (75Hz HPF, 1.8kHz cone peak, 4.8kHz roll-off)
 * - Potentiometers: Volume (Audio taper pos^2.5), Tone (Lowpass RC roll-off), Concentric, Blend & Push-Pull
 * - Dynamics Processor: Soft-knee compressor preventing digital clipping
 */

import { audioEngine } from './context';
import type { SolverResult } from '@graph/solver';
import type { Graph } from '@graph/Graph';
import { useCircuitStore } from '@store/circuitStore';

export type InputSourceType = 'pluck' | 'strum' | 'mic';

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
  G_MAJOR: [98.0, 123.47, 146.83, 196.0, 246.94, 392.0],
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

export class AudioPipeline {
  private inputNode: AudioNode | null = null;
  private masterGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentSourceType: InputSourceType = 'pluck';
  private micStream: MediaStream | null = null;
  private strumIntervalId: number | null = null;
  private autoStrumming = false;

  private activeNodes: Map<string, AudioNode> = new Map();
  private activeTopology: CircuitTopologyState = {
    pickups: [],
    isSeries: false,
    masterVolume: 1.0,
    masterTone: 1.0,
  };

  /**
   * Rebuild or update Web Audio nodes based on the latest solved circuit state
   */
  updatePipeline(graph: Graph, solverResult: SolverResult | null) {
    let ctx = audioEngine.getContext();
    if (!ctx) {
      void audioEngine.initialize();
      ctx = audioEngine.getContext();
    }
    if (!ctx) return;

    // Disconnect old nodes
    this.cleanupNodes();

    if (!solverResult || solverResult.activePaths.length === 0) {
      // Open circuit / no active output
      return;
    }

    // 1. Master Output Gain Stage
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.4;

    // 2. Electric Guitar Speaker Cabinet Simulation Stage (12" Guitar Speaker Emulation)
    const cabHighpass = ctx.createBiquadFilter();
    cabHighpass.type = 'highpass';
    cabHighpass.frequency.value = 75; // Cut sub-bass rumble

    const cabConePeak = ctx.createBiquadFilter();
    cabConePeak.type = 'peaking';
    cabConePeak.frequency.value = 1800;
    cabConePeak.Q.value = 1.2;
    cabConePeak.gain.value = 2.5; // Speaker cone midrange presence

    const cabLowpass = ctx.createBiquadFilter();
    cabLowpass.type = 'lowpass';
    cabLowpass.frequency.value = 4800; // Smooth 12" speaker high-end roll-off

    // 3. Dynamics Compressor (Prevents digital clipping crackle)
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-14, ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(10, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(8, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.2, ctx.currentTime);

    // 4. Analyser Node for Visual Oscilloscope
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;

    // Connect Cabinet Sim -> Compressor -> Analyser -> Destination
    this.masterGain.connect(cabHighpass);
    cabHighpass.connect(cabConePeak);
    cabConePeak.connect(cabLowpass);
    cabLowpass.connect(this.compressorNode);
    this.compressorNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);    // Create source generator node (for mic passthrough if needed)
    this.inputNode = this.createSourceNode(ctx);
    if (this.inputNode) {
      this.inputNode.connect(this.masterGain);
    }

    // Evaluate active components in solved graph
    const activeComponents = graph
      .getComponents()
      .filter((c) => graph.getComponentNodes(c.id).some((n) => solverResult.activeNodes.has(n.id)));

    // Detect Active Pickup Characteristics & Topology
    this.detectActiveTopology(activeComponents, graph, solverResult);
  }

  /**
   * Determine physical pickup resonant profile, routing, and series/parallel/phase status.
   */
  private detectActiveTopology(
    activeComponents: ReturnType<Graph['getComponents']>,
    graph: Graph,
    solverResult: SolverResult
  ) {
    const pickupComps = activeComponents.filter(
      (c) =>
        c.type === 'pickup_single_coil' ||
        c.type === 'pickup_humbucker' ||
        c.type === 'pickup_p90'
    );

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
    const neckComp = pickupComps.find(c => c.id.includes('neck'));
    const bridgeComp = pickupComps.find(c => c.id.includes('bridge'));
    if (neckComp && bridgeComp) {
      // Very basic heuristic for series: check if bridge ground reaches output tip
      const bridgeGroundNodes = graph.getComponentNodes(bridgeComp.id).filter(n => n.role === 'ground');
      isSeries = bridgeGroundNodes.some(n => solverResult.activeNodes.has(n.id) && !solverResult.deadEndNodes.has(n.id));
    }

    // Determine Phase Reversal (DPDT Push-Pull state)
    const hasDpdtPhase = activeComponents.some((c) => {
      const swState = graph.getSwitchState(c.id);
      return (c.type === 'switch_dpdt' || c.type === 'pot_pushpull') && swState?.currentPosition === 2;
    });

    const pickups: ActivePickupState[] = pickupComps.map(p => {
      let resonantFreq = 3800;
      let resonantQ = 2.0;
      let delayMs = 1.5; // Neck delay

      if (p.type === 'pickup_humbucker') {
        resonantFreq = 2300; resonantQ = 2.8; delayMs = 0.8;
      } else if (p.id.includes('bridge')) {
        resonantFreq = 4800; resonantQ = 3.6; delayMs = 0.2; // Bridge delay (bright)
      } else if (p.id.includes('neck')) {
        resonantFreq = 2800; resonantQ = 1.8; delayMs = 2.1; // Neck delay (warm)
      }

      // If it's the neck pickup on a phase-reversible circuit, invert phase
      const isOutofPhase = hasDpdtPhase && p.id.includes('neck');

      // If it's a half-blender circuit, bridge is full, neck is blended
      const isBlendNeck = p.id.includes('neck') && activeComponents.some(c => c.type === 'pot_concentric');
      const gain = isBlendNeck ? blendGain : 1.0;

      return {
        id: p.id,
        type: p.type,
        resonantFreq,
        resonantQ,
        isOutofPhase,
        blendGain: gain,
        delayTimeMs: delayMs
      };
    });

    this.activeTopology = {
      pickups,
      isSeries,
      masterVolume: masterVol,
      masterTone,
    };
  }

  /**
   * Set input audio source type
   */
  async setSourceType(type: InputSourceType) {
    this.currentSourceType = type;
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
   * Trigger an authentic, organic physical-modeled electric guitar string pluck
   */
  triggerPluck(freq: number = 329.63, velocity: number = 0.35) {
    let ctx = audioEngine.getContext();
    if (!ctx) {
      void audioEngine.initialize();
      ctx = audioEngine.getContext();
    }
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    if (!this.masterGain) {
      this.updatePipeline(useCircuitStore.getState().graph, useCircuitStore.getState().solverResult);
    }
    if (!this.masterGain) return;

    const now = ctx.currentTime;
    const topology = this.activeTopology;

    // 1. Raw String Excitation (Karplus-Strong String Synthesis)
    // We generate a high-quality physical string vibration synchronously in JS
    // and pitch-shift it to the requested frequency.
    const baseFreq = 100.0; // Base frequency that divides cleanly into sampleRate
    const duration = 4.0;
    const sampleRate = ctx.sampleRate;
    const ksLength = Math.floor(sampleRate * duration);
    const ksBuffer = ctx.createBuffer(1, ksLength, sampleRate);
    const ksData = ksBuffer.getChannelData(0);

    const N = Math.round(sampleRate / baseFreq);
    
    // Fill the initial delay line with filtered noise (the pick attack)
    for (let i = 0; i < N; i++) {
      // White noise provides the broad frequency spectrum for a metallic pick
      ksData[i] = (Math.random() * 2 - 1) * velocity;
    }

    // Karplus-Strong waveguide filter loop
    const decay = 0.996; // Steel string sustain (very long)
    const damping = 0.25; // High frequencies reflect strongly (metallic)

    let prev = 0;
    for (let i = N; i < ksLength; i++) {
      const current = ksData[i - N];
      // First order lowpass filter in the feedback loop
      const filtered = current * (1 - damping) + prev * damping;
      ksData[i] = filtered * decay;
      prev = current;
    }

    const stringSource = ctx.createBufferSource();
    stringSource.buffer = ksBuffer;
    // Pitch shift the 100Hz base buffer to the exact requested frequency!
    // This perfectly mimics how higher, tighter strings decay faster.
    stringSource.playbackRate.value = freq / baseFreq;

    // Add a very subtle soft-clipper to mimic a preamp/magnetic pickup compression
    const distortion = ctx.createWaveShaper();
    function makeDistortionCurve(amount = 20) {
      const k = typeof amount === 'number' ? amount : 50;
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        // Soft tube-like clipping
        curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
      }
      return curve;
    }
    distortion.curve = makeDistortionCurve(10);
    distortion.oversample = '2x';

    const rawStringMix = ctx.createGain();
    rawStringMix.gain.setValueAtTime(1.2, now); // Makeup gain

    stringSource.connect(distortion);
    distortion.connect(rawStringMix);

    // 2. Pickup Branches (Parallel physical filtering)
    const pickupMixNode = ctx.createGain();
    pickupMixNode.gain.setValueAtTime(1.0, now);

    if (topology.pickups.length === 0) {
      stringSource.start(now);
      return;
    }

    const isSeries = topology.isSeries && topology.pickups.length > 1;
    const seriesBoost = isSeries ? 1.4 : 1.0;
    const seriesFreqShift = isSeries ? 0.75 : 1.0;

    for (const pickup of topology.pickups) {
      const delayNode = ctx.createDelay(0.01);
      delayNode.delayTime.setValueAtTime(pickup.delayTimeMs / 1000, now);
      rawStringMix.connect(delayNode);

      const pickupResonance = ctx.createBiquadFilter();
      pickupResonance.type = 'peaking';
      pickupResonance.frequency.setValueAtTime(pickup.resonantFreq * seriesFreqShift, now);
      pickupResonance.Q.setValueAtTime(pickup.resonantQ, now);
      pickupResonance.gain.setValueAtTime(6.0, now); // The RLC resonant peak of electric pickups
      delayNode.connect(pickupResonance);

      const branchGain = ctx.createGain();
      let gainVal = pickup.blendGain * seriesBoost;
      if (pickup.isOutofPhase) gainVal *= -1; // Phase inversion!
      branchGain.gain.setValueAtTime(gainVal, now);

      pickupResonance.connect(branchGain);
      branchGain.connect(pickupMixNode);
    }

    // Master Tone
    const masterToneFilter = ctx.createBiquadFilter();
    masterToneFilter.type = 'lowpass';
    const minFreq = 350;
    const maxFreq = 10000;
    masterToneFilter.frequency.setValueAtTime(minFreq + Math.pow(topology.masterTone, 2) * (maxFreq - minFreq), now);
    masterToneFilter.Q.setValueAtTime(1.0, now);
    pickupMixNode.connect(masterToneFilter);

    // Master Volume & Pluck Envelope
    const env = ctx.createGain();
    const peakGain = Math.min(0.8, Math.max(0.04, velocity * topology.masterVolume));
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.002); // Sharp snapping attack
    env.gain.exponentialRampToValueAtTime(0.0001, now + 4.5); // Natural Karplus-Strong sustain handles the rest

    masterToneFilter.connect(env);

    if (this.inputNode) {
      env.connect(this.inputNode);
    } else {
      env.connect(this.masterGain);
    }

    pickSource.start(now);
    osc1.start(now);
    osc2.start(now);
    osc3.start(now);

    osc1.stop(now + 4.1);
    osc2.stop(now + 4.1);
    osc3.stop(now + 4.1);
  }

  /**
   * Trigger a guitar chord strum with normalized velocity & staggered timing
   */
  triggerStrum(freqs: readonly number[] = GUITAR_CHORDS.E_MAJOR, delayMs: number = 35) {
    const chordVelocity = Math.max(0.12, 0.32 / Math.sqrt(freqs.length));
    freqs.forEach((freq, idx) => {
      setTimeout(() => {
        this.triggerPluck(freq, chordVelocity);
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

    return this.autoStrumming;
  }

  isAutoStrumming(): boolean {
    return this.autoStrumming;
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

  private createSourceNode(ctx: AudioContext): AudioNode | null {
    if (this.currentSourceType === 'mic' && this.micStream) {
      return ctx.createMediaStreamSource(this.micStream);
    }

    // Default pass-through gain node for synthesized plucks / inputs
    const inputGain = ctx.createGain();
    inputGain.gain.value = 1.0;
    return inputGain;
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

    if (this.inputNode) {
      try {
        this.inputNode.disconnect();
      } catch {
        // Ignored
      }
      this.inputNode = null;
    }

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
  }

  dispose() {
    this.autoStrumming = false;
    if (this.strumIntervalId) {
      clearInterval(this.strumIntervalId);
      this.strumIntervalId = null;
    }
    this.cleanupNodes();
  }
}

export const audioPipeline = new AudioPipeline();
