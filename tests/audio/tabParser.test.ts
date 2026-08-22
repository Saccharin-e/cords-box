/**
 * tabParser.test.ts — Unit tests for ASCII guitar tab parser
 */

import { describe, it, expect } from 'vitest';
import { parseAsciiTab } from '../../src/audio/tab/tabParser';

describe('tabParser', () => {
  it('should parse a standard 6-line ASCII tab snippet correctly', () => {
    const rawTab = `
e|---0---2---3---|
B|---1---3---0---|
G|---0---2---0---|
D|---2---0---0---|
A|---3-------2---|
E|-----------3---|
`;

    const score = parseAsciiTab(rawTab, 120);

    expect(score.measures.length).toBeGreaterThan(0);
    expect(score.tempoBpm).toBe(120);

    const firstMeasure = score.measures[0];
    expect(firstMeasure.beats.length).toBeGreaterThan(0);

    // Verify notes extracted
    const allNotes = firstMeasure.beats.flatMap((b) => b.notes);
    expect(allNotes.some((n) => n.stringIdx === 0 && n.fret === 0)).toBe(true);
    expect(allNotes.some((n) => n.stringIdx === 1 && n.fret === 1)).toBe(true);
  });

  it('should consume technique target frets properly for bends, slides, and hammer-ons', () => {
    const rawTab = `
e|---7b9---10/12---5h7---7p5---|
B|-----------------------------|
G|-----------------------------|
D|-----------------------------|
A|-----------------------------|
E|-----------------------------|
`;

    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    // 7b9 should produce ONE note on string 0 with fret 7, articulation 'bend', and targetFret 9 (NOT a separate note for 9)
    const bendNotes = notes.filter((n) => n.stringIdx === 0 && n.articulation === 'bend');
    expect(bendNotes.length).toBe(1);
    expect(bendNotes[0].fret).toBe(7);
    expect(bendNotes[0].targetFret).toBe(9);

    // 10/12 should produce ONE note with fret 10, articulation 'slide_up', targetFret 12
    const slideNotes = notes.filter((n) => n.stringIdx === 0 && n.articulation === 'slide_up');
    expect(slideNotes.length).toBe(1);
    expect(slideNotes[0].fret).toBe(10);
    expect(slideNotes[0].targetFret).toBe(12);

    // 5h7 should produce ONE hammer note with fret 5, targetFret 7
    const hammerNotes = notes.filter((n) => n.stringIdx === 0 && n.articulation === 'hammer');
    expect(hammerNotes.length).toBe(1);
    expect(hammerNotes[0].fret).toBe(5);
    expect(hammerNotes[0].targetFret).toBe(7);

    // 7p5 should produce ONE pull note with fret 7, targetFret 5
    const pullNotes = notes.filter((n) => n.stringIdx === 0 && n.articulation === 'pull');
    expect(pullNotes.length).toBe(1);
    expect(pullNotes[0].fret).toBe(7);
    expect(pullNotes[0].targetFret).toBe(5);

    // Total notes in this measure should be exactly 4, NOT 8!
    expect(notes.length).toBe(4);
  });

  it('should extract vibrato, dead notes (x), and natural harmonics (<12>)', () => {
    const rawTab = `
e|---7v---7~---x---<12>---|
B|------------------------|
G|------------------------|
D|------------------------|
A|------------------------|
E|------------------------|
`;

    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    expect(notes.length).toBe(4);

    expect(notes[0].fret).toBe(7);
    expect(notes[0].articulation).toBe('vibrato');

    expect(notes[1].fret).toBe(7);
    expect(notes[1].articulation).toBe('vibrato');

    expect(notes[2].fret).toBe(0);
    expect(notes[2].articulation).toBe('mute');

    expect(notes[3].fret).toBe(12);
    expect(notes[3].articulation).toBe('harmonic');
  });

  it('should derive relative durations from dash spacing', () => {
    const rawTab = `
e|---0-------2---3---|
B|-------------------|
G|-------------------|
D|-------------------|
A|-------------------|
E|-------------------|
`;

    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    expect(notes.length).toBe(3);
    const note0 = notes.find((n) => n.fret === 0);
    const note2 = notes.find((n) => n.fret === 2);

    expect(note0).toBeDefined();
    expect(note2).toBeDefined();
    // note 0 has more dashes after it than note 2, so its durationBeats should be strictly greater
    expect(note0!.durationBeats).toBeGreaterThan(note2!.durationBeats);
  });

  it('should parse bend release (r) correctly', () => {
    const rawTab = `
e|---7b9---9r7---|
B|---------------|
G|---------------|
D|---------------|
A|---------------|
E|---------------|
`;

    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    expect(notes.length).toBe(2);
    expect(notes[0].fret).toBe(7);
    expect(notes[0].articulation).toBe('bend');
    expect(notes[0].targetFret).toBe(9);

    expect(notes[1].fret).toBe(9);
    expect(notes[1].articulation).toBe('release');
    expect(notes[1].targetFret).toBe(7);
  });

  it('should parse ghost/tied notes (n) and standalone releases r<target>', () => {
    const rawTab = `
e|---(14)---r12---|
B|----------------|
G|----------------|
D|----------------|
A|----------------|
E|----------------|
`;
    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    expect(notes.length).toBe(2);
    expect(notes[0].fret).toBe(14);
    expect(notes[0].articulation).toBe('ghost');

    expect(notes[1].articulation).toBe('release');
    expect(notes[1].targetFret).toBe(12);
  });

  it('should support alternate tunings and recognize Eb/D headers', () => {
    const ebTab = `
eb|---0-----------|
Bb|-------0-------|
Gb|-----------0---|
Db|---------------|
Ab|---------------|
Eb|---------------|
`;
    const ebScore = parseAsciiTab(ebTab);
    expect(ebScore.tuningId).toBe('eb_standard');

    const dTab = `
d|---0-----------|
A|-------0-------|
F|-----------0---|
C|---------------|
G|---------------|
D|---------------|
`;
    const dScore = parseAsciiTab(dTab);
    expect(dScore.tuningId).toBe('d_standard');

    // Explicit tuningId override
    const customScore = parseAsciiTab(ebTab, 140, 'drop_d');
    expect(customScore.tuningId).toBe('drop_d');
  });

  it('should handle open string (fret 0) as a valid pull-off target', () => {
    const rawTab = `
e|---5p0---3p0---|
B|---------------|
G|---------------|
D|---------------|
A|---------------|
E|---------------|
`;
    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    const pullNotes = notes.filter((n) => n.articulation === 'pull');
    expect(pullNotes.length).toBe(2);
    expect(pullNotes[0].fret).toBe(5);
    expect(pullNotes[0].targetFret).toBe(0);
    expect(pullNotes[1].fret).toBe(3);
    expect(pullNotes[1].targetFret).toBe(0);
  });

  it('should handle slide to open string (fret 0)', () => {
    const rawTab = `
e|---3/0---|
B|---------|
G|---------|
D|---------|
A|---------|
E|---------|
`;
    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    const slideNotes = notes.filter((n) => n.articulation === 'slide_up');
    expect(slideNotes.length).toBe(1);
    expect(slideNotes[0].fret).toBe(3);
    expect(slideNotes[0].targetFret).toBe(0);
  });

  it('should parse pinch harmonic [n] notation', () => {
    const rawTab = `
e|---[7]---[12]---|
B|----------------|
G|----------------|
D|----------------|
A|----------------|
E|----------------|
`;
    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    const pinchNotes = notes.filter((n) => n.articulation === 'pinch_harmonic');
    expect(pinchNotes.length).toBe(2);
    expect(pinchNotes[0].fret).toBe(7);
    expect(pinchNotes[0].velocity).toBe(0.9);
    expect(pinchNotes[1].fret).toBe(12);
  });
});
