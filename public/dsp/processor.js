import init, { DspEngine } from './dsp.js';

let wasmMemory;

class GuitarProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.engine = null;
        this.outPtr = null;
        this.outBuffer = null;
        
        this.port.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === 'init') {
                init(msg.wasmBytes).then((wasm) => {
                    wasmMemory = wasm.memory;
                    this.engine = new DspEngine(sampleRate);
                    // Get pointer to the internal 128-sample buffer
                    this.outPtr = this.engine.output_ptr();
                    this.outBuffer = new Float32Array(wasmMemory.buffer, this.outPtr, 128);
                    this.port.postMessage({ type: 'ready' });
                }).catch(err => {
                    console.error("WASM Init error:", err);
                });
            } else if (msg.type === 'pluck' && this.engine) {
                this.engine.pluck(msg.string_idx, msg.freq, msg.velocity);
            } else if (msg.type === 'drive' && this.engine) {
                this.engine.set_drive(msg.drive);
            }
        };
    }

    process(inputs, outputs, parameters) {
        if (!this.engine || !this.outBuffer) {
            // Output silence until initialized
            return true;
        }
        
        // Tell Rust to compute exactly 128 samples
        this.engine.process_chunk();
        
        const output = outputs[0];
        if (output && output.length > 0) {
            const channelData = output[0];
            // Copy directly from WASM memory to WebAudio buffer (fast, zero allocation)
            channelData.set(this.outBuffer);
            
            // Copy mono output to right channel if stereo
            for (let channel = 1; channel < output.length; ++channel) {
                output[channel].set(channelData);
            }
        }
        
        return true;
    }
}

registerProcessor('guitar-processor', GuitarProcessor);
