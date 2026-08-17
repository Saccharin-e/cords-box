/**
 * tabParser.ts — ASCII Guitar Tablature Parser
 *
 * Parses 6-line plain text ASCII guitar tabs into structured TabScore objects.
 *
 * Standard ASCII tab conventions handled:
 *   digits (0-24)   — fret number; multi-digit frets are a single number
 *   h               — hammer-on (legato ascending)
 *   p               — pull-off (legato descending)
 *   b               — bend up to target fret pitch
 *   r               — release bend back to original fret
 *   /               — slide up
 *   \               — slide down
 *   ~ or v          — vibrato
 *   x               — dead/muted note
 *   t               — right-hand tap
 *   <n>             — natural harmonic at fret n
 *   PM + dash-run   — palm mute span
 *
 * Rhythm is derived from dash-spacing between events on the same string.
 */

import type { TabScore, TabMeasure, TabBeat, TabNote, ArticulationType } from './tabTypes';


/** A raw event parsed from a single string's content before merging into beats. */
interface RawStringEvent {
  col: number;
  stringIdx: number;
  fret: number;
  velocity: number;
  articulation: ArticulationType;
  targetFret?: number;
}

/**
 * Read 1–2 digit fret number starting at position `pos` in `seg`.
 * Returns the parsed number and how many characters were consumed.
 */
function readFret(seg: string, pos: number): { fret: number; len: number } | null {
  if (pos >= seg.length || !/\d/.test(seg[pos])) return null;
  let fretStr = seg[pos];
  if (pos + 1 < seg.length && /\d/.test(seg[pos + 1])) {
    fretStr += seg[pos + 1];
  }
  return { fret: parseInt(fretStr, 10), len: fretStr.length };
}

/**
 * Parse all note events from a single string's measure segment.
 * Each string is parsed independently — no shared column cursor.
 */
function parseStringSegment(
  seg: string,
  stringIdx: number,
  palmMuteRanges: [number, number][],
): RawStringEvent[] {
  const events: RawStringEvent[] = [];
  let col = 0;
  /** Track the last bend's origin fret on this string for release (r) targeting */
  let lastBendOriginFret: number | undefined;

  while (col < seg.length) {
    const ch = seg[col];

    // Natural harmonic: <n> notation
    if (ch === '<') {
      const closeIdx = seg.indexOf('>', col + 1);
      if (closeIdx > col + 1) {
        const inner = seg.substring(col + 1, closeIdx);
        const harmonicFret = parseInt(inner, 10);
        if (!isNaN(harmonicFret)) {
          events.push({
            col,
            stringIdx,
            fret: harmonicFret,
            velocity: 0.7,
            articulation: 'harmonic',
          });
          col = closeIdx + 1;
          continue;
        }
      }
      // Malformed harmonic, skip the '<'
      col++;
      continue;
    }

    // Ghost / Tied note: (n) notation
    if (ch === '(') {
      const closeIdx = seg.indexOf(')', col + 1);
      if (closeIdx > col + 1) {
        const inner = seg.substring(col + 1, closeIdx);
        const ghostFret = parseInt(inner, 10);
        if (!isNaN(ghostFret)) {
          events.push({
            col,
            stringIdx,
            fret: ghostFret,
            velocity: 0.45,
            articulation: 'ghost',
          });
          col = closeIdx + 1;
          continue;
        }
      }
      col++;
      continue;
    }

    // Standalone release notation: r<target> (e.g. r15, r9)
    if (ch === 'r') {
      const targetResult = readFret(seg, col + 1);
      if (targetResult) {
        const relOrigin = lastBendOriginFret !== undefined ? lastBendOriginFret + 2 : targetResult.fret + 2;
        events.push({
          col,
          stringIdx,
          fret: relOrigin,
          velocity: 0.7,
          articulation: 'release',
          targetFret: targetResult.fret,
        });
        lastBendOriginFret = undefined;
        col += 1 + targetResult.len;
        continue;
      }
      col++;
      continue;
    }

    // Dead/muted note or rake
    if (ch.toLowerCase() === 'x') {
      events.push({
        col,
        stringIdx,
        fret: 0,
        velocity: 0.4,
        articulation: 'mute',
      });
      col++;
      continue;
    }

    // Fret digit — this is the main parsing path
    const fretResult = readFret(seg, col);
    if (fretResult) {
      const { fret, len: fretLen } = fretResult;
      let advance = fretLen;
      let articulation: ArticulationType = 'none';
      let targetFret: number | undefined;

      // Check for technique character immediately after the fret digits
      const techPos = col + fretLen;
      if (techPos < seg.length) {
        const techChar = seg[techPos];

        if (techChar === 'h' || techChar === 'p' || techChar === 'b' ||
            techChar === '/' || techChar === '\\' || techChar === 'r' ||
            techChar === 't') {
          // Map technique character to articulation
          if (techChar === 'h') articulation = 'hammer';
          else if (techChar === 'p') articulation = 'pull';
          else if (techChar === 'b') articulation = 'bend';
          else if (techChar === '/') articulation = 'slide_up';
          else if (techChar === '\\') articulation = 'slide_down';
          else if (techChar === 'r') articulation = 'release';
          else if (techChar === 't') articulation = 'tap';

          advance++; // consume the technique character

          // Now read the target fret digit(s) that follow the technique letter
          const targetResult = readFret(seg, techPos + 1);
          if (targetResult) {
            targetFret = targetResult.fret;
            advance += targetResult.len;
          } else if (articulation === 'release' && lastBendOriginFret !== undefined) {
            // Release with no explicit target: target back to the pre-bend fret
            targetFret = lastBendOriginFret;
          }

          // Track bend origin for subsequent release
          if (articulation === 'bend') {
            lastBendOriginFret = fret;
          } else if (articulation === 'release') {
            lastBendOriginFret = undefined;
          }
        } else if (techChar === 'v' || techChar === '~') {
          articulation = 'vibrato';
          advance++; // consume vibrato marker
        }
      }

      // Check if this note falls within a palm-mute span
      if (articulation === 'none') {
        for (const [pmStart, pmEnd] of palmMuteRanges) {
          if (col >= pmStart && col <= pmEnd) {
            articulation = 'palm_mute';
            break;
          }
        }
      }

      events.push({
        col,
        stringIdx,
        fret,
        velocity: 0.8,
        articulation,
        targetFret,
      });

      col += advance;
      continue;
    }

    // Skip dashes, spaces, and any other non-event characters
    col++;
  }

  return events;
}

