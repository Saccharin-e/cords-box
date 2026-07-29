/**
 * Audio Context Manager
 *
 * Manages the Web Audio API context and AudioWorklet bridge (FR-4).
 * Placeholder for the full DSP pipeline — initial version uses
 * JS AudioWorklet, with WASM bridge designed as drop-in replacement.
 */

export class AudioEngine {
  private context: AudioContext | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.context = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
    this.isInitialized = true;
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  isReady(): boolean {
    return this.isInitialized && this.context?.state === 'running';
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.context?.state === 'running') {
      await this.context.suspend();
    }
  }

  dispose(): void {
    if (this.context) {
      void this.context.close();
      this.context = null;
      this.isInitialized = false;
    }
  }
}

export const audioEngine = new AudioEngine();
