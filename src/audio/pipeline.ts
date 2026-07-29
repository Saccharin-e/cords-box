/**
 * Audio Pipeline — Graph-to-WebAudio DSP Synthesizer & Filter Chain
 *
 * Converts solved circuit graph paths into dynamic Web Audio API nodes:
 * - Pickup Sources: Synthesized harmonic string / Pluck generator / Mic / DI Buffer
 * - Volume Pots: Tapered GainNodes (audio/linear curves)
 * - Tone Pots: Lowpass BiquadFilterNodes (RC cutoff frequency)
 * - Phase Inversion: Polarity-flipped gain stage (-1)
 * - Mixers: Parallel pickup summation & Series chaining
 */

import { audioEngine } from './context';
import type { SolverResult } from '@graph/solver';
import type { Graph } from '@graph/Graph';

export type InputSourceType = 'pluck' | 'strum' | 'mic';

export class AudioPipeline {
  private inputNode: AudioNode | null = null;
  private masterGain: GainNode | null = null;
  private currentSourceType: InputSourceType = 'pluck';
  private micStream: MediaStream | null = null;
  private strumIntervalId: number | null = null;

  private activeNodes: Map<string, AudioNode> = new Map();

  /**
   * Rebuild or update Web Audio nodes based on the latest solved circuit state
   */
  updatePipeline(graph: Graph, solverResult: SolverResult | null) {
    const ctx = audioEngine.getContext();
    if (!ctx || !audioEngine.isReady()) return;

    // Disconnect old nodes
    this.cleanupNodes();

    if (!solverResult || solverResult.activePaths.length === 0) {
      // Open circuit / no active output
      return;
    }

    // Master Gain for safety output level
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(ctx.destination);

    // Create source generator
    this.inputNode = this.createSourceNode(ctx);
    if (!this.inputNode) return;

    // Build processing chain for active signal path
    let lastNode: AudioNode = this.inputNode;

    // Find volume & tone pots in the circuit graph that have active nodes
    const activeComponents = graph.getComponents().filter((c) =>
      graph.getComponentNodes(c.id).some((n) => solverResult.activeNodes.has(n.id))
    );

    for (const comp of activeComponents) {
      if (comp.type === 'pot_volume') {
        const val = comp.value as { position: number; taper: string } | undefined;
        const pos = val?.position ?? 1.0;
        const gainNode = ctx.createGain();
        
        // Audio Taper logarithmic approximation (pos^2.5)
        const gainVal = val?.taper === 'linear' ? pos : Math.pow(pos, 2.5);
        gainNode.gain.value = Math.max(0.0001, gainVal);

        lastNode.connect(gainNode);
        lastNode = gainNode;
        this.activeNodes.set(comp.id, gainNode);
      } else if (comp.type === 'pot_tone') {
        const val = comp.value as { position: number } | undefined;
        const pos = val?.position ?? 1.0;
        const filterNode = ctx.createBiquadFilter();
        filterNode.type = 'lowpass';
        
        // Roll-off cutoff frequency calculation: 10kHz (open) -> 400Hz (closed)
        const minFreq = 400;
        const maxFreq = 10000;
        filterNode.frequency.value = minFreq + Math.pow(pos, 2) * (maxFreq - minFreq);
        filterNode.Q.value = 1.0;

        lastNode.connect(filterNode);
        lastNode = filterNode;
        this.activeNodes.set(comp.id, filterNode);
      }
    }

    // Connect final stage to Master Gain
    lastNode.connect(this.masterGain);
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
   * Trigger a synthesized guitar pluck note
   */
  triggerPluck(freq: number = 329.63) { // High E (E4)
    const ctx = audioEngine.getContext();
    if (!ctx || !audioEngine.isReady() || !this.masterGain) return;

    // Harmonic guitar string synthesis using Karplus-Strong / FM blend
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'sine';

    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    subOsc.frequency.setValueAtTime(freq / 2, ctx.currentTime);

    // Natural decay envelope
    env.gain.setValueAtTime(0.8, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.connect(env);
    subOsc.connect(env);

    if (this.inputNode) {
      env.connect(this.inputNode);
    } else {
      env.connect(this.masterGain);
    }

    osc.start(ctx.currentTime);
    subOsc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.5);
    subOsc.stop(ctx.currentTime + 2.5);
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

  private cleanupNodes() {
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
    this.cleanupNodes();
    if (this.strumIntervalId) {
      clearInterval(this.strumIntervalId);
    }
  }
}

export const audioPipeline = new AudioPipeline();