/**
 * Scan a measure segment for PM + dash-run spans.
 * Returns an array of [startCol, endCol] ranges.
 */
function findPalmMuteRanges(segments: string[]): [number, number][] {
  const ranges: [number, number][] = [];
  for (const seg of segments) {
    let pos = 0;
    while (pos < seg.length) {
      if (seg[pos] === 'P' && pos + 1 < seg.length && seg[pos + 1] === 'M') {
        const pmStart = pos;
        pos += 2;
        // Skip any leading dashes/spaces after PM
        while (pos < seg.length && (seg[pos] === '-' || seg[pos] === ' ')) {
          pos++;
        }
        // The PM span covers from the PM marker to the end of the dash run
        const pmEnd = pos - 1;
        if (pmEnd > pmStart) {
          ranges.push([pmStart, pmEnd]);
        }
      } else {
        pos++;
      }
    }
  }
  return ranges;
}

/**
 * Merge per-string RawStringEvents into TabBeats, grouping events that occur
 * at the same column position into the same beat.
 * Then compute real durations from dash-spacing.
 */
function mergeEventsIntoBeats(
  allEvents: RawStringEvent[],
  segLen: number,
): TabBeat[] {
  if (allEvents.length === 0) return [];

  // Sort by column position
  allEvents.sort((a, b) => a.col - b.col);

  // Group events at the same column into beats
  const beatMap = new Map<number, RawStringEvent[]>();
  for (const ev of allEvents) {
    const existing = beatMap.get(ev.col);
    if (existing) {
      existing.push(ev);
    } else {
      beatMap.set(ev.col, [ev]);
    }
  }

  // Convert column positions to beat offsets within a 4-beat measure
  const effectiveLen = Math.max(1, segLen);
  const beats: TabBeat[] = [];

  for (const [col, events] of beatMap) {
    const offsetBeats = (col / effectiveLen) * 4.0;
    const notes: TabNote[] = events.map((ev) => ({
      stringIdx: ev.stringIdx,
      fret: ev.fret,
      durationBeats: 0.5, // placeholder — computed in the next pass
      velocity: ev.velocity,
      articulation: ev.articulation,
      targetFret: ev.targetFret,
    }));
    beats.push({ offsetBeats, notes });
  }

  // Sort beats by offsetBeats
  beats.sort((a, b) => a.offsetBeats - b.offsetBeats);

  // --- Duration derivation pass ---
  // For each note, find the next event on the same string and compute duration
  // as the gap between their offsetBeats. Last note on a string extends to
  // the measure boundary (4.0 beats), capped at 2.0 beats.
  const MAX_DURATION = 2.0;

  // Build a per-string timeline of beat offsets for quick lookup
  const stringTimelines = new Map<number, number[]>();
  for (const beat of beats) {
    for (const note of beat.notes) {
      const timeline = stringTimelines.get(note.stringIdx);
      if (timeline) {
        // Avoid duplicates (shouldn't happen, but defensive)
        if (timeline[timeline.length - 1] !== beat.offsetBeats) {
          timeline.push(beat.offsetBeats);
        }
      } else {
        stringTimelines.set(note.stringIdx, [beat.offsetBeats]);
      }
    }
  }

  for (const beat of beats) {
    for (const note of beat.notes) {
      const timeline = stringTimelines.get(note.stringIdx);
      if (!timeline) continue;

      const idx = timeline.indexOf(beat.offsetBeats);
      if (idx < 0) continue;

      let duration: number;
      if (idx + 1 < timeline.length) {
        // Duration extends to the next event on this string
        duration = timeline[idx + 1] - beat.offsetBeats;
      } else {
        // Last event on this string: extend to measure end
        duration = 4.0 - beat.offsetBeats;
      }

      note.durationBeats = Math.min(MAX_DURATION, Math.max(0.1, duration));
    }
  }

  return beats;
}

