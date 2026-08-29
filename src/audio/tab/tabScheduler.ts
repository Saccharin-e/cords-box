/**
 * tabScheduler.ts — Web Audio Timeline Tab Playback Scheduler
 *
 * Schedules parsed tab notes for playback using Web Audio's precise timing.
 * Key design:
 *   - Pre-flattens all events at setScore() time into a sorted timeline
 *   - Schedules from actual beat offsets (no fixed-grid quantization)
 *   - Tracks ringing notes per string for damping / legato transitions
 *   - Passes targetFreq through to the pipeline's bend/glide engine
 *   - Uses durationBeats to schedule note-off damping
 */

import type { TabScore, TabNote } from './tabTypes';
import { audioEngine, audioPipeline } from '@audio/index';
import { getTuningFrequencies, useTuningStore } from '@store/tuningStore';

/** A pre-computed event with absolute beat position for direct scheduling. */
interface FlatEvent {
  absoluteBeat: number;
  notes: TabNote[];
}

/** Info about a currently ringing note on a specific string. */
interface RingingNote {
  endBeat: number;
  fret: number;
}

export class TabScheduler {
  private score: TabScore | null = null;
  private isPlaying = false;
  private isLooping = true;
  private bpm = 120;
  private currentBeat = 0;
  private timerId: number | null = null;
  private rafId: number | null = null;

  private startAudioTime = 0;
  private startBeatOffset = 0;

  /** Pre-flattened, sorted timeline of all events with absolute beat positions. */
  private flatEvents: FlatEvent[] = [];
  /** Index into flatEvents for the next event to schedule. */
  private nextEventIndex = 0;

  /** Track what's currently ringing per string (0-5) for damping/legato. */
  private ringingNotes = new Map<number, RingingNote>();

  /** Dynamic open string frequencies for the active score's tuning */
  private openFreqs: number[] = [329.63, 246.94, 196.0, 146.83, 110.0, 82.41];

  private onNotePlayCallbacks = new Set<(note: TabNote) => void>();
  private onStateChangeCallbacks = new Set<(isPlaying: boolean) => void>();
  private onBeatCallbacks = new Set<(beat: number) => void>();

  public setScore(score: TabScore): void {
    this.score = score;
    this.bpm = score.tempoBpm || 120;
    this.currentBeat = 0;
    this.nextEventIndex = 0;
    this.ringingNotes.clear();
    this.openFreqs = getTuningFrequencies(score.tuningId || 'standard_e');
    if (score.tuningId) {
      useTuningStore.getState().setTuning(score.tuningId);
    }
    this.flattenEvents();

    if (this.isPlaying) {
      const ctx = audioEngine.getContext();
      if (ctx) {
        this.startAudioTime = ctx.currentTime + 0.05;
        this.startBeatOffset = 0;
      }
    }
  }

  /**
   * Pre-flatten all measure beats into a single sorted array of events
   * with absolute beat positions. This avoids per-tick measure lookups
   * and eliminates the grid-quantization problem entirely.
   */
  private flattenEvents(): void {
    this.flatEvents = [];
    if (!this.score) return;

    for (const measure of this.score.measures) {
      const measureStartBeat = measure.index * 4.0;
      for (const beat of measure.beats) {
        this.flatEvents.push({
          absoluteBeat: measureStartBeat + beat.offsetBeats,
          notes: beat.notes,
        });
      }
    }

    // Sort by absolute beat position for sequential scheduling
    this.flatEvents.sort((a, b) => a.absoluteBeat - b.absoluteBeat);
  }

