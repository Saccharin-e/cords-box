/**
 * Audio Context Manager
 *
 * Manages the Web Audio API context and AudioWorklet bridge (FR-4).
 * Placeholder for the full DSP pipeline — initial version uses
 * JS AudioWorklet, with WASM bridge designed as drop-in replacement.
 */

export class AudioEngine {
  private context: AudioContext | null = null;

  async initialize(): Promise<void> {
    // AudioContext is not available in the headless test environment.
    // Treat that as an unavailable audio device instead of creating an
    // unhandled rejection while the graph is being solved.
    if (typeof AudioContext === 'undefined') return;

    if (!this.context) {
      this.context = new AudioContext({ sampleRate: 44100, latencyHint: 'interactive' });
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  isReady(): boolean {
    return !!this.context;
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
    }
  }
}

export const audioEngine = new AudioEngine();
