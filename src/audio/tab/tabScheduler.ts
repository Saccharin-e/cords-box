/**
 * tabScheduler.ts — Web Audio Timeline Tab Playback Scheduler
 */

import type { TabScore, TabNote } from './tabTypes';
import { audioEngine, audioPipeline } from '@audio/index';

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
  private scheduledBeatIndex = 0;

  private onNotePlayCallbacks = new Set<(note: TabNote) => void>();
  private onStateChangeCallbacks = new Set<(isPlaying: boolean) => void>();
  private onBeatCallbacks = new Set<(beat: number) => void>();

  public setScore(score: TabScore): void {
    this.score = score;
    this.bpm = score.tempoBpm || 120;
    this.currentBeat = 0;
    this.scheduledBeatIndex = 0;
    if (this.isPlaying) {
      const ctx = audioEngine.getContext();
      if (ctx) {
        this.startAudioTime = ctx.currentTime + 0.05;
        this.startBeatOffset = 0;
      }
    }
  }

  public setBpm(bpm: number): void {
    this.bpm = Math.max(30, Math.min(300, bpm));
  }

  public seek(beat: number): void {
    const maxBeats = this.getTotalBeats();
    const targetBeat = Math.max(0, Math.min(maxBeats, beat));
    this.currentBeat = targetBeat;
    this.scheduledBeatIndex = Math.floor(targetBeat / 0.25);

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
    this.scheduledBeatIndex = Math.floor(this.currentBeat / 0.25);

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
          this.scheduledBeatIndex = 0;
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
    this.scheduledBeatIndex = 0;
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

  private schedulerLoop(): void {
    const ctx = audioEngine.getContext();
    if (!ctx || !this.score) return;

    const secondsPerBeat = 60.0 / this.bpm;
    const lookaheadSec = 0.15; // Schedule 150ms ahead

    const maxBeats = this.getTotalBeats();
    if (maxBeats <= 0) return;

    // Lookahead until target AudioTime exceeds context.currentTime + lookaheadSec
    while (true) {
      const beatOffset = this.scheduledBeatIndex * 0.25; // 16th-note steps
      if (beatOffset >= maxBeats) break;

      const beatAudioTime = this.startAudioTime + (beatOffset - this.startBeatOffset) * secondsPerBeat;

      if (beatAudioTime > ctx.currentTime + lookaheadSec) {
        break;
      }

      // Schedule notes at exact beatAudioTime
      this.scheduleNotesAtBeat(beatOffset, beatAudioTime);
      this.scheduledBeatIndex++;
    }
  }

  private getTotalBeats(): number {
    if (!this.score || this.score.measures.length === 0) return 0;
    return this.score.measures.length * 4.0;
  }

  private scheduleNotesAtBeat(beatOffset: number, targetAudioTime: number): void {
    if (!this.score) return;

    const measureIdx = Math.floor(beatOffset / 4.0);
    const inMeasureOffset = beatOffset % 4.0;

    const measure = this.score.measures.find((m) => m.index === measureIdx);
    if (!measure) return;

    // Match notes within 16th note tolerance (0.125 beat)
    const beat = measure.beats.find((b) => Math.abs(b.offsetBeats - inMeasureOffset) < 0.125);
    if (!beat) return;

    const openFreqs = [329.63, 246.94, 196.0, 146.83, 110.0, 82.41]; // E4..E2 standard guitar

    // Sort notes by string index descending (Low E to High E) for a natural downstroke strum
    const sortedNotes = [...beat.notes].sort((a, b) => b.stringIdx - a.stringIdx);

    sortedNotes.forEach((note, idx) => {
      const openFreq = openFreqs[note.stringIdx] ?? 110.0;
      const freq = openFreq * Math.pow(2, note.fret / 12);

      // Natural strum stagger: ~6ms per string crossing
      const strumDelay = idx * 0.006;

      // Web Audio microsecond-accurate scheduling with articulation engine
      void audioPipeline.triggerPluck(
        freq,
        note.velocity,
        note.stringIdx,
        beat.notes.length,
        targetAudioTime + strumDelay,
        note.articulation,
      );
      this.onNotePlayCallbacks.forEach((cb) => cb(note));
    });
  }

  private notifyState(): void {
    this.onStateChangeCallbacks.forEach((cb) => cb(this.isPlaying));
  }
}

export const tabScheduler = new TabScheduler();
