import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SampleBank } from '@audio/sampleBank';

const MANIFEST = {
  zones: [
    { file: 'samples/52_v48_rr1.wav', rootPitch: 52, lowPitch: 48, highPitch: 52, lowVelocity: 0, highVelocity: 63 },
    { file: 'samples/52_v100_rr1.wav', rootPitch: 52, lowPitch: 48, highPitch: 52, lowVelocity: 64, highVelocity: 127 },
    { file: 'samples/56_v48_rr1.wav', rootPitch: 56, lowPitch: 55, highPitch: 56, lowVelocity: 0, highVelocity: 63 },
    { file: 'samples/56_v100_rr1.wav', rootPitch: 56, lowPitch: 55, highPitch: 56, lowVelocity: 64, highVelocity: 127 },
    { file: 'samples/98_v100_rr1.wav', rootPitch: 98, lowPitch: 97, highPitch: 102, lowVelocity: 64, highVelocity: 127 },
  ],
};

function mockContext() {
  return {
    decodeAudioData: (arrayBuffer: ArrayBuffer) =>
      Promise.resolve({ 
        length: arrayBuffer.byteLength, 
        sampleRate: 48000,
        getChannelData: () => new Float32Array(arrayBuffer.byteLength)
      }),
  } as unknown as AudioContext;
}

describe('SampleBank', () => {
  let bank: SampleBank;

  beforeEach(() => {
    bank = new SampleBank();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should be ready after loading a valid manifest and zones', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'samples/guitar/manifest.json') {
          return { ok: true, json: async () => MANIFEST };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(128) };
      }),
    );

    await bank.startLoad(mockContext());
    expect(bank.isReady()).toBe(true);
  });

  it('should share one in-flight load between concurrent callers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'samples/guitar/manifest.json') {
          return { ok: true, json: async () => MANIFEST };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(128) };
      }),
    );
    const fetchMock = vi.mocked(fetch);

    await Promise.all([bank.startLoad(mockContext()), bank.startLoad(mockContext())]);
    const manifestFetches = fetchMock.mock.calls.filter(
      (call) => call[0] === 'samples/guitar/manifest.json',
    );
    expect(manifestFetches).toHaveLength(1);
  });

  it('should not reload once ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'samples/guitar/manifest.json') {
          return { ok: true, json: async () => MANIFEST };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(128) };
      }),
    );

    await bank.startLoad(mockContext());
    await bank.startLoad(mockContext());
    expect(vi.mocked(fetch).mock.calls).toHaveLength(MANIFEST.zones.length + 1);
  });

  it('should stay not ready when the manifest fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));

    await bank.startLoad(mockContext());
    expect(bank.isReady()).toBe(false);
    expect(bank.findNote(60, 0.5)).toBeNull();
  });

  it('should pick the closest in-range zone for the target note', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'samples/guitar/manifest.json') {
          return { ok: true, json: async () => MANIFEST };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(128) };
      }),
    );

    await bank.startLoad(mockContext());
    expect(bank.isReady()).toBe(true);

    // Target 58 is closest to rootPitch 56 (soft layer only exists at 56).
    const found = bank.findNote(58, 0.5);
    expect(found).not.toBeNull();
    expect(found!.rootMidi).toBe(56);
  });

  it('should respect velocity layers when choosing a zone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'samples/guitar/manifest.json') {
          return { ok: true, json: async () => MANIFEST };
        }
        return { ok: true, arrayBuffer: async () => new ArrayBuffer(128) };
      }),
    );

    await bank.startLoad(mockContext());

    // Exact rootPitch match but wrong velocity layer: 52 hard does not
    // cover velocity 0.5, so the soft layer must be selected instead.
    const soft = bank.findNote(52, 0.5);
    expect(soft).not.toBeNull();
    expect(soft!.rootMidi).toBe(52);

    // Hard velocity at the same note also resolves (same root).
    expect(bank.findNote(52, 1.0)!.rootMidi).toBe(52);

    // No zone covers velocity 0.5 near note 90 (only the v100 layer exists
    // there) — falls back to the closest zone by pitch instead of silence.
    expect(bank.findNote(90, 0.5)!.rootMidi).toBe(98);
  });
});
