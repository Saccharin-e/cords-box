/**
 * webMidiManager.ts — Live Web MIDI USB/Bluetooth Controller Integration
 *
 * Connects to connected MIDI keyboards/controllers via Web MIDI API
 * to trigger live string plucks and real-time fretboard feedback.
 */

import { audioPipeline } from '@audio/pipeline';
import { midiNoteToGuitarFret } from './midiParser';

export interface MidiPortMessageEvent {
  data: Uint8Array;
}

export interface MidiInputPort {
  id: string;
  name?: string;
  onmidimessage: ((event: MidiPortMessageEvent) => void) | null;
}

export interface MidiAccessStateEvent {
  port: {
    type: string;
    state: string;
    id: string;
  };
}

export interface WebMidiAccess {
  inputs: {
    values: () => IterableIterator<MidiInputPort>;
  };
  onstatechange: ((event: MidiAccessStateEvent) => void) | null;
}

export class WebMidiManager {
  private isSupported = false;
  private isConnected = false;
  private midiAccess: WebMidiAccess | null = null;
  private onNoteListeners = new Set<
    (midiNote: number, velocity: number, isNoteOn: boolean) => void
  >();

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public isApiSupported(): boolean {
    return this.isSupported;
  }

  public isMidiConnected(): boolean {
    return this.isConnected;
  }

  public subscribeNoteEvent(
    cb: (midiNote: number, velocity: number, isNoteOn: boolean) => void,
  ): () => void {
    this.onNoteListeners.add(cb);
    return () => this.onNoteListeners.delete(cb);
  }

  public async requestAccess(): Promise<boolean> {
    if (!this.isSupported) return false;

    try {
      const nav = navigator as unknown as { requestMIDIAccess: () => Promise<WebMidiAccess> };
      this.midiAccess = await nav.requestMIDIAccess();
      this.isConnected = true;

      // Attach message handlers to all connected MIDI inputs
      const inputs = this.midiAccess.inputs.values();
      for (const input of inputs) {
        input.onmidimessage = (e: MidiPortMessageEvent) => this.handleMidiMessage(e);
      }

      this.midiAccess.onstatechange = (e: MidiAccessStateEvent) => {
        const port = e.port;
        if (port.type === 'input' && port.state === 'connected') {
          const input = port as unknown as MidiInputPort;
          input.onmidimessage = (msg: MidiPortMessageEvent) => this.handleMidiMessage(msg);
        }
      };

      return true;
    } catch (err) {
      console.warn('Web MIDI Access request failed:', err);
      this.isConnected = false;
      return false;
    }
  }

  private handleMidiMessage(event: MidiPortMessageEvent): void {
    const data = event.data;
    if (!data || data.length < 3) return;

    const command = data[0] & 0xf0;
    const note = data[1];
    const velocity = data[2] / 127.0;

    if (command === 0x90 && velocity > 0) {
      // MIDI Note On
      const { stringIdx, fret } = midiNoteToGuitarFret(note);
      const openFreqs = [329.63, 246.94, 196.0, 146.83, 110.0, 82.41];
      const openFreq = openFreqs[stringIdx] ?? 110.0;
      const freq = openFreq * Math.pow(2, fret / 12);

      void audioPipeline.triggerPluck(freq, velocity, stringIdx);
      this.onNoteListeners.forEach((cb) => cb(note, velocity, true));
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // MIDI Note Off
      this.onNoteListeners.forEach((cb) => cb(note, 0, false));
    }
  }
}

export const webMidiManager = new WebMidiManager();
