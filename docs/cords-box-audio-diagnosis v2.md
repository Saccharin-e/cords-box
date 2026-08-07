# cords-box audio pipeline: diagnosis report (v4 — Final Resolution)

Findings across four inspections of [`Saccharin-e/cords-box`](https://github.com/Saccharin-e/cords-box) (`develop` branch): from initial state (`17aa4fb`) to commits `8c3fdcb`, `ced002a`, `be0c7af`, and `01d881a`.

## Final Status Summary

| Issue | Status | Fix Commit / Verification |
| --- | --- | --- |
| WDF solver never processes audio | **Fixed** | `ced002a` & `be0c7af` |
| Recorded samples double-filtered | **Fixed** | `8c3fdcb` |
| Cabinet IR built from pure sine tones | **Fixed** | `8c3fdcb` |
| Room IR built from pure sine tones | **Fixed** | `ced002a` |
| Three cascaded `DynamicsCompressorNode`s | **Fixed** | `pipeline.ts` |
| Tube waveshaper curves | **Fixed** | `ced002a` & `pipeline.ts` |
| Worklet readiness race condition | **Fixed** | `be0c7af` |
| Synthesized + sample path routing | **Fixed** | `be0c7af` |
| Worklet circuit component parameter sync | **Fixed** | `01d881a` |

## Resolution Summary

1. **Worklet Readiness Race**: Resolved in `be0c7af` by adding dynamic state subscribers to `AudioEngine`. When `isWorkletReady()` flips to `true`, `wdfWorkletNode` is automatically instantiated and spliced into active routing without needing a manual session reset.
2. **Unified Routing**: Resolved in `be0c7af` by connecting both `rawStringMix` (synthesized Karplus-Strong string engine) and `sampleInputNode` (DI sample bank) into `wdfWorkletNode`, ensuring consistent WDF circuit filtering across all sound sources.
3. **Graph Component Parameter Sync**: Resolved in `01d881a` by extracting solved netlist values (pickup R/L, tone C, cable C, pot taper positions) from `solverResult` and transmitting them live to `src/audio/processor.js` via `'wdf-update'` postMessage events.
