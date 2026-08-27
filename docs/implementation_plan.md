# WDF Synth Engine Implementation Plan

Implement comprehensive correctness fixes, physical modeling enhancements, and performance optimizations across the Wave Digital Filter (WDF) passive guitar circuit and tone stack simulation layer.

## Implementation Status

Implemented in August 2026. The production path now includes the regenerated
Rust/WASM string engine, per-string pickup sensing, exact series/phase pickup
networks, a shared coupled tone-stack solver at the physical post-preamp
insertion point, sample-accurate worklet events, smoothed live controls,
worklet fallback/readiness handling, and bounded final output gain.

## User Review Required

> [!IMPORTANT]
> **Scattering Matrix Correction in Parallel Adaptor**:
> Fixing the `WdfParallelAdaptor` scattering formula (removing the redundant parent-port conductance term) changes the numerical scaling of parallel junctions. Existing tests (`toneStackWdf.test.ts`, `wdfWorkletParity.test.ts`) will be calibrated to the physically exact scattering values.

> [!WARNING]
> **Audio Taper Perception**:
> Switching volume and tone potentiometers from linear ($R = R_{\text{max}} \cdot p$) to logarithmic audio taper ($R = R_{\text{max}} \cdot p^2$) significantly alters knob feel between 0.0 and 1.0, making volume roll-off behave realistically like standard audio-grade (A250K/A500K) guitar pots.

---

## Resolved Decisions

> [!NOTE]
>
> 1. **Pickup Self-Resonance**: Pickup winding capacitance is part of each WDF pickup branch. The redundant global pickup peaking filter is removed from the worklet path.
> 2. **Tone Stack Makeup Gain**: Fixed per-model recovery is used (Fender: 2.15×, Marshall: 1.65×, Mesa: 1.70×, Vox: 2.10×). Runtime unity calibration was rejected because it erased authentic insertion loss and consumed startup work.

---

## Proposed Changes

```
src/audio/wdf/
├── wdfNodes.ts            # Core WDF primitives (caching, taper, fixed parallel scattering)
├── wdfCircuitSolver.ts    # Graph-to-WDF compiler (treble bleed, pot tapers)
├── toneStackCore.js       # Shared allocation-free coupled tone-stack runtime
└── wdfToneStack.ts        # Typed tone-stack entry point

src/audio/
├── pipeline.ts            # Physical amp ordering, graph inference, readiness, gain staging
├── processor.js           # Guitar and post-preamp tone-stack AudioWorklets
└── wasm-pkg/              # Checked-in bindings generated from dsp/src/lib.rs

dsp/src/lib.rs             # Stable per-string waveguide and frame-segment API

tests/audio/
├── wdfNodes.test.ts        # Unit tests for pot tapers and adaptor caching
├── wdfCircuitSolver.test.ts# Treble bleed and pot curve verification
├── toneStackWdf.test.ts    # Independent analogue AC-reference tests
├── wasmProduction.test.ts  # Tests the checked-in production binary
└── wdfWorkletParity.test.ts# Runtime parity and exact event scheduling
```

---

### Core WDF Primitives Layer

#### [MODIFY] [wdfNodes.ts](file:///home/saccharin/code/cords-box/src/audio/wdf/wdfNodes.ts)

- **Potentiometer Tapers**: Add `PotTaper` enum (`'linear' | 'audio' | 'reverse_audio'`) to `WdfPotentiometer` with $p^2$ and $1-(1-p)^2$ transfer curves.
- **Wave Reflection Caching (1.1)**: Cache `_b1` and `_b2` during `waveReflect(a)` in `WdfSeriesAdaptor` and `WdfParallelAdaptor`, reusing them directly in `step(a)` to eliminate redundant tree traversals.
- **Scattering Formula Fix (1.2)**: Correct `WdfParallelAdaptor.waveReflect()` and `step()` to standard WDF parallel junction scattering without double-counting parent port conductance ($G_{\text{sum}} = G_1 + G_2$).
- **Dirty-Flag Port Resistance (3.1)**: Cache port resistances and update reflection coefficients $\gamma_1, \gamma_2$ only when child port resistances change.

---

### Circuit Solver & Graph Compilation Layer

#### [MODIFY] [wdfCircuitSolver.ts](file:///home/saccharin/code/cords-box/src/audio/wdf/wdfCircuitSolver.ts)

