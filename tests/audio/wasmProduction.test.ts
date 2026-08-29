/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { DspEngine, initSync } from '../../src/audio/wasm-pkg/dsp.js';

const RENDER_QUANTUM = 128;
const STRING_COUNT = 6;

const wasmBytes = readFileSync(resolve('src/audio/wasm-pkg/dsp_bg.wasm'));
const wasm = initSync({ module: new WebAssembly.Module(wasmBytes) });

function rms(samples: Float32Array): number {
  let energy = 0;
  for (let i = 0; i < samples.length; i++) energy += samples[i] * samples[i];
  return Math.sqrt(energy / samples.length);
}

function spectralEnergy(
  samples: Float32Array,
  sampleRate: number,
  frequency: number,
  startSeconds = 0.08,
  durationSeconds = 0.45,
): number {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(Math.floor(durationSeconds * sampleRate), samples.length - start);
  let real = 0;
  let imaginary = 0;
  for (let i = 0; i < length; i++) {
    const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / Math.max(1, length - 1));
    const phase = (2 * Math.PI * frequency * i) / sampleRate;
    const sample = samples[start + i] * window;
    real += sample * Math.cos(phase);
    imaginary -= sample * Math.sin(phase);
  }
  return (real * real + imaginary * imaginary) / (length * length);
}

function renderEngine(engine: DspEngine, sampleCount: number): Float32Array {
  const rendered = new Float32Array(sampleCount);
  let write = 0;
  while (write < sampleCount) {
    engine.process_chunk();
    const output = new Float32Array(wasm.memory.buffer, engine.output_ptr(), RENDER_QUANTUM);
    const count = Math.min(RENDER_QUANTUM, sampleCount - write);
    rendered.set(output.subarray(0, count), write);
    write += count;
  }
  return rendered;
}

function estimatePitch(samples: Float32Array, sampleRate: number, targetFrequency: number): number {
  const start = Math.round(sampleRate * 0.25);
  const length = Math.round(sampleRate * 0.25);
  const minimumLag = Math.floor(sampleRate / (targetFrequency * 1.08));
  const maximumLag = Math.ceil(sampleRate / (targetFrequency * 0.92));
  let bestLag = minimumLag;
  let bestCorrelation = -Infinity;

  for (let lag = minimumLag; lag <= maximumLag; lag++) {
    let cross = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = 0; index < length - lag; index++) {
      const left = samples[start + index];
      const right = samples[start + index + lag];
      cross += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const correlation = cross / Math.sqrt(leftEnergy * rightEnergy);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  return sampleRate / bestLag;
}

describe('checked-in production string WASM', () => {
  it('exports the complete current control and render surface', () => {
    const engine = new DspEngine(48_000, 1);
    expect(engine.set_whammy).toBeTypeOf('function');
    expect(engine.begin_chunk).toBeTypeOf('function');
    expect(engine.process_frames).toBeTypeOf('function');
    expect(engine.string_output_ptr).toBeTypeOf('function');
    expect(engine.pluck_articulated).toBeTypeOf('function');
    expect(engine.apply_harmonic_damping).toBeTypeOf('function');
    engine.free();
  });

  it('suppresses the fundamental after a 12th-fret harmonic node touch', () => {
    const sampleRate = 48_000;
    const fundamental = 82.4069;
    const plain = new DspEngine(sampleRate, 71);
    const harmonic = new DspEngine(sampleRate, 71);
    plain.pluck_articulated(0, fundamental, 0.7, 0.28, 0.42);
    harmonic.pluck_articulated(0, fundamental, 0.7, 0.28, 0.42);
    harmonic.apply_harmonic_damping(0, 0.5, 0.9);

    const plainOutput = renderEngine(plain, sampleRate);
    const harmonicOutput = renderEngine(harmonic, sampleRate);
    const plainRatio =
      spectralEnergy(plainOutput, sampleRate, fundamental) /
      spectralEnergy(plainOutput, sampleRate, fundamental * 2);
    const harmonicFundamental = spectralEnergy(harmonicOutput, sampleRate, fundamental);
    const harmonicOctave = spectralEnergy(harmonicOutput, sampleRate, fundamental * 2);

    expect(harmonicFundamental / harmonicOctave).toBeLessThan(plainRatio * 0.2);
    expect(harmonicFundamental).toBeLessThan(harmonicOctave);
    plain.free();
    harmonic.free();
  });

  it('publishes independent string-major buffers that sum to the legacy output', () => {
    const engine = new DspEngine(48_000, 2);
    engine.pluck(0, 82.4069, 0.8);
    engine.pluck(5, 659.255, 0.7);
    engine.process_chunk();

    const mixed = new Float32Array(wasm.memory.buffer, engine.output_ptr(), RENDER_QUANTUM);
    const strings = new Float32Array(
      wasm.memory.buffer,
      engine.string_output_ptr(),
      STRING_COUNT * RENDER_QUANTUM,
    );
    for (let frame = 0; frame < RENDER_QUANTUM; frame++) {
      let sum = 0;
      for (let string = 0; string < STRING_COUNT; string++) {
        sum += strings[string * RENDER_QUANTUM + frame];
      }
      expect(sum).toBeCloseTo(mixed[frame], 6);
    }
    engine.free();
  });

  it('holds representative low, middle, and high notes within 15 cents', () => {
    const sampleRate = 48_000;
    const cases: Array<[number, number]> = [
      [0, 82.4069],
      [2, 146.832],
      [5, 659.255],
    ];
    for (const [stringIndex, targetFrequency] of cases) {
      const engine = new DspEngine(sampleRate, 17 + stringIndex);
      engine.pluck(stringIndex, targetFrequency, 0.75);
      const rendered = renderEngine(engine, sampleRate);
      const measuredFrequency = estimatePitch(rendered, sampleRate, targetFrequency);
      const centsError = 1200 * Math.log2(measuredFrequency / targetFrequency);
      expect(
        Math.abs(centsError),
        `${targetFrequency} Hz measured as ${measuredFrequency} Hz`,
      ).toBeLessThan(15);
      engine.free();
    }
  });

  it('renders five seconds without non-finite samples, clipping, or RMS growth', () => {
    const sampleRate = 48_000;
    const engine = new DspEngine(sampleRate, 3);
    engine.pluck(5, 659.255, 1);
    const rendered = new Float32Array(sampleRate * 5);
    let write = 0;
    let peak = 0;

    while (write < rendered.length) {
      engine.process_chunk();
      const output = new Float32Array(wasm.memory.buffer, engine.output_ptr(), RENDER_QUANTUM);
      const count = Math.min(RENDER_QUANTUM, rendered.length - write);
      rendered.set(output.subarray(0, count), write);
      for (let i = 0; i < count; i++) {
        expect(Number.isFinite(output[i])).toBe(true);
        peak = Math.max(peak, Math.abs(output[i]));
      }
      write += count;
    }

    const early = rms(rendered.subarray(sampleRate, sampleRate * 2));
    const late = rms(rendered.subarray(sampleRate * 4, sampleRate * 5));
    expect(peak).toBeLessThan(1);
    expect(late).toBeLessThanOrEqual(early * 10 ** (1 / 20));
    engine.free();
  });
});
