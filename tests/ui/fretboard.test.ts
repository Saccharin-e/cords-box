import { describe, it, expect } from 'vitest';
import {
  calcFretFrequency,
  calcFretMidi,
  midiToNoteName,
  GUITAR_STRINGS,
  CHORD_PRESETS,
} from '../../src/ui/toolbar/PlayableFretboardPanel';

describe('Playable Fretboard Calculations', () => {
  it('should accurately calculate standard open string frequencies', () => {
    expect(GUITAR_STRINGS[0].openFreq).toBeCloseTo(329.63, 1); // High E4
    expect(GUITAR_STRINGS[1].openFreq).toBeCloseTo(246.94, 1); // B3
    expect(GUITAR_STRINGS[2].openFreq).toBeCloseTo(196.00, 1); // G3
    expect(GUITAR_STRINGS[3].openFreq).toBeCloseTo(146.83, 1); // D3
    expect(GUITAR_STRINGS[4].openFreq).toBeCloseTo(110.00, 1); // A2
    expect(GUITAR_STRINGS[5].openFreq).toBeCloseTo(82.41, 1);  // Low E2
  });

  it('should calculate correct fret frequency using equal temperament formula', () => {
    const lowEFreq = GUITAR_STRINGS[5].openFreq; // E2 (82.41 Hz)

    // 5th fret on Low E is A2 (110 Hz)
    const fret5Freq = calcFretFrequency(lowEFreq, 5);
    expect(fret5Freq).toBeCloseTo(110.0, 1);

    // 12th fret on Low E is E3 (164.81 Hz, 1 octave up = 2x open freq)
    const fret12Freq = calcFretFrequency(lowEFreq, 12);
    expect(fret12Freq).toBeCloseTo(lowEFreq * 2, 2);

    // 5th fret on Low E (MIDI 40) is A2 (MIDI 45)
    expect(calcFretMidi(40, 5)).toBe(45);
  });

  it('should correctly format MIDI note numbers to note names with octaves', () => {
    expect(midiToNoteName(60)).toBe('C4');  // Middle C
    expect(midiToNoteName(69)).toBe('A4');  // Concert A (440 Hz)
    expect(midiToNoteName(40)).toBe('E2');  // Low E
    expect(midiToNoteName(64)).toBe('E4');  // High E
    expect(midiToNoteName(61)).toBe('C#4'); // C#
  });

  it('should define valid chord presets with 6-string fret positions', () => {
    const eMajor = CHORD_PRESETS.find((c) => c.name === 'E Major');
    expect(eMajor).toBeDefined();
    expect(eMajor?.frets).toHaveLength(6);
    expect(eMajor?.frets[2]).toBe(1); // G string 1st fret (G#)

    const cMajor = CHORD_PRESETS.find((c) => c.name === 'C Major');
    expect(cMajor).toBeDefined();
    expect(cMajor?.frets[5]).toBeNull(); // Low E muted
  });
});
