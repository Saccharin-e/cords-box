let wasm;
let wasmMemory;

function decodeWasmString(ptr, length) {
    return new TextDecoder('utf-8').decode(
        new Uint8Array(wasmMemory.buffer, ptr, length),
    );
}

class GuitarProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.enginePtr = 0;
        this.outBuffer = null;

        this.port.onmessage = async (event) => {
            const msg = event.data;
            if (msg.type === 'init') {
                try {
                    const imports = {
                        './dsp_bg.js': {
                            __wbg_random_039a7d5d06e0d333: () => Math.random(),
                            __wbg___wbindgen_throw_344f42d3211c4765: (ptr, length) => {
                                throw new Error(decodeWasmString(ptr, length));
                            },
                            __wbindgen_init_externref_table: () => {
                                const table = wasm.__wbindgen_externrefs;
                                const offset = table.grow(4);
                                table.set(0, undefined);
                                table.set(offset + 0, undefined);
                                table.set(offset + 1, null);
                                table.set(offset + 2, true);
                                table.set(offset + 3, false);
                            },
                        },
                    };

                    const instantiated = await WebAssembly.instantiate(msg.wasmBytes, imports);
                    wasm = instantiated.instance.exports;
                    wasmMemory = wasm.memory;
                    wasm.__wbindgen_start();

                    this.enginePtr = wasm.dspengine_new(sampleRate);
                    const outputPtr = wasm.dspengine_output_ptr(this.enginePtr);
                    this.outBuffer = new Float32Array(wasmMemory.buffer, outputPtr, 128);
                    this.port.postMessage({ type: 'ready' });
                } catch (error) {
                    console.error('WASM Init error:', error);
                    this.port.postMessage({ type: 'error', error: String(error) });
                }
            } else if (msg.type === 'pluck' && this.enginePtr) {
                wasm.dspengine_pluck(this.enginePtr, msg.string_idx, msg.freq, msg.velocity);
            } else if (msg.type === 'drive' && this.enginePtr) {
                wasm.dspengine_set_drive(this.enginePtr, msg.drive);
            }
        };
    }

    process(_inputs, outputs, _parameters) {
        if (!this.enginePtr || !this.outBuffer) return true;

        wasm.dspengine_process_chunk(this.enginePtr);

        const output = outputs[0];
        if (output && output.length > 0) {
            const channelData = output[0];
            channelData.set(this.outBuffer);
            for (let channel = 1; channel < output.length; ++channel) {
                output[channel].set(channelData);
            }
        }

        return true;
    }
}

registerProcessor('guitar-processor', GuitarProcessor);
