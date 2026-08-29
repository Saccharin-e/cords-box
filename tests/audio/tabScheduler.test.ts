import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { TabNote, TabScore } from '../../src/audio/tab/tabTypes';

const mocks = vi.hoisted(() => ({
  currentTime: 0,
  triggerPluck: vi.fn((..._args: unknown[]) => Promise.resolve()),
  dampString: vi.fn(),
  setTuning: vi.fn(),
  oscillatorStarts: vi.fn(),
  clickFrequencies: [] as number[],
}));

function makeAudioParam() {
  return {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

const audioContextMock = {
  get currentTime() {
    return mocks.currentTime;
  },
  destination: {},
  createOscillator: vi.fn(() => ({
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn((value: number) => mocks.clickFrequencies.push(value)),
    },
    connect: vi.fn(),
    start: mocks.oscillatorStarts,
    stop: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: makeAudioParam(),
    connect: vi.fn(),
  })),
};

vi.mock('@audio/index', () => ({
  audioEngine: { getContext: () => audioContextMock },
  audioPipeline: {
    triggerPluck: mocks.triggerPluck,
    dampString: mocks.dampString,
  },
}));

vi.mock('@store/tuningStore', () => ({
  getTuningFrequencies: () => [329.63, 246.94, 196, 146.83, 110, 82.41],
  useTuningStore: { getState: () => ({ setTuning: mocks.setTuning }) },
}));

import { TabScheduler } from '../../src/audio/tab/tabScheduler';

function note(stringIdx: number, fret = 0): TabNote {
  return {
    stringIdx,
    fret,
    durationBeats: 0.25,
    velocity: 0.8,
    articulation: 'none',
  };
}

function score(
  beats: Array<{ offsetBeats: number; notes: TabNote[] }>,
  timeSignature: [number, number] = [4, 4],
  measureCount = 1,
): TabScore {
  return {
    title: 'Test',
    tempoBpm: 120,
    timeSignature,
    tuningId: 'standard_e',
    measures: Array.from({ length: measureCount }, (_, index) => ({
      index,
      beats: index === 0 ? beats : [],
    })),
  };
}

function runSchedulerLoop(scheduler: TabScheduler): void {
  (scheduler as unknown as { schedulerLoop: () => void }).schedulerLoop();
}

describe('TabScheduler', () => {
  let rafCallback: FrameRequestCallback | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.currentTime = 0;
    mocks.clickFrequencies.length = 0;
    rafCallback = null;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('schedules only notes inside a loop region and wraps the playhead to its start', () => {
    const scheduler = new TabScheduler();
    scheduler.setScore(
      score([
        { offsetBeats: 0.5, notes: [note(0)] },
        { offsetBeats: 1, notes: [note(1)] },
        { offsetBeats: 1.5, notes: [note(2)] },
        { offsetBeats: 2, notes: [note(3)] },
        { offsetBeats: 2.5, notes: [note(4)] },
      ]),
    );
    scheduler.setLoopRegion(1, 2);
    const playedBeats: number[] = [];
    scheduler.subscribeBeat((beat) => playedBeats.push(beat));

    scheduler.start();
    runSchedulerLoop(scheduler);
    mocks.currentTime = 0.2;
    runSchedulerLoop(scheduler);

    expect(mocks.triggerPluck.mock.calls.map((call) => call[2])).toEqual([1, 2]);
    expect(scheduler.getLoopRegion()).toEqual({ startBeat: 1, endBeat: 2 });

    mocks.currentTime = 0.56;
    expect(rafCallback).not.toBeNull();
    rafCallback!(0);
    expect(playedBeats.at(-1)).toBeGreaterThanOrEqual(1);
    expect(playedBeats.at(-1)).toBeLessThan(1.1);
    scheduler.stop();
  });

  it('derives total playback length from the score time signature', () => {
    const scheduler = new TabScheduler();
    scheduler.setScore(score([], [6, 8], 2));
    expect(scheduler.getTotalBeats()).toBe(6);

    scheduler.setScore(score([], [4, 4], 2));
    expect(scheduler.getTotalBeats()).toBe(8);
  });

  it('skips muted and non-soloed strings before triggering a pluck', () => {
    const scheduler = new TabScheduler();
    scheduler.setScore(score([{ offsetBeats: 0, notes: [note(0), note(1), note(2)] }]));
    scheduler.setStringMuted(0, true);
    scheduler.setStringSoloed(1, true);

    scheduler.start();
    runSchedulerLoop(scheduler);

    expect(mocks.triggerPluck).toHaveBeenCalledTimes(1);
    expect(mocks.triggerPluck.mock.calls[0][2]).toBe(1);
    expect(mocks.dampString).toHaveBeenCalledWith(0, 0.5);
    expect(mocks.dampString).toHaveBeenCalledWith(2, 0.5);
    scheduler.stop();
  });

  it('schedules exactly one signature-aware measure of count-in clicks before notes', () => {
    const scheduler = new TabScheduler();
    scheduler.setScore(score([{ offsetBeats: 0, notes: [note(0)] }], [6, 8]));
    scheduler.setCountInEnabled(true);

    scheduler.start();
    expect(mocks.oscillatorStarts).toHaveBeenCalledTimes(3);
    expect(mocks.triggerPluck).not.toHaveBeenCalled();

    mocks.currentTime = 1.41;
    runSchedulerLoop(scheduler);
    expect(mocks.triggerPluck).toHaveBeenCalledTimes(1);
    expect(mocks.triggerPluck.mock.calls[0][4]).toBeCloseTo(1.55);
    scheduler.stop();
  });

  it('schedules metronome clicks on beats and accents the measure downbeat', () => {
    const scheduler = new TabScheduler();
    scheduler.setScore(score([]));
    scheduler.setMetronomeEnabled(true);

    scheduler.start();
    runSchedulerLoop(scheduler);
    expect(mocks.clickFrequencies).toEqual([1320]);

    mocks.currentTime = 0.45;
    runSchedulerLoop(scheduler);
    expect(mocks.clickFrequencies).toEqual([1320, 880]);
    scheduler.stop();
  });
});
