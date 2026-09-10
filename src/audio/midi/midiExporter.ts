/**
 * midiExporter.ts — TabScore to Standard MIDI (.mid) Binary Exporter
 *
 * Converts a TabScore object into a downloadable binary .mid file.
 */

import type { TabScore } from '../tab/tabTypes';
import { OPEN_STRING_MIDIS } from './midiParser';

function writeVlq(val: number): number[] {
  const bytes: number[] = [];
  let v = val;
  bytes.push(v & 0x7f);
  while ((v >>= 7) > 0) {
    bytes.push((v & 0x7f) | 0x80);
  }
  return bytes.reverse();
}

export function exportScoreToMidiBuffer(score: TabScore): ArrayBuffer {
  const ticksPerBeat = 480;
  const bpm = score.tempoBpm || 120;
  const mpqn = Math.round(60000000 / bpm);

  // Group events by string index 0..5
  const stringEvents: { tick: number; type: 'on' | 'off'; note: number; vel: number }[][] =
    Array.from({ length: 6 }, () => []);

  for (const measure of score.measures) {
    for (const beat of measure.beats) {
      const absoluteBeat = measure.index * 4.0 + beat.offsetBeats;
      const startTick = Math.round(absoluteBeat * ticksPerBeat);

      for (const note of beat.notes) {
        const sIdx = Math.max(0, Math.min(5, note.stringIdx));
        const openMidi = OPEN_STRING_MIDIS[sIdx] ?? 40;
        const midiPitch = openMidi + note.fret;
        const durationTicks = Math.round((note.durationBeats || 0.5) * ticksPerBeat);
        const endTick = startTick + durationTicks;

        const velByte = Math.min(127, Math.max(1, Math.round((note.velocity || 0.8) * 127)));

        stringEvents[sIdx].push({ tick: startTick, type: 'on', note: midiPitch, vel: velByte });
        stringEvents[sIdx].push({ tick: endTick, type: 'off', note: midiPitch, vel: 0 });
      }
    }
  }

  const trackBytes: number[][] = [];

  // Track 0: Conductor Track (Tempo)
  const conductorBytes: number[] = [
    0x00,
    0xff,
    0x51,
    0x03,
    (mpqn >> 16) & 0xff,
    (mpqn >> 8) & 0xff,
    mpqn & 0xff, // Set Tempo
    0x00,
    0xff,
    0x2f,
    0x00, // End of Track
  ];
  trackBytes.push(conductorBytes);

  // Tracks 1..6: 6 String Tracks
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const events = stringEvents[sIdx];
    events.sort((a, b) => a.tick - b.tick);

    const tBytes: number[] = [];
    let lastTick = 0;

    for (const ev of events) {
      const deltaTicks = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;

      tBytes.push(...writeVlq(deltaTicks));
      if (ev.type === 'on') {
        tBytes.push(0x90, ev.note, ev.vel);
      } else {
        tBytes.push(0x80, ev.note, 0x00);
      }
    }

    // End of Track
    tBytes.push(0x00, 0xff, 0x2f, 0x00);
    trackBytes.push(tBytes);
  }

  // Calculate Total Binary Length
  let totalLength = 14; // Header length
  for (const t of trackBytes) {
    totalLength += 8 + t.length; // MTrk (4) + length (4) + data
  }

  const buffer = new ArrayBuffer(totalLength);
  const data = new DataView(buffer);
  let offset = 0;

  // Write MThd Header
  data.setUint8(offset++, 0x4d); // 'M'
  data.setUint8(offset++, 0x54); // 'T'
  data.setUint8(offset++, 0x68); // 'h'
  data.setUint8(offset++, 0x64); // 'd'
  data.setUint32(offset, 6);
  offset += 4;
  data.setUint16(offset, 1); // Format 1 (multi-track)
  offset += 2;
  data.setUint16(offset, trackBytes.length); // 7 tracks (1 conductor + 6 strings)
  offset += 2;
  data.setUint16(offset, ticksPerBeat);
  offset += 2;

  // Write MTrk Chunks
  for (const t of trackBytes) {
    data.setUint8(offset++, 0x4d); // 'M'
    data.setUint8(offset++, 0x54); // 'T'
    data.setUint8(offset++, 0x72); // 'r'
    data.setUint8(offset++, 0x6b); // 'k'
    data.setUint32(offset, t.length);
    offset += 4;

    for (let i = 0; i < t.length; i++) {
      data.setUint8(offset++, t[i]);
    }
  }

  return buffer;
}

export function downloadMidiFile(score: TabScore, filename = 'cords-box-song.mid'): void {
  const buffer = exportScoreToMidiBuffer(score);
  const blob = new Blob([buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
