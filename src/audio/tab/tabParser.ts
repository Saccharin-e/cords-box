/**
 * tabParser.ts — ASCII Guitar Tablature Parser
 *
 * Parses 6-line plain text ASCII guitar tabs into structured TabScore objects.
 * Handles multi-digit frets (10, 12, 15), technique symbols (h, p, /, \, x),
 * string mapping, and multi-measure blocks.
 */

import type { TabScore, TabMeasure, TabBeat, TabNote, ArticulationType } from './tabTypes';

const STRING_HEADER_MAP: Record<string, number> = {
  e: 0, E4: 0,
  b: 1, B3: 1, B: 1,
  g: 2, G3: 2, G: 2,
  d: 3, D3: 3, D: 3,
  a: 4, A2: 4, A: 4,
  E: 5, E2: 5,
};

export function parseAsciiTab(rawText: string, defaultBpm = 120): TabScore {
  const lines = rawText.split(/\r?\n/).map((l) => l.trimEnd());

  // Group lines into blocks of 6 tab lines
  const tabBlocks: { stringIdx: number; content: string }[][] = [];
  let currentBlock: { stringIdx: number; content: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^([eEbBgGdDaA](?:[234])?)\s*\|(.*)/);
    if (match) {
      const header = match[1];
      const stringIdx = STRING_HEADER_MAP[header] ?? (currentBlock.length % 6);
      const content = match[2];
      currentBlock.push({ stringIdx, content });

      if (currentBlock.length === 6) {
        // Sort block by stringIdx (0..5) so 0 = High E, 5 = Low E
        currentBlock.sort((a, b) => a.stringIdx - b.stringIdx);
        tabBlocks.push(currentBlock);
        currentBlock = [];
      }
    }
  }

  const measures: TabMeasure[] = [];
  let globalMeasureIdx = 0;

  for (const block of tabBlocks) {
    // b.content is string for stringIdx 0..5
    // Split by measure bar '|' and filter out whitespace-only segments
    const stringBarSegments: string[][] = block.map((b) => b.content.split('|'));
    const maxSegments = Math.max(...stringBarSegments.map((s) => s.length));

    for (let m = 0; m < maxSegments; m++) {
      const measureSegments = block.map((_, idx) => stringBarSegments[idx]?.[m] ?? '');
      // Check if all segments in this column are empty
      if (measureSegments.every((s) => s.trim() === '')) continue;

      const segLen = Math.max(...measureSegments.map((s) => s.length));
      if (segLen === 0) continue;

      const beats: TabBeat[] = [];
      let col = 0;

      while (col < segLen) {
        const columnNotes: TabNote[] = [];
        let maxAdvance = 1;

        for (let sIdx = 0; sIdx < 6; sIdx++) {
          const seg = measureSegments[sIdx] || '';
          const char = seg[col] || '-';

          if (/\d/.test(char)) {
            let fretStr = char;
            if (col + 1 < segLen && /\d/.test(seg[col + 1])) {
              fretStr += seg[col + 1];
            }
            const fret = parseInt(fretStr, 10);
            let advance = fretStr.length;

            let articulation: ArticulationType = 'none';
            const nextChar = seg[col + fretStr.length] || '';
            if (nextChar === 'h') { articulation = 'hammer'; advance++; }
            else if (nextChar === 'p') { articulation = 'pull'; advance++; }
            else if (nextChar === '/') { articulation = 'slide_up'; advance++; }
            else if (nextChar === '\\') { articulation = 'slide_down'; advance++; }
            else if (nextChar === 'b') { articulation = 'bend'; advance++; }
            else if (nextChar === 'v' || nextChar === '~') { articulation = 'vibrato'; advance++; }

            if (advance > maxAdvance) maxAdvance = advance;

            columnNotes.push({
              stringIdx: sIdx,
              fret,
              durationBeats: 0.5,
              velocity: 0.8,
              articulation,
            });
          } else if (char.toLowerCase() === 'x') {
            columnNotes.push({
              stringIdx: sIdx,
              fret: 0,
              durationBeats: 0.5,
              velocity: 0.4,
              articulation: 'mute',
            });
          }
        }

        if (columnNotes.length > 0) {
          beats.push({
            offsetBeats: (col / Math.max(1, segLen)) * 4.0,
            notes: columnNotes,
          });
        }

        col += maxAdvance;
      }

      if (beats.length > 0) {
        measures.push({
          index: globalMeasureIdx++,
          beats,
        });
      }
    }
  }

  return {
    title: 'ASCII Tab',
    tuningId: 'standard_e',
    tempoBpm: defaultBpm,
    timeSignature: [4, 4],
    measures,
  };
}
