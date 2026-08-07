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

  it('should extract techniques and articulations (hammer-ons, slides, muting)', () => {
    const rawTab = `
e|---5h7---7/9---x---|
B|-------------------|
G|-------------------|
D|-------------------|
A|-------------------|
E|-------------------|
`;

    const score = parseAsciiTab(rawTab);
    const notes = score.measures[0].beats.flatMap((b) => b.notes);

    const hammerNote = notes.find((n) => n.fret === 5);
    expect(hammerNote).toBeDefined();
    expect(hammerNote?.articulation).toBe('hammer');

    const slideNote = notes.find((n) => n.articulation === 'slide_up');
    expect(slideNote).toBeDefined();
    expect(slideNote?.fret).toBe(7);

    const muteNote = notes.find((n) => n.articulation === 'mute');
    expect(muteNote).toBeDefined();
  });
});
