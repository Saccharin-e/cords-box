/* @ts-self-types="./dsp.d.ts" */

export class DspEngine {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DspEngineFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_dspengine_free(ptr, 0);
    }
    /**
     * Start a pitch glide on a string toward target_freq over duration_ms
     * @param {number} string_idx
     * @param {number} target_freq
     * @param {number} duration_ms
     */
    bend(string_idx, target_freq, duration_ms) {
        wasm.dspengine_bend(this.__wbg_ptr, string_idx, target_freq, duration_ms);
    }
    /**
     * Damp a ringing string early with a smooth exponential fade.
     * amount in 0.0..=1.0: 0.0 (gentle release) to 1.0 (hard dead-note mute).
     * @param {number} string_idx
     * @param {number} amount
     */
    damp(string_idx, amount) {
        wasm.dspengine_damp(this.__wbg_ptr, string_idx, amount);
    }
    /**
     * @param {number} sample_rate
     * @param {number} seed
     */
    constructor(sample_rate, seed) {
        const ret = wasm.dspengine_new(sample_rate, seed);
        this.__wbg_ptr = ret;
        DspEngineFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    output_ptr() {
        const ret = wasm.dspengine_output_ptr(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} string_idx
     * @param {number} freq
     * @param {number} velocity
     */
    pluck(string_idx, freq, velocity) {
        wasm.dspengine_pluck(this.__wbg_ptr, string_idx, freq, velocity);
    }
    process_chunk() {
        wasm.dspengine_process_chunk(this.__wbg_ptr);
    }
    /**
     * Set the pickup position for all strings at once
     * @param {number} position
     */
    set_all_pickup_positions(position) {
        wasm.dspengine_set_all_pickup_positions(this.__wbg_ptr, position);
    }
    /**
     * @param {number} drive
     */
    set_drive(drive) {
        wasm.dspengine_set_drive(this.__wbg_ptr, drive);
    }
    /**
     * Set the pickup position for a string (0..1, fraction from bridge)
     * @param {number} string_idx
     * @param {number} position
     */
    set_pickup_position(string_idx, position) {
        wasm.dspengine_set_pickup_position(this.__wbg_ptr, string_idx, position);
    }
}
if (Symbol.dispose) DspEngine.prototype[Symbol.dispose] = DspEngine.prototype.free;
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_344f42d3211c4765: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./dsp_bg.js": import0,
    };
}

const DspEngineFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_dspengine_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('dsp_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