export function parseAsciiTab(
  rawText: string,
  defaultBpm = 120,
  tuningId = 'standard_e',
): TabScore {
  const lines = rawText.split(/\r?\n/).map((l) => l.trimEnd());

  // Group lines into blocks of 6 tab lines
  const tabBlocks: { stringIdx: number; header: string; content: string }[][] = [];
  let currentBlock: { stringIdx: number; header: string; content: string }[] = [];
  let detectedTuningId = tuningId;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match string headers like e|, E4|, Eb|, D#|, B|, B3|, Bb|, G|, Gb|, D|, Db|, A|, Ab|, E|, E2|
    const match = line.match(/^([a-gA-G][b#]?(?:[1-6])?)\s*\|(.*)/);
    if (match) {
      const header = match[1];
      const stringIdx = currentBlock.length;
      const content = match[2];
      currentBlock.push({ stringIdx, header, content });

      if (currentBlock.length === 6) {
        // Auto-detect tuning from headers if tuningId is default standard_e
        if (detectedTuningId === 'standard_e') {
          const headers = currentBlock.map((b) => b.header.toLowerCase());
          if (headers[0]?.startsWith('eb') || headers[0]?.startsWith('d#')) {
            detectedTuningId = 'eb_standard';
          } else if (headers[5] === 'd' || headers[5] === 'd2') {
            if (headers[0] === 'd' || headers[0] === 'd4') {
              detectedTuningId = 'd_standard';
            } else {
              detectedTuningId = 'drop_d';
            }
          }
        }

        tabBlocks.push(currentBlock);
        currentBlock = [];
      }
    }
  }

  const measures: TabMeasure[] = [];
  let globalMeasureIdx = 0;

  for (const block of tabBlocks) {
    // Split each string by measure bar '|' and filter out whitespace-only segments
    const stringBarSegments: string[][] = block.map((b) => b.content.split('|'));
    const maxSegments = Math.max(...stringBarSegments.map((s) => s.length));

    for (let m = 0; m < maxSegments; m++) {
      const measureSegments = block.map((_, idx) => stringBarSegments[idx]?.[m] ?? '');
      // Check if all segments in this column are empty
      if (measureSegments.every((s) => s.trim() === '')) continue;

      const segLen = Math.max(...measureSegments.map((s) => s.length));
      if (segLen === 0) continue;

      // Find palm-mute spans across all strings in this measure
      const palmMuteRanges = findPalmMuteRanges(measureSegments);

      // Parse each string independently with its own cursor
      const allEvents: RawStringEvent[] = [];
      for (let sIdx = 0; sIdx < 6; sIdx++) {
        const seg = measureSegments[sIdx] || '';
        const events = parseStringSegment(seg, sIdx, palmMuteRanges);
        allEvents.push(...events);
      }

      // Merge into beats with real durations
      const beats = mergeEventsIntoBeats(allEvents, segLen);

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
    tuningId: detectedTuningId,
    tempoBpm: defaultBpm,
    timeSignature: [4, 4],
    measures,
  };
}
