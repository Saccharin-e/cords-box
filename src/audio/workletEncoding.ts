/**
 * wasm-bindgen decodes Rust error strings during module initialization/error
 * handling, but AudioWorkletGlobalScope does not provide TextDecoder in Chrome.
 * This UTF-8, non-streaming decoder supplies the subset used by the generated
 * bindings. It is never called from the audio sample loop.
 */
export class WorkletTextDecoder {
  readonly encoding = 'utf-8';
  readonly fatal: boolean;
  readonly ignoreBOM: boolean;

  constructor(label = 'utf-8', options: TextDecoderOptions = {}) {
    if (!['utf-8', 'utf8', 'unicode-1-1-utf-8'].includes(label.trim().toLowerCase())) {
      throw new RangeError(`Unsupported worklet encoding: ${label}`);
    }
    this.fatal = options.fatal ?? false;
    this.ignoreBOM = options.ignoreBOM ?? false;
  }

  decode(input?: AllowSharedBufferSource, options: TextDecodeOptions = {}): string {
    if (options.stream) throw new TypeError('Streaming decoding is not supported in the worklet');
    const bytes =
      input === undefined
        ? new Uint8Array()
        : ArrayBuffer.isView(input)
          ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
          : new Uint8Array(input);
    let result = '';
    const invalid = () => {
      if (this.fatal) throw new TypeError('The encoded data is not valid UTF-8');
      return '\uFFFD';
    };
    for (let i = 0; i < bytes.length;) {
      const lead = bytes[i++];
      if (lead < 0x80) {
        result += String.fromCharCode(lead);
        continue;
      }
      let remaining: number;
      let codePoint: number;
      if (lead >= 0xc2 && lead <= 0xdf) {
        remaining = 1;
        codePoint = lead & 0x1f;
      } else if (lead >= 0xe0 && lead <= 0xef) {
        remaining = 2;
        codePoint = lead & 0x0f;
      } else if (lead >= 0xf0 && lead <= 0xf4) {
        remaining = 3;
        codePoint = lead & 7;
      } else {
        result += invalid();
        continue;
      }
      let lower = lead === 0xe0 ? 0xa0 : lead === 0xf0 ? 0x90 : 0x80;
      let upper = lead === 0xed ? 0x9f : lead === 0xf4 ? 0x8f : 0xbf;
      while (remaining && i < bytes.length && bytes[i] >= lower && bytes[i] <= upper) {
        codePoint = (codePoint << 6) | (bytes[i++] & 0x3f);
        remaining--;
        lower = 0x80;
        upper = 0xbf;
      }
      result += remaining ? invalid() : String.fromCodePoint(codePoint);
    }
    return !this.ignoreBOM && result.charCodeAt(0) === 0xfeff ? result.slice(1) : result;
  }
}

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextDecoder', {
    value: WorkletTextDecoder,
    configurable: true,
    writable: true,
  });
}
