/**
 * Executes the actual inlined AudioWorklet WDF classes and compares them with
 * the TypeScript reference implementation sample-for-sample.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  WdfCapacitor,
  WdfParallelAdaptor,
  WdfPotentiometer,
  WdfResistor,
  WdfSeriesAdaptor,
} from '../../src/audio/wdf/wdfNodes';
import { WdfGuitarCircuitSolver } from '../../src/audio/wdf/wdfCircuitSolver';
import { WdfToneStackSolver } from '../../src/audio/wdf/wdfToneStack';

const SAMPLE_RATE = 48000;
let worklet: typeof import('../../src/audio/processor.js');

beforeAll(async () => {
  class AudioWorkletProcessorStub {
    port = {
      onmessage: null as ((event: MessageEvent) => void) | null,
      postMessage: vi.fn(),
    };
  }

  vi.stubGlobal('AudioWorkletProcessor', AudioWorkletProcessorStub);
  vi.stubGlobal('registerProcessor', vi.fn());
  vi.stubGlobal('sampleRate', SAMPLE_RATE);
  vi.stubGlobal('currentTime', 0);
  worklet = await import('../../src/audio/processor.js');
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('WDF Worklet Parity', () => {
  it('registers separate guitar and post-preamp tone-stack processors', () => {
    const register = vi.mocked(
      (globalThis as typeof globalThis & { registerProcessor: ReturnType<typeof vi.fn> })
        .registerProcessor,
    );
    expect(register).toHaveBeenCalledWith('guitar-processor', expect.any(Function));
    expect(register).toHaveBeenCalledWith('tone-stack-processor', expect.any(Function));
  });

  it('reports the synchronous tone-stack processor as ready', () => {
    const processor = new worklet.ToneStackProcessor();
    expect(processor.port.postMessage).toHaveBeenCalledWith({ type: 'ready' });
  });

  it('keeps primitive scattering, tapers, caching, and dirty updates bit-identical', () => {
    const tsPot = new WdfPotentiometer(500000, 0.65, 'audio');
    const jsPot = new worklet.WdfPotentiometer(500000, 0.65, 'audio');
    const tsCap = new WdfCapacitor(47e-9, SAMPLE_RATE);
    const jsCap = new worklet.WdfCapacitor(47e-9, SAMPLE_RATE);
    const tsBranch = new WdfSeriesAdaptor(tsPot, tsCap);
    const jsBranch = new worklet.WdfSeriesAdaptor(jsPot, jsCap);
    const tsRoot = new WdfParallelAdaptor(tsBranch, new WdfResistor(330000));
    const jsRoot = new worklet.WdfParallelAdaptor(jsBranch, new worklet.WdfResistor(330000));

    for (let i = 0; i < 256; i++) {
      if (i === 73) {
        tsPot.setPosition(0.2);
        jsPot.setPosition(0.2);
      }
      if (i === 141) {
        tsPot.setTaper('reverse_audio');
        jsPot.setTaper('reverse_audio');
      }
      const incident = Math.sin(i * 0.137) * 0.7;
      expect(jsRoot.waveReflect(incident)).toBe(tsRoot.waveReflect(incident));
      expect(jsRoot.portResistance).toBe(tsRoot.portResistance);
      jsRoot.step(incident);
      tsRoot.step(incident);
    }
  });

  it('matches the production guitar circuit including source, winding cap, divider, and bleed', () => {
    const reference = new WdfGuitarCircuitSolver(SAMPLE_RATE);
    reference.buildCircuit({
      pickupInductanceH: 2.4,
      pickupResistanceOhms: 6500,
      pickupWindingCapFarads: 120e-12,
      volumePotMaxOhms: 250000,
      volumePotPos: 0.37,
      volumePotTaper: 'audio',
      tonePotMaxOhms: 250000,
      tonePotPos: 0.61,
      tonePotTaper: 'linear',
      toneCapFarads: 47e-9,
      trebleBleedCapFarads: 1e-9,
      cableCapacitanceFarads: 500e-12,
      ampInputImpedanceOhms: 1_000_000,
    });

    const runtime = new worklet.WdfCircuit(SAMPLE_RATE);
    runtime.updateParams({
      pickups: [
        {
          inductanceH: 2.4,
          resistanceR: 6500,
          windingCapFarads: 120e-12,
          isOutofPhase: false,
        },
      ],
      isSeries: false,
      volPotMaxR: 250000,
      volumePos: 0.37,
      volumePotTaper: 'audio',
      tonePotMaxR: 250000,
      tonePos: 0.61,
      tonePotTaper: 'linear',
      toneCapFarads: 47e-9,
      trebleBleedCapFarads: 1e-9,
      cableCapFarads: 500e-12,
      ampInputImpedanceOhms: 1_000_000,
    });

    for (let i = 0; i < 512; i++) {
      const input = (i === 0 ? 0.8 : 0) + Math.sin(i * 0.19) * 0.2;
      expect(runtime.processSample(input)).toBe(reference.processSample(input));
    }
  });

  it('matches the production tone stack for every model and control update', () => {
    for (const model of ['fender', 'marshall', 'mesa', 'vox'] as const) {
      const reference = new WdfToneStackSolver(SAMPLE_RATE);
      const runtime = new worklet.WdfToneStack(SAMPLE_RATE);
      reference.build(model);
      runtime.build(model);
      reference.setControls(0.72, 0.31, 0.84);
      runtime.setControls(0.72, 0.31, 0.84);

      for (let i = 0; i < 256; i++) {
        const input = Math.sin(i * 0.23) * 0.4;
        expect(runtime.processSample(input)).toBe(reference.processSample(input));
      }
    }
  });

  it('applies pickup phase once inside the circuit source', () => {
    const inPhase = new worklet.WdfCircuit(SAMPLE_RATE);
    const outOfPhase = new worklet.WdfCircuit(SAMPLE_RATE);
    const basePickup = {
      inductanceH: 2.4,
      resistanceR: 6500,
      windingCapFarads: 120e-12,
    };
    inPhase.updateParams({ pickups: [{ ...basePickup, isOutofPhase: false }] });
    outOfPhase.updateParams({ pickups: [{ ...basePickup, isOutofPhase: true }] });

    for (let i = 0; i < 256; i++) {
      const input = Math.sin(i * 0.11) * 0.5;
      const phaseSum = outOfPhase.processSample(input) + inPhase.processSample(input);
      expect(Math.abs(phaseSum)).toBeLessThan(1e-12);
    }
  });

  it('smooths live guitar control changes without delaying the initial snapshot', () => {
    const runtime = new worklet.WdfCircuit(SAMPLE_RATE) as InstanceType<
      typeof worklet.WdfCircuit
    > & {
      _currentVolumePos: number;
      _targetVolumePos: number;
    };
    runtime.updateParams({ volumePos: 0.8, tonePos: 0.7 });
    expect(runtime._currentVolumePos).toBe(0.8);

    runtime.updateParams({ volumePos: 0.1 });
    expect(runtime._currentVolumePos).toBe(0.8);
    expect(runtime._targetVolumePos).toBe(0.1);
    runtime.processSample(0.2);
    expect(runtime._currentVolumePos).toBeLessThan(0.8);
    expect(runtime._currentVolumePos).toBeGreaterThan(0.1);

    for (let i = 0; i < SAMPLE_RATE * 0.12; i++) runtime.processSample(0);
    expect(runtime._currentVolumePos).toBeCloseTo(0.1, 3);
  });

  it('cancels identical parallel pickups when one is out of phase', () => {
    const runtime = new worklet.WdfCircuit(SAMPLE_RATE);
    const basePickup = {
      inductanceH: 2.4,
      resistanceR: 6500,
      windingCapFarads: 120e-12,
    };
    runtime.updateParams({
      pickups: [
        { ...basePickup, isOutofPhase: false },
        { ...basePickup, isOutofPhase: true },
      ],
      isSeries: false,
    });

    const inputs = new Float64Array(2);
    for (let i = 0; i < 256; i++) {
      inputs[0] = Math.sin(i * 0.17) * 0.4;
      inputs[1] = inputs[0];
      expect(Math.abs(runtime.processSample(inputs))).toBeLessThan(1e-12);
    }
  });

  it('sums series pickups without changing global polarity', () => {
    const single = new worklet.WdfCircuit(SAMPLE_RATE);
    const series = new worklet.WdfCircuit(SAMPLE_RATE);
    const pickup = {
      inductanceH: 2.4,
      resistanceR: 6500,
      windingCapFarads: 120e-12,
      isOutofPhase: false,
    };
    single.updateParams({ pickups: [pickup], isSeries: false });
    series.updateParams({ pickups: [pickup, pickup], isSeries: true });

    let singleOutput = 0;
    let seriesOutput = 0;
    const seriesInputs = new Float64Array([0.25, 0.25]);
    for (let i = 0; i < 1024; i++) {
      singleOutput = single.processSample(0.25);
      seriesOutput = series.processSample(seriesInputs);
    }

    expect(Math.sign(seriesOutput)).toBe(Math.sign(singleOutput));
    expect(Math.abs(seriesOutput)).toBeGreaterThan(Math.abs(singleOutput));
  });

  it('preserves relative phase inside an exact series pickup network', () => {
    const runtime = new worklet.WdfCircuit(SAMPLE_RATE);
    const pickup = {
      inductanceH: 2.4,
      resistanceR: 6500,
      windingCapFarads: 120e-12,
    };
    runtime.updateParams({
      pickups: [
        { ...pickup, isOutofPhase: false },
        { ...pickup, isOutofPhase: true },
      ],
      isSeries: true,
    });

    const inputs = new Float64Array(2);
    for (let i = 0; i < 512; i++) {
      inputs[0] = Math.sin(i * 0.13) * 0.4;
      inputs[1] = inputs[0];
      expect(Math.abs(runtime.processSample(inputs))).toBeLessThan(1e-12);
    }
  });

  it('renders around scheduled events at their exact frame offsets', () => {
    type ScheduledProcessor = {
      engine: {
        begin_chunk(): void;
        process_frames(frameCount: number): void;
        process_chunk(): void;
        pluck(stringIndex: number, frequency: number, velocity: number): void;
      };
      outBuffer: Float32Array;
      stringOutBuffer: Float32Array | null;
      port: { onmessage: ((event: MessageEvent) => void) | null };
      process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    };
    const Processor = (worklet as unknown as { GuitarProcessor: new () => ScheduledProcessor })
      .GuitarProcessor;
    const processor = new Processor();
    const calls: string[] = [];
    processor.engine = {
      begin_chunk() {
        calls.push('begin');
      },
      process_frames(frameCount) {
        calls.push(`frames:${frameCount}`);
      },
      process_chunk() {
        calls.push('legacy-chunk');
      },
      pluck() {
        calls.push('pluck');
      },
    };
    processor.outBuffer = new Float32Array(128);
    processor.stringOutBuffer = null;
    processor.port.onmessage?.({
      data: {
        type: 'pluck',
        string_idx: 2,
        freq: 146.83,
        velocity: 0.7,
        time: 110 / SAMPLE_RATE,
      },
    } as MessageEvent);

    processor.process([[]], [[new Float32Array(128)]]);

    expect(calls).toEqual(['begin', 'frames:110', 'pluck', 'frames:18']);
  });

  it('uses the enriched pluck without creating a divergent message path', () => {
    const Processor = (
      worklet as unknown as {
        GuitarProcessor: new () => {
          engine: {
            pluck: ReturnType<typeof vi.fn>;
            pluck_articulated: ReturnType<typeof vi.fn>;
            apply_harmonic_damping: ReturnType<typeof vi.fn>;
          } | null;
          port: { onmessage: ((event: MessageEvent) => void) | null };
        };
      }
    ).GuitarProcessor;
    const processor = new Processor();
    processor.engine = {
      pluck: vi.fn(),
      pluck_articulated: vi.fn(),
      apply_harmonic_damping: vi.fn(),
    };
    processor.port.onmessage?.({
      data: {
        type: 'pluck',
        string_idx: 0,
        freq: 82.4069,
        velocity: 0.7,
        articulation: 'harmonic',
        pick_position: 0.28,
        pick_hardness: 0.42,
        harmonic_node_ratio: 0.5,
        harmonic_strength: 0.9,
      },
    } as MessageEvent);

    expect(processor.engine.pluck).not.toHaveBeenCalled();
    expect(processor.engine.pluck_articulated).toHaveBeenCalledWith(
      0,
      82.4069,
      0.7,
      0.28,
      0.42,
    );
    expect(processor.engine.apply_harmonic_damping).toHaveBeenCalledWith(0, 0.5, 0.9);
  });

  it('makes palm-muted live strings darker and faster-decaying at matched input level', () => {
    type FilterProcessor = {
      engine: { process_chunk(): void; pluck_articulated(...args: number[]): void } | null;
      outBuffer: Float32Array | null;
      stringOutBuffer: Float32Array | null;
      wdf: {
        _params: { pickups: unknown[] };
        _pickupInputVoltages: Float64Array;
        _pickupCombDelaySamples: Float64Array;
        processSample(input: ArrayLike<number>): number;
      };
      port: { onmessage: ((event: MessageEvent) => void) | null };
      process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    };
    const Processor = (worklet as unknown as { GuitarProcessor: new () => FilterProcessor })
      .GuitarProcessor;

    const render = (articulation: 'none' | 'palm_mute') => {
      const processor = new Processor();
      processor.engine = { process_chunk() {}, pluck_articulated() {} };
      processor.outBuffer = new Float32Array(128);
      processor.stringOutBuffer = new Float32Array(6 * 128);
      for (let i = 0; i < 128; i++) {
        processor.stringOutBuffer[i] =
          Math.sin((2 * Math.PI * 300 * i) / SAMPLE_RATE) +
          0.5 * Math.sin((2 * Math.PI * 6000 * i) / SAMPLE_RATE);
      }
      processor.wdf = {
        _params: { pickups: [] },
        _pickupInputVoltages: new Float64Array(1),
        _pickupCombDelaySamples: new Float64Array(6),
        processSample(input) {
          return input[0];
        },
      };
      processor.port.onmessage?.({
        data: {
          type: 'pluck',
          string_idx: 0,
          freq: 220,
          velocity: 0.7,
          articulation,
          pick_position: articulation === 'palm_mute' ? 0.1 : 0.35,
          pick_hardness: articulation === 'palm_mute' ? 0.88 : 0.65,
        },
      } as MessageEvent);
      const first = new Float32Array(128);
      processor.process([[]], [[first]]);
      let last = first;
      for (let block = 0; block < 39; block++) {
        last = new Float32Array(128);
        processor.process([[]], [[last]]);
      }
      return { first, last };
    };

    const blockRms = (samples: Float32Array) =>
      Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
    const brightness = (samples: Float32Array) => {
      let differenceEnergy = 0;
      for (let i = 1; i < samples.length; i++) {
        const difference = samples[i] - samples[i - 1];
        differenceEnergy += difference * difference;
      }
      return Math.sqrt(differenceEnergy / (samples.length - 1)) / blockRms(samples);
    };

    const normal = render('none');
    const muted = render('palm_mute');
    expect(brightness(muted.first)).toBeLessThan(brightness(normal.first) * 0.8);
    expect(blockRms(muted.last)).toBeLessThan(blockRms(muted.first) * 0.45);
    expect(blockRms(normal.last)).toBeCloseTo(blockRms(normal.first), 5);
  });

  it('publishes a smoothed six-string load for the power-sag follower', () => {
    type LoadProcessor = {
      engine: {
        process_chunk(): void;
        active_voice_count(): number;
        string_energy(stringIndex: number): number;
      } | null;
      outBuffer: Float32Array | null;
      stringOutBuffer: Float32Array | null;
      port: { postMessage: ReturnType<typeof vi.fn> };
      process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    };
    const Processor = (worklet as unknown as { GuitarProcessor: new () => LoadProcessor })
      .GuitarProcessor;
    const processor = new Processor();
    processor.engine = {
      process_chunk() {},
      active_voice_count: () => 6,
      string_energy: () => 0.01,
    };
    processor.outBuffer = new Float32Array(128);
    processor.stringOutBuffer = null;
    for (let block = 0; block < 8; block++) {
      processor.process([[]], [[new Float32Array(128)]]);
    }
    expect(processor.port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'voice-load',
        activeVoiceCount: 6,
        stringEnergy: expect.closeTo(0.06, 6),
      }),
    );
  });

  it('uses per-string synthetic output while leaving recorded DI spatially unfiltered', () => {
    const Processor = (
      worklet as unknown as {
        GuitarProcessor: new () => {
          engine: { process_chunk(): void } | null;
          outBuffer: Float32Array | null;
          stringOutBuffer: Float32Array | null;
          wdf: {
            _params: { pickups: Array<{ delayMs: number; blendGain: number }> };
            _pickupInputVoltages: Float64Array;
            _pickupCombDelaySamples: Float64Array;
            processSample(input: ArrayLike<number>): number;
          };
          process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
        };
      }
    ).GuitarProcessor;

    const processor = new Processor();
    const captured = new Float64Array(128);
    let sampleIndex = 0;
    processor.wdf = {
      _params: { pickups: [{ delayMs: 1, blendGain: 1 }] },
      _pickupInputVoltages: new Float64Array(1),
      _pickupCombDelaySamples: new Float64Array(6),
      processSample(input) {
        captured[sampleIndex] = input[0];
        sampleIndex++;
        return input[0];
      },
    } as typeof processor.wdf;

    processor.engine = { process_chunk() {} };
    processor.outBuffer = new Float32Array(128).fill(100);
    processor.stringOutBuffer = new Float32Array(6 * 128);
    processor.stringOutBuffer[0] = 0.2;
    processor.stringOutBuffer[128] = 0.1;

    const syntheticOutput = new Float32Array(128);
    processor.process([[]], [[syntheticOutput]]);
    expect(syntheticOutput[0]).toBeCloseTo(0.45, 6);
    expect(syntheticOutput[0]).toBeLessThan(1);
    // Legacy delays encoded d=2p/f, so 1 ms at the 250 Hz reference maps to
    // p=0.125. The corrected sensing delay p/f is 24 samples at 48 kHz.
    expect(processor.wdf._pickupCombDelaySamples[0]).toBeCloseTo(24, 7);

    processor.engine = null;
    processor.outBuffer = null;
    processor.stringOutBuffer = null;
    const diInput = new Float32Array(128).fill(0.25);
    const diOutput = new Float32Array(128);
    processor.process([[diInput]], [[diOutput]]);
    expect(diOutput[0]).toBeCloseTo(0.25, 7);
  });
});
