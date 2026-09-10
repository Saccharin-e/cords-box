/**
 * midiParser.ts — Standard MIDI File (.mid) Ingestion & Pitch-to-Fret Converter
 *
 * Converts binary MIDI files into structured TabScore objects for live playback.
 */

import type { TabScore, TabMeasure, TabBeat, TabNote } from '../tab/tabTypes';

export interface MidiEvent {
  delta: number;
  type: 'noteOn' | 'noteOff' | 'tempo';
  channel?: number;
  note?: number;
  velocity?: number;
  bpm?: number;
}

export const OPEN_STRING_MIDIS = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2

export function midiNoteToGuitarFret(midiPitch: number): { stringIdx: number; fret: number } {
  let bestString = 5; // Default Low E
  let minFret = 99;

  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const openMidi = OPEN_STRING_MIDIS[sIdx];
    const fret = midiPitch - openMidi;
    if (fret >= 0 && fret <= 19) {
      if (fret < minFret) {
        minFret = fret;
        bestString = sIdx;
      }
    }
  }

  if (minFret > 19) {
    // Clamp to closest string bounds
    if (midiPitch > 64) {
      bestString = 0;
      minFret = Math.min(22, Math.max(0, midiPitch - 64));
    } else {
      bestString = 5;
      minFret = Math.min(22, Math.max(0, midiPitch - 40));
    }
  }

  return { stringIdx: bestString, fret: minFret };
}

/**
 * Parse binary ArrayBuffer of a .mid file into TabScore
 */
export function parseMidiFileBuffer(buffer: ArrayBuffer): TabScore {
  const data = new DataView(buffer);
  let offset = 0;

  // Read Header Chunk "MThd"
  const headerChunk = String.fromCharCode(
    data.getUint8(offset),
    data.getUint8(offset + 1),
    data.getUint8(offset + 2),
    data.getUint8(offset + 3),
  );
  offset += 4;

  if (headerChunk !== 'MThd') {
    throw new Error('Invalid MIDI file: Missing MThd header chunk');
  }

  const headerLength = data.getUint32(offset);
  offset += 4;
  offset += 2; // Skip formatType
  const numTracks = data.getUint16(offset);
  offset += 2;
  const timeDivision = data.getUint16(offset);
  offset += 2;

  offset += headerLength - 6; // Skip remaining header bytes

  let detectedBpm = 120;
  const parsedNotes: { tick: number; note: number; velocity: number; durationTicks: number }[] = [];

  // Parse Track Chunks "MTrk"
  for (let t = 0; t < numTracks; t++) {
    if (offset >= data.byteLength) break;
    const trackChunk = String.fromCharCode(
      data.getUint8(offset),
      data.getUint8(offset + 1),
      data.getUint8(offset + 2),
      data.getUint8(offset + 3),
    );
    offset += 4;

    if (trackChunk !== 'MTrk') {
      break;
    }

    const trackLength = data.getUint32(offset);
    offset += 4;
    const trackEndOffset = offset + trackLength;

    let currentTicks = 0;
    let runningStatus = 0;
    const activeNoteOnMap = new Map<number, { startTick: number; velocity: number }>();

    while (offset < trackEndOffset) {
      // Read Variable Length Quantity (VLQ) for Delta Time
      let delta = 0;
      let byte = 0;
      do {
        byte = data.getUint8(offset++);
        delta = (delta << 7) | (byte & 0x7f);
      } while (byte & 0x80);

      currentTicks += delta;

      let status = data.getUint8(offset);
      if (status & 0x80) {
        runningStatus = status;
        offset++;
      } else {
        status = runningStatus;
      }

      const eventType = status & 0xf0;

      if (eventType === 0x90) {
        // Note On
        const note = data.getUint8(offset++);
        const velocity = data.getUint8(offset++);
        if (velocity > 0) {
          activeNoteOnMap.set(note, { startTick: currentTicks, velocity });
        } else {
          // Velocity 0 = Note Off
          const active = activeNoteOnMap.get(note);
          if (active) {
            parsedNotes.push({
              tick: active.startTick,
              note,
              velocity: active.velocity / 127.0,
              durationTicks: Math.max(1, currentTicks - active.startTick),
            });
            activeNoteOnMap.delete(note);
          }
        }
      } else if (eventType === 0x80) {
        // Note Off
        const note = data.getUint8(offset++);
        offset++; // Read velocity
        const active = activeNoteOnMap.get(note);
        if (active) {
          parsedNotes.push({
            tick: active.startTick,
            note,
            velocity: active.velocity / 127.0,
            durationTicks: Math.max(1, currentTicks - active.startTick),
          });
          activeNoteOnMap.delete(note);
        }
      } else if (status === 0xff) {
        // Meta Event
        const metaType = data.getUint8(offset++);
        let metaLen = 0;
        let b = 0;
        do {
          b = data.getUint8(offset++);
          metaLen = (metaLen << 7) | (b & 0x7f);
        } while (b & 0x80);

        if (metaType === 0x51 && metaLen === 3) {
          // Set Tempo Meta Event (microseconds per quarter note)
          const mpqn =
            (data.getUint8(offset) << 16) |
            (data.getUint8(offset + 1) << 8) |
            data.getUint8(offset + 2);
          detectedBpm = Math.round(60000000 / mpqn);
        }
        offset += metaLen;
      } else if ((status & 0xf0) === 0xb0 || (status & 0xf0) === 0xe0) {
        offset += 2;
      } else if ((status & 0xf0) === 0xc0 || (status & 0xf0) === 0xd0) {
        offset += 1;
      }
    }
  }

  // Sort parsed notes by tick time
  parsedNotes.sort((a, b) => a.tick - b.tick);

  const ticksPerBeat = timeDivision > 0 ? timeDivision : 480;
  const measures: TabMeasure[] = [];

  // Group notes into 4-beat measures
  let currentMeasureIdx = 0;
  let currentMeasureBeats: TabBeat[] = [];

  for (const n of parsedNotes) {
    const totalBeats = n.tick / ticksPerBeat;
    const measureIdx = Math.floor(totalBeats / 4.0);
    const inMeasureOffset = totalBeats % 4.0;

    const guitarNote = midiNoteToGuitarFret(n.note);
    const noteObj: TabNote = {
      stringIdx: guitarNote.stringIdx,
      fret: guitarNote.fret,
      durationBeats: Math.max(0.25, n.durationTicks / ticksPerBeat),
      velocity: Math.min(1.0, Math.max(0.1, n.velocity)),
      articulation: 'none',
    };

    if (measureIdx > currentMeasureIdx) {
      if (currentMeasureBeats.length > 0) {
        measures.push({ index: currentMeasureIdx, beats: currentMeasureBeats });
      }
      currentMeasureIdx = measureIdx;
      currentMeasureBeats = [];
    }

    let beat = currentMeasureBeats.find((b) => Math.abs(b.offsetBeats - inMeasureOffset) < 0.1);
    if (!beat) {
      beat = { offsetBeats: inMeasureOffset, notes: [] };
      currentMeasureBeats.push(beat);
    }
    beat.notes.push(noteObj);
  }

  if (currentMeasureBeats.length > 0) {
    measures.push({ index: currentMeasureIdx, beats: currentMeasureBeats });
  }

  return {
    title: 'Imported MIDI File',
    tuningId: 'standard_e',
    tempoBpm: detectedBpm,
    timeSignature: [4, 4],
    measures,
  };
}
