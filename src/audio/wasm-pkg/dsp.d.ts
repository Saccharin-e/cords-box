/* tslint:disable */
/* eslint-disable */

export class DspEngine {
    free(): void;
    [Symbol.dispose](): void;
    active_voice_count(): number;
    /**
     * Reset the append cursor for one Web Audio render quantum.
     */
    begin_chunk(): void;
    bend(string_idx: number, target_frequency: number, duration_ms: number): void;
    damp(string_idx: number, amount: number): void;
    constructor(sample_rate: number, seed: number);
    output_ptr(): number;
    pluck(string_idx: number, frequency: number, velocity: number): void;
    /**
     * Pluck with explicit articulation without changing the legacy API.
     */
    pluck_articulated(string_idx: number, frequency: number, velocity: number, pick_position: number, pick_hardness: number): void;
    process_chunk(): void;
    /**
     * Append up to `frame_count` frames. The worklet may alternate this with
     * control events to execute them at exact frame offsets.
     */
    process_frames(frame_count: number): void;
    /**
     * Deprecated compatibility no-op. Pickup sensing is owned by the worklet.
     */
    set_all_pickup_positions(_position: number): void;
    /**
     * Retained for compatibility. Drive is applied in the amplifier path.
     */
    set_drive(drive: number): void;
    set_pick_hardness(string_idx: number, hardness: number): void;
    set_pick_position(string_idx: number, position: number): void;
    /**
     * Deprecated compatibility no-op. Pickup sensing is owned by the worklet.
     */
    set_pickup_position(_string_idx: number, _position: number): void;
    set_whammy(semitones: number): void;
    string_energy(string_idx: number): number;
    /**
     * Pointer to 6x128 f32 values at `[string_idx * 128 + frame]`.
     */
    string_output_ptr(): number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_dspengine_free: (a: number, b: number) => void;
    readonly dspengine_active_voice_count: (a: number) => number;
    readonly dspengine_begin_chunk: (a: number) => void;
    readonly dspengine_bend: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_damp: (a: number, b: number, c: number) => void;
    readonly dspengine_new: (a: number, b: number) => number;
    readonly dspengine_output_ptr: (a: number) => number;
    readonly dspengine_pluck: (a: number, b: number, c: number, d: number) => void;
    readonly dspengine_pluck_articulated: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly dspengine_process_chunk: (a: number) => void;
    readonly dspengine_process_frames: (a: number, b: number) => void;
    readonly dspengine_set_all_pickup_positions: (a: number, b: number) => void;
    readonly dspengine_set_drive: (a: number, b: number) => void;
    readonly dspengine_set_pick_hardness: (a: number, b: number, c: number) => void;
    readonly dspengine_set_pick_position: (a: number, b: number, c: number) => void;
    readonly dspengine_set_pickup_position: (a: number, b: number, c: number) => void;
    readonly dspengine_set_whammy: (a: number, b: number) => void;
    readonly dspengine_string_energy: (a: number, b: number) => number;
    readonly dspengine_string_output_ptr: (a: number) => number;
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