  public setBpm(bpm: number): void {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  public seek(beat: number): void {
    const maxBeats = this.getTotalBeats();
    const targetBeat = Math.max(0, Math.min(maxBeats, beat));
    this.currentBeat = targetBeat;

    // Find the first event at or after the target beat
    this.nextEventIndex = this.flatEvents.findIndex((e) => e.absoluteBeat >= targetBeat);
    if (this.nextEventIndex < 0) this.nextEventIndex = this.flatEvents.length;

    this.ringingNotes.clear();

    if (this.isPlaying) {
      const ctx = audioEngine.getContext();
      if (ctx) {
        this.startAudioTime = ctx.currentTime + 0.05;
        this.startBeatOffset = targetBeat;
      }
    }

    this.onBeatCallbacks.forEach((cb) => cb(targetBeat));
  }

  public setLooping(loop: boolean): void {
    this.isLooping = loop;
  }

  public subscribeNotePlay(cb: (note: TabNote) => void): () => void {
    this.onNotePlayCallbacks.add(cb);
    return () => this.onNotePlayCallbacks.delete(cb);
  }

  public subscribeStateChange(cb: (isPlaying: boolean) => void): () => void {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  public subscribeBeat(cb: (beat: number) => void): () => void {
    this.onBeatCallbacks.add(cb);
    return () => this.onBeatCallbacks.delete(cb);
  }

  public start(): void {
    if (this.isPlaying || !this.score) return;
    const ctx = audioEngine.getContext();
    if (!ctx) return;

    this.isPlaying = true;
    this.startAudioTime = ctx.currentTime + 0.05;
    this.startBeatOffset = this.currentBeat;
    this.ringingNotes.clear();

    // Find the first event at or after the current beat
    this.nextEventIndex = this.flatEvents.findIndex((e) => e.absoluteBeat >= this.currentBeat);
    if (this.nextEventIndex < 0) this.nextEventIndex = this.flatEvents.length;

    // Lookahead Audio Scheduler Loop
    this.timerId = window.setInterval(() => this.schedulerLoop(), 25);

    // High-Precision 60 FPS Visual Playhead Loop
    const updateRaf = () => {
      if (!this.isPlaying) return;
      const ctxNow = audioEngine.getContext()?.currentTime ?? 0;
      const elapsedSec = Math.max(0, ctxNow - this.startAudioTime);
      const beatsPerSec = this.bpm / 60.0;
      let liveBeat = this.startBeatOffset + elapsedSec * beatsPerSec;

      const totalBeats = this.getTotalBeats();
      if (liveBeat >= totalBeats && totalBeats > 0) {
        if (this.isLooping) {
          this.startAudioTime = ctxNow;
          this.startBeatOffset = 0;
          this.nextEventIndex = 0;
          this.ringingNotes.clear();
          liveBeat = 0;
        } else {
          this.stop();
          return;
        }
      }

      this.currentBeat = liveBeat;
      this.onBeatCallbacks.forEach((cb) => cb(liveBeat));
      this.rafId = requestAnimationFrame(updateRaf);
    };

    this.rafId = requestAnimationFrame(updateRaf);
    this.notifyState();
  }

  public pause(): void {
    this.stopTimers();
    this.isPlaying = false;
    this.notifyState();
  }

  public stop(): void {
    this.stopTimers();
    this.isPlaying = false;
    this.currentBeat = 0;
    this.nextEventIndex = 0;
    this.dampAllStrings();
    this.ringingNotes.clear();
    this.onBeatCallbacks.forEach((cb) => cb(0));
    this.notifyState();
  }

  private stopTimers(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Core scheduling loop — runs every 25ms.
   * Walks the pre-flattened event array, scheduling any events whose
   * audio time falls within the 150ms lookahead window.
   * No grid quantization — events are scheduled at their exact beat positions.
   */
  private schedulerLoop(): void {
    const ctx = audioEngine.getContext();
    if (!ctx || !this.score) return;

    const secondsPerBeat = 60.0 / this.bpm;
    const lookaheadSec = 0.15; // Schedule 150ms ahead
    const totalBeats = this.getTotalBeats();

    if (totalBeats <= 0) return;

    while (this.nextEventIndex < this.flatEvents.length) {
      const event = this.flatEvents[this.nextEventIndex];

      // Compute exact audio time for this event
      const eventAudioTime = this.startAudioTime +
        (event.absoluteBeat - this.startBeatOffset) * secondsPerBeat;

      // If this event is beyond our lookahead window, stop scheduling
      if (eventAudioTime > ctx.currentTime + lookaheadSec) {
        break;
      }

      // Skip events that are already in the past (can happen after seek)
      if (eventAudioTime >= ctx.currentTime - 0.05) {
        this.scheduleEvent(event, eventAudioTime, secondsPerBeat);
      }

      this.nextEventIndex++;
    }
  }

  /**
   * Schedule a single event's notes for playback.
   * Handles damping previous notes, legato transitions, and target freq passthrough.
   */
  private scheduleEvent(
    event: FlatEvent,
    targetAudioTime: number,
    secondsPerBeat: number,
  ): void {
    // Legato articulations: don't damp the previous note, glide pitch instead
    const LEGATO_ARTS = new Set(['hammer', 'pull', 'slide_up', 'slide_down', 'release']);

    // Sort notes by string index descending (Low E to High E) for natural downstroke strum
    const sortedNotes = [...event.notes].sort((a, b) => b.stringIdx - a.stringIdx);

    sortedNotes.forEach((note, idx) => {
      const openFreq = this.openFreqs[note.stringIdx] ?? 110.0;
      let freq: number;
      if (note.articulation === 'harmonic') {
        if (note.fret === 12) {
          freq = openFreq * 2.0;
        } else if (note.fret === 7 || note.fret === 19) {
          freq = openFreq * 3.0;
        } else if (note.fret === 5 || note.fret === 24) {
          freq = openFreq * 4.0;
        } else if (note.fret === 4 || note.fret === 9 || note.fret === 16) {
          freq = openFreq * 5.0;
        } else {
          freq = openFreq * Math.pow(2, note.fret / 12) * 2.0;
        }
      } else {
        freq = openFreq * Math.pow(2, note.fret / 12);
      }

      // Compute target frequency if targetFret is present
      let targetFreq: number | undefined;
      if (note.targetFret !== undefined) {
        targetFreq = openFreq * Math.pow(2, note.targetFret / 12);
      }

      // Natural strum / rake sweep stagger: ~16ms per string on rakes, ~6ms on chords
      const isRake = sortedNotes.some((n) => n.articulation === 'mute') && sortedNotes.some((n) => n.articulation !== 'mute');
      const staggerSec = isRake ? 0.016 : 0.006;
      const strumDelay = idx * staggerSec;
      const noteStartTime = targetAudioTime + strumDelay;
      const noteDurationSeconds = note.durationBeats * secondsPerBeat;

      // --- Per-string damping/legato logic ---
      const isLegato = LEGATO_ARTS.has(note.articulation);
      const ringing = this.ringingNotes.get(note.stringIdx);

      if (ringing && !isLegato) {
        // Damp the previous note on this string before the new attack
        // Schedule a fast gain ramp-down ~8ms before the new note
        const dampTime = Math.max(noteStartTime - 0.008, targetAudioTime - 0.001);
        audioPipeline.dampString(note.stringIdx, 1.0, dampTime);
      }

      // For legato articulations (hammer/pull/slide), the pipeline's bend/glide
      // engine handles the pitch transition — we still call triggerPluck but the
      // articulation + targetFreq tell the engine to glide rather than re-attack.
      // The engine already has this logic in triggerSynthesizedGuitar/triggerRecordedGuitar.

      // Web Audio microsecond-accurate scheduling with articulation engine
      void audioPipeline.triggerPluck(
        freq,
        note.velocity,
        note.stringIdx,
        event.notes.length,
        noteStartTime,
        note.articulation,
        targetFreq,
        noteDurationSeconds,
      );

      // Track this note as ringing on its string
      this.ringingNotes.set(note.stringIdx, {
        endBeat: event.absoluteBeat + note.durationBeats,
        fret: note.fret,
      });

      // Schedule note-off damp at the note's duration end time.
      // Skip for legato articulations — the next note on the string will
      // glide pitch rather than re-attack, so we don't want to silence it.
      if (!isLegato) {
        const noteEndTime = noteStartTime + noteDurationSeconds;
        // Soft release damp (amount 0.3) for natural note decay
        audioPipeline.dampString(note.stringIdx, 0.3, noteEndTime);
      }

      this.onNotePlayCallbacks.forEach((cb) => cb(note));
    });
  }

  private getTotalBeats(): number {
    if (!this.score || this.score.measures.length === 0) return 0;
    return this.score.measures.length * 4.0;
  }

  private notifyState(): void {
    this.onStateChangeCallbacks.forEach((cb) => cb(this.isPlaying));
  }

  /** Damp all 6 strings to silence any ringing notes (used on stop). */
  private dampAllStrings(): void {
    for (let i = 0; i < 6; i++) {
      audioPipeline.dampString(i, 0.5);
    }
  }
}

export const tabScheduler = new TabScheduler();
