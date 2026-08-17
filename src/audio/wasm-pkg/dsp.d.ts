/* tslint:disable */
/* eslint-disable */

export class DspEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Start a pitch glide on a string toward target_freq over duration_ms
     */
    bend(string_idx: number, target_freq: number, duration_ms: number): void;
    /**
     * Damp a ringing string early with a smooth exponential fade.
     * amount in 0.0..=1.0: 0.0 (gentle release) to 1.0 (hard dead-note mute).
     */
    damp(string_idx: number, amount: number): void;
    constructor(sample_rate: number, seed: number);
    output_ptr(): number;
    pluck(string_idx: number, freq: number, velocity: number): void;
    process_chunk(): void;
    /**
     * Set the pickup position for all strings at once
     */
    set_all_pickup_positions(position: number): void;
    set_drive(drive: number): void;
    /**
     * Set the pickup position for a string (0..1, fraction from bridge)
     */
    set_pickup_position(string_idx: number, position: number): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_dspengine_free: (a: number, b: number) => void;
    readonly dspengine_bend: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_damp: (a: number, b: number, c: number) => void;
    readonly dspengine_new: (a: number, b: number) => number;
    readonly dspengine_output_ptr: (a: number) => number;
    readonly dspengine_pluck: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_process_chunk: (a: number) => void;
    readonly dspengine_set_all_pickup_positions: (a: number, b: number) => void;
    readonly dspengine_set_drive: (a: number, b: number) => void;
    readonly dspengine_set_pickup_position: (a: number, b: number, c: number) => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
