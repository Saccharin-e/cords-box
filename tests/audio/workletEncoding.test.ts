import { describe, expect, it } from 'vitest';
import { TextDecoder, TextEncoder } from 'node:util';
import { WorkletTextDecoder } from '../../src/audio/workletEncoding';

describe('worklet UTF-8 decoder for wasm-bindgen error strings', () => {
  it.each(['', 'Rust error: out of bounds', 'µF · Ω · 🎸', '\uFEFFhello', '𐀀\u0000終'])(
    'matches native decoding of %j',
    (text) => {
      const input = new TextEncoder().encode(text);
      for (const ignoreBOM of [true, false]) {
        const options = { fatal: true, ignoreBOM };
        expect(new WorkletTextDecoder('utf-8', options).decode(input)).toBe(
          new TextDecoder('utf-8', options).decode(input),
        );
      }
    },
  );
  it.each([
    [0xc0, 0xaf],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xe2, 0x82],
    [0xe2, 0x41],
    [0x80],
  ])('handles malformed UTF-8 %j consistently', (...values) => {
    const input = new Uint8Array(values);
    expect(() => new WorkletTextDecoder('utf-8', { fatal: true }).decode(input)).toThrow(TypeError);
    expect(new WorkletTextDecoder().decode(input)).toBe(new TextDecoder().decode(input));
  });
  it('honors view offsets and documents unsupported streaming', () => {
    const input = new Uint8Array([0, 65, 66, 0]);
    const decoder = new WorkletTextDecoder();
    expect(decoder.decode(new DataView(input.buffer, 1, 2))).toBe('AB');
    expect(decoder.decode()).toBe('');
    expect(() => decoder.decode(input, { stream: true })).toThrow(/Streaming/);
    expect(() => new WorkletTextDecoder('utf-16')).toThrow(RangeError);
  });
});