- **Treble Bleed Network (2.2)**: Wire treble bleed capacitors across the volume potentiometer lugs in parallel with the volume pot branch (rather than dumping into cable capacitance).
- **Pot Taper Configuration**: Configure volume pots with `'audio'` taper and tone pots with `'linear'` or `'audio'` taper based on component type.
- **Pickup Winding Capacitance (2.3)**: Include distributed coil capacitance ($C_{\text{coil}} \approx 120\text{ pF}$) in parallel with the pickup inductor to model natural self-resonance in the solver.

---

### Passive Tone Stack Engine

#### [MODIFY] [wdfToneStack.ts](file:///home/saccharin/code/cords-box/src/audio/wdf/wdfToneStack.ts)

- **Per-Model Makeup Gain (1.3)**: Implement calibrated makeup gains for `fender`, `marshall`, `mesa`, and `vox` to normalize insertion loss at neutral control positions (0.5/0.5/0.5 at 1 kHz).
- **Shared Coupled Solve**: Use one five-node trapezoidal nodal solver in TypeScript tests and the AudioWorklet so bridged FMV/Vox networks are not approximated as reducible WDF trees.
- **Fixed Recovery**: Preserve model-specific insertion loss with bounded static makeup gain; do not run an audio probe in `build()`.
- **Control Laws**: Use the schematic pot connections and tapers, including the distinct three-terminal Vox bass network and fixed mid shunt.

---

### AudioWorklet Real-Time Execution Layer

#### [MODIFY] [processor.js](file:///home/saccharin/code/cords-box/src/audio/processor.js)

- **Inlined WDF Parity**: Update inlined `WdfPotentiometer`, `WdfSeriesAdaptor`, and `WdfParallelAdaptor` implementations to match `wdfNodes.ts` (caching, dirty gammas, corrected parallel scattering).
- **In-Tree Phase Cancellation (2.4)**: Move pickup phase inversion into `WdfVoltageSourceResistor.setVoltage(-v)` so out-of-phase interference is solved natively within the passive network.
- **Pickup Coil Capacitance**: Add $C_{\text{winding}}$ to `WdfCircuit._buildTree()` pickup branches.
- **Tone Stack Parity**: Import the shared `toneStackCore.js` implementation directly so tests and the worklet cannot drift.
- **Physical Ordering**: Register the tone stack as its own processor and place it after the preamp and before the power stage.
- **Exact Events**: Render the WASM engine in frame segments around scheduled pluck, bend, and damp events.

---

### Test Harness & Verification

#### [MODIFY] [wdfNodes.test.ts](file:///home/saccharin/code/cords-box/tests/audio/wdfNodes.test.ts)

- Add unit tests for `WdfPotentiometer` tapers (`linear`, `audio`, `reverse_audio`).
- Add tests verifying adaptor wave caching consistency and dirty-flag gamma updates.

#### [MODIFY] [wdfCircuitSolver.test.ts](file:///home/saccharin/code/cords-box/tests/audio/wdfCircuitSolver.test.ts)

- Add verification for treble bleed circuit retention of high frequencies when volume pot is rolled down.

#### [MODIFY] [toneStackWdf.test.ts](file:///home/saccharin/code/cords-box/tests/audio/toneStackWdf.test.ts)

- Verify that all four tone stack models (`fender`, `marshall`, `mesa`, `vox`) achieve insertion loss compensation within $\pm1.5\text{ dB}$ of unity at neutral.
- Verify coupled interaction where mid boost suppresses bass/treble.

#### [MODIFY] [wdfWorkletParity.test.ts](file:///home/saccharin/code/cords-box/tests/audio/wdfWorkletParity.test.ts)

- Verify bit-for-bit parity between `src/audio/wdf/` TypeScript classes and `src/audio/processor.js` AudioWorklet inlined implementation.

---

## Verification Plan

### Automated Tests

Execute the full Vitest suite and TypeScript type check:

```bash
# Run all unit and DSP integration tests
npm run test

# Run WDF-specific test suites with full verbosity
npx vitest run tests/audio/wdfNodes.test.ts tests/audio/wdfCircuitSolver.test.ts tests/audio/toneStackWdf.test.ts tests/audio/wdfWorkletParity.test.ts tests/audio/wdfResonance.test.ts

# TypeScript verification
npm run typecheck
```

### Manual Verification

1. **Interactive Canvas Fretboard & Controls**: Launch `npm run dev` and adjust Volume / Tone knobs on the canvas inspector to verify smooth, musical response curves without sudden volume jumps.
2. **Tone Stack Model Switching**: Switch between Fender, Marshall, Mesa, and Vox amp models and verify audible tonal character and balanced overall level.
3. **Phase & Treble Bleed Inspection**: Wire dual pickups out-of-phase and test volume roll-off with and without treble bleed capacitor components.
