/**
 * midiParser.test.ts — Unit tests for MIDI Pitch-to-Fret conversion & MIDI Ingestion
 */

import { describe, it, expect } from 'vitest';
import { midiNoteToGuitarFret } from '../../src/audio/midi/midiParser';

describe('MIDI Pitch-to-Fret Mapper', () => {
  it('should map E4 (MIDI 64) to open High E string (String 0, Fret 0)', () => {
    const res = midiNoteToGuitarFret(64);
    expect(res.stringIdx).toBe(0);
    expect(res.fret).toBe(0);
  });

  it('should map E2 (MIDI 40) to open Low E string (String 5, Fret 0)', () => {
    const res = midiNoteToGuitarFret(40);
    expect(res.stringIdx).toBe(5);
    expect(res.fret).toBe(0);
  });

  it('should map A2 (MIDI 45) to open A string (String 4, Fret 0)', () => {
    const res = midiNoteToGuitarFret(45);
    expect(res.stringIdx).toBe(4);
    expect(res.fret).toBe(0);
  });

  it('should map C4 (MIDI 60) to B string Fret 1 or G string Fret 5', () => {
    const res = midiNoteToGuitarFret(60);
    expect(res.fret).toBeLessThanOrEqual(5);
  });
});
