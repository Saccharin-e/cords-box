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

describe('checked-in production string WASM', () => {
  it('exports the complete current control and render surface', () => {
    const engine = new DspEngine(48_000, 1);
    expect(engine.set_whammy).toBeTypeOf('function');
    expect(engine.begin_chunk).toBeTypeOf('function');
    expect(engine.process_frames).toBeTypeOf('function');
    expect(engine.string_output_ptr).toBeTypeOf('function');
    expect(engine.pluck_articulated).toBeTypeOf('function');
    engine.free();
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
