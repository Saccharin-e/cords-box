# Cords Box Implementation Roadmap

Updated: 2026-09-09. M0 implementation has started; see [current issue register](IMPLEMENTATION_STATUS.md) and [verification evidence](VERIFICATION.md). Source baseline: `15cd1e6` and preceding implementation commits.

The next product milestone is **Verified Circuit Comparison**: build two guitar circuits, play the same performance through each, understand the difference, and reliably save and restore the result. Complete the guitar performance and modeling workflows next, then expand instruments and platform features.

This document replaces the previous roadmap's status claims and version targets. It is an implementation plan, not a claim that the acceptance checks below have passed. The [charter](charter.md) defines the mission, the [DSP specification](DSP_SPEC.md) defines physical constraints, and the [August audit](AUDIT_2026_08_30.md) supplies findings to reproduce. Historical audit proposals must be checked against current source and measurements before implementation.

## 1. Scope and completion rules

**Core completion** means M0–M6 are accepted: reliable circuit/audio behavior, coherent editing and persistence, comparison, MIDI/tab performance, useful diagnostics, and the planned guitar DSP refinements. **Instrument expansion** is M7. **Platform expansion** is M8. All remain on the roadmap; platform expansion is not a prerequisite for a complete guitar workbench.

Status vocabulary:

- **Present:** implementation exists; end-to-end acceptance is still required.
- **Partial:** useful pieces exist, but behavior or integration is incomplete.
- **Planned:** new implementation work.
- **Accepted:** implementation, applicable automated checks, browser/audio evidence, and documentation are complete. Record the commit and evidence before using this status.

Every unchecked task remains open. An API or passing mock test alone does not complete a user workflow. Each task should become a bounded PR with its ID, owned paths, dependencies, acceptance evidence, and limitations. Keep unrelated tab, store, graph, and DSP work in separate changes.

## 2. Current implementation baseline

| Area                     | Source evidence                                                                                                                              | Remaining work                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Circuit editing          | Physical/schematic canvases, library, inspector, linter, truth tables, presets, and slots are present.                                       | Verify editing sequences, topology, restore behavior, and accessible interaction.                  |
| String synthesis         | Articulated plucks, harmonics, per-string buffers, voice telemetry, and first-order Lagrange/Farrow interpolation exist in `dsp/src/lib.rs`. | Preserve these capabilities; add shared-bridge coupling with signal checks in M6.                  |
| Passive audio            | WDF circuit/tone-stack implementations and JS/TS parity tests are present.                                                                   | Reproduce outstanding graph-to-audio findings; extend full-chain measurements.                     |
| Tab playback             | Parser, scheduler, panel, sections, time signatures, loops, mute/solo, metronome, and count-in are present.                                  | Verify timing and complete browser playback workflows.                                             |
| Alternate guitar tunings | `tuningStore.ts` includes Standard E, Drop D, Eb Standard, Open G, DADGAD, and D Standard; tab/fretboard consumers exist.                    | Unify MIDI/playback behavior; add custom tuning and remaining presets.                             |
| Live MIDI/whammy         | MIDI note-on triggers synthesis; note-off currently notifies listeners. Engine/worklet whammy support exists without a UI/MIDI producer.     | Implement note ownership/release, tuning-aware assignment, pitch wheel, and direct whammy control. |
| Portability              | `circuitSerializer.ts` implements project files, legacy import, and URL hash serialization; app startup reads shared hashes.                 | Complete validation, state coverage, atomic restore, and user-facing sharing.                      |
| Bass                     | `bassPresets.ts` contains a Jazz Bass component/node scaffold without wiring edges.                                                          | Complete circuits, instrument configuration, playback, UI, and registered presets.                 |
| Advanced circuits        | Treble-bleed/blend types and some pipeline handling exist.                                                                                   | Verify wiring-dependent behavior; complete junctions and independent concentric controls.          |
| Platform                 | OMR, optional cloud sync, BOM purchasing, and 3D remain ambitions.                                                                           | Deliver independent releases after the core contracts are stable.                                  |

Commit `b44a91e` includes changes for taper consistency, ground propagation, transitive-short linting, pickup-position conversion, solver-result updates, initialization gating, and series gain handling. Re-test those changes rather than reapplying the August audit's patches. Remaining claims, including gain levels, series detection, and phase tracing, need current reproductions.

Documentation drift identified and corrected in M0: the charter had claimed sympathetic coupling was delivered; the audit contained conflicting coupling/fallback statements and stale issue status. Current dispositions now live in the issue register. The previous roadmap listed implemented tunings, tab UI, and serialization as future work.

### Validation snapshot from this roadmap review

These checks describe the pre-M0 source baseline, not acceptance of future milestones. The startup/build fixes and latest results are recorded in [VERIFICATION.md](VERIFICATION.md).

| Check                    | Result on 2026-09-09                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`               | 25 test files, 146 tests passed.                                                                                                                                                    |
| `npm run typecheck`      | Passed.                                                                                                                                                                             |
| `npm run lint`           | Passed with eight existing Fast Refresh warnings.                                                                                                                                   |
| `npm run format:check`   | Failed: existing formatting differences in 47 source/generated files.                                                                                                               |
| `npm run build`          | Rust compilation completed; WASM packaging failed while installing `wasm-bindgen` because its cache/temp location was read-only. Frontend bundling was not reached by this command. |
| Browser/audio acceptance | Not run during this documentation review; remains open.                                                                                                                             |

## 3. Milestone order and dependencies

| Milestone | Outcome                                     | Depends on                            | Completion gate                                                      |
| --------- | ------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| M0        | Evidence-backed baseline and issue register | None                                  | Reproducible checks; every audit finding classified.                 |
| M1        | Verified circuit-to-audio behavior          | M0                                    | Supported preset matrix passes topology and signal checks.           |
| M2        | Coherent editing and portable state         | M0; integrate against M1              | History/import sequences restore consistent state and sound.         |
| M3        | Verified Circuit Comparison release         | M1 + M2                               | Repeatable A/B playback, optional level matching, saved comparisons. |
| M4        | Complete guitar performance workflow        | M1 + M2                               | MIDI, tuning, whammy, and tab acceptance passes.                     |
| M5        | Explainable, accessible wiring              | M1 + M2                               | Users can identify, understand, and correct circuit issues.          |
| M6        | Complete planned guitar DSP refinements     | M1; M4 for expression integration     | Physical, parity, stability, and runtime checks pass.                |
| M7        | Bass and isolated-string workflows          | M2 + M4 + M6                          | Bass projects and isolated output work end to end.                   |
| M8        | Platform expansion                          | M2 + M5; M7 where instrument-specific | Each independent feature passes its own gate.                        |

M1 and M2 can progress independently after M0. M4 and M5 can follow M3 independently. M6 may start after M1, but must not delay unresolved core correctness defects. These are scheduling options, not authorization to expand an implementation task's file boundaries.

Set calendar estimates after M0 establishes reproducible defects and M6 prototypes establish model complexity. Acceptance evidence, rather than assumed sprint dates, controls completion.

## 4. M0 — Establish the baseline

Primary paths: `docs/`, `tests/`, `package.json`, and a new CI workflow location.

- [x] **M0.1 — Reconcile the issue register.** Map every numbered audit finding to current code, reproduction, severity, owner area, and status: reproduced, fixed with evidence, needs investigation, or superseded with rationale. Correct conflicting docs while preserving useful historical analysis.
- [x] **M0.2 — Make validation reproducible.** Resolve environment/toolchain setup and establish clean-checkout tests, type checking, lint, formatting, and production build. Record commit, versions, sample rates, test counts, and pre-existing failures separately. Resolve formatting in a dedicated maintenance change.
- [x] **M0.3 — Automate release checks.** Add CI for unit/parity tests, type checking, lint, formatting, WASM packaging, and production build. Add a browser harness loading the actual worklet/WASM; publish logs and audio metrics as artifacts.
- [ ] **M0.4 — Define reference scenarios.** Version representative presets, switch states, performance events, and deterministic excitation fixtures. Specify supported browser/device targets and physical reference responses with provenance and tolerances.

Implementation evidence: local checks pass, CI is configured, and both development/production browser audio scenarios pass. Hosted CI has not yet run. M0.4 has executable audio fixtures and four preset matrices; independent physical references and broader device coverage remain open.

Acceptance: another developer reproduces the baseline from a clean checkout. No issue is called fixed solely because a patch or test file exists. Environment failures remain distinct from code failures.

## 5. M1 — Verify circuit-to-audio correctness

Primary paths: `src/graph/`, `src/lint/`, `src/audio/pipeline.ts`, `src/audio/processor.js`, `src/audio/wdf/`, and corresponding tests. Apply the relevant graph/audio skills when implementing these tasks.

- [ ] **M1.1 — Verify supported preset switch states.** Cover HSS/SSS, standard Tele, four-way series/parallel, Les Paul, and phase reversal. Compare active pickups, polarity, grounding, and topology against independently specified truth tables. Include disconnected and incorrectly wired variants.
- [ ] **M1.2 — Verify graph-to-audio mapping.** Check pickup position, capacitance, pot taper, connected tone controls, and phase propagation against actual connectivity. Replace reproduced label/ID-dependent inference defects with graph-derived behavior. Migrate physical pickup-position data without changing old projects' intended locations.
- [ ] **M1.3 — Measure full-chain gain.** Capture RMS, peaks, frequency response, and clipping at string, pickup, passive circuit, tone stack, amp, cabinet, and output stages. Cover notes, chords, and control extremes. Derive corrections from the model/reference fixtures; preserve meaningful series output differences.
- [ ] **M1.4 — Complete readiness/recovery.** Exercise unavailable, initializing, ready, and failed states. Gate synthesized playback on confirmed readiness; expose loading/failure/retry. Characterize remaining JS fallback reachability and define explicit compatibility support. Preserve supported sample-bank audition behavior.
- [ ] **M1.5 — Verify articulation transitions.** Render muted-note-to-hammer/pull, bends, releases, rests, retriggers, and harmonics using the actual worklet. Distinguish legato transitions from bending a deliberately muted note; fix reproduced state leakage without blanket articulation resets.
- [ ] **M1.6 — Close linter gaps.** Verify transitive shorts, floating tone connections, stale signal-state handling, and multiway-switch jumper rules. Include legal series links so grounding rules do not reject valid circuits.

Acceptance: the preset matrix passes graph, linter, JS/TS parity, and rendered-audio checks. Browser playback survives initialization, rapid switches, and repeated notes without stale topology, stuck voices, or unexplained gain changes. Establish numerical tolerances before accepting fixes; historical audit RMS values are not the reference by default.

## 6. M2 — Make editing and persistence coherent

Primary paths: `src/store/`, `src/graph/circuitSerializer.ts`, `src/graph/cordsboxSchema.ts`, canvas/inspector consumers, and store/serializer tests.

- [ ] **M2.1 — Establish state ownership.** Keep electrical values canonical in the graph and visual attributes keyed by component ID in canvas state. Coordinate component/value/switch/wiring actions; remove independently mutable electrical copies or make them explicitly derived.
- [ ] **M2.2 — Coordinate history restoration.** Replace asynchronous graph restore during undo/redo. Restore graph and visuals before solving/publishing audio updates; prevent older restores overtaking newer ones. Define which audio/tuning changes belong to history.
- [ ] **M2.3 — Separate serialization from orchestration.** Keep data validation/serialization headless. Move store access, audio updates, downloads, and URL access into an application service; remove the current graph-layer import of the audio pipeline.
- [ ] **M2.4 — Complete the project schema.** Enumerate persisted instrument family, graph/switch state, transforms/wire styling, tuning, audio settings, project identity, tab score, and comparison data. Verify existing switch-state representation before adding fields. Add explicit version migrations and runtime validation.
- [ ] **M2.5 — Make restore atomic.** Parse, validate, migrate, and construct the candidate before mutating stores. Preserve the current project on failure. Keep identity/creation time stable across saves, and define checksum mismatch handling without treating the checksum as an authenticity guarantee.
- [ ] **M2.6 — Unify slots and portable saves.** Reuse the validated snapshot contract for slots, files, and shared links. Handle corrupt local storage, unsupported versions, and oversized links with clear recovery/file fallback.

Acceptance: rotate → edit pot → undo → redo preserves appearance and electrical values. Save/reload and share/open restore topology, tuning, audio, and saved performance state. Invalid imports leave the current project intact. Headless graph tests do not initialize audio/UI modules.

## 7. M3 — Ship Verified Circuit Comparison

Primary paths: an audition/comparison service, `src/ui/toolbar/GuitarSoundTestPanel.tsx`, `src/ui/tab/TabPanel.tsx`, snapshot stores, and audio integration tests.

- [ ] **M3.1 — Capture immutable A/B snapshots.** Use M2's contract for graph, controls, and audio settings. Name candidates and show component/wiring/control differences. Later edits must not mutate captured candidates.
- [ ] **M3.2 — Replay the same performance.** Share a tab/event sequence, tempo, tuning, velocity, and reproducible excitation or recorded DI. Provide circuit-only comparison with shared amp/FX settings and full-rig comparison including them. Retain varied excitation for ordinary playing.
- [ ] **M3.3 — Switch consistently.** Specify loop-boundary switching or a brief transition, handle tails/queued events, and prevent discontinuities or mixed old/new topology. Measure CPU cost before choosing dual live pipelines.
- [ ] **M3.4 — Add optional loudness matching.** Keep raw-level mode available. Measure compensation over the same passage and display it. Define silence/near-cancellation behavior so matching cannot amplify a near-silent candidate excessively.
- [ ] **M3.5 — Save and explain comparisons.** Show frequency-response/RMS differences with units, persist candidates and performance, and export a report with settings and measurement conditions.

Acceptance: load preset → capture A → change one component/connection → capture B → compare the same looping riff. Raw mode preserves electrical level differences; matching meets a documented tolerance. Reload restores the comparison. Tests verify repeatable input and snapshot isolation; browser evidence verifies switching/playback.

## 8. M4 — Complete guitar performance and tab integration

Primary paths: `src/audio/midi/`, `src/audio/tab/`, `src/store/tuningStore.ts`, pipeline controls, tab/fretboard UI, and integration tests.

- [ ] **M4.1 — Implement MIDI voice ownership.** Track port/channel/note-to-string assignments; release the correct voice on note-off. Handle repeated notes, occupied strings, disconnect, all-notes-off, and device changes.
- [ ] **M4.2 — Unify tuning/string assignment.** Replace fixed MIDI standard-tuning tables with the shared contract. Reconcile score-specific and selected tuning. Add Open D/Open E and validated custom tunings without recreating existing presets. Verify displayed fret assignments and audible MIDI pitch.
- [ ] **M4.3 — Expose whammy.** Add a typed pipeline method using the existing engine/worklet API, a draggable spring-return control with keyboard access, and MIDI pitch-wheel handling. Define range, channel policy, smoothing, and release/disconnect reset.
- [ ] **M4.4 — Preserve supported MIDI expression.** Define import/export conventions for timing, tempo, supported meters, bends, and articulations. Document guitar-specific metadata and ordinary MIDI round-trip limits. Handle multiple tracks/channels explicitly.
- [ ] **M4.5 — Verify the existing tab workflow.** Cover drag/Shift-click loops, sections, tempo/meter changes, count-in, metronome accents, mute/solo, seek, stop/restart, and highlighting. Keep timing consumers on `getBeatsPerMeasure()` and metronome audio independent of guitar synthesis.
- [ ] **M4.6 — Define browser transport behavior.** Specify pause/resume under audio-context suspension and hidden tabs, cancel stale scheduled events, and display playback state. Measure timing in rendered output, not only scheduler mocks.

Acceptance: note-off/retrigger releases the right note, tuning yields valid fret assignments, and whammy returns to pitch without stuck bends. Supported MIDI round trips preserve their documented timing/expression contract. Browser loops/count-in work in 4/4, 3/4, and 6/8.

Ties, triplets, repeat syntax, and capo remain a separately scoped notation extension. Define syntax and acceptance fixtures before implementation; do not introduce them opportunistically into timing/MIDI repairs.

## 9. M5 — Explain wiring and finish editing UX

Primary paths: `src/lint/`, `src/ui/inspector/WiringDiagnosticsPanel.tsx`, canvas layers, tutorials, export UI, and UI/browser tests.

- [ ] **M5.1 — Explain findings.** Attach affected nodes/edges, consequence, and a concrete correction. Highlight the full path in both views. Use “No wiring issues detected” for clean lint results; reserve verified claims for checks actually performed.
- [ ] **M5.2 — Explain valid behavior.** Show active pickups, topology, polarity, and connected tone/volume controls. Explain changes such as tone bypass and phase cancellation using solver results.
- [ ] **M5.3 — Complete guided workflows.** Guide preset loading, wiring/editing, resolving a deliberate fault, auditioning, comparing, and saving. Reuse editor solver/diagnostic behavior.
- [ ] **M5.4 — Complete accessible direct interaction.** Verify pointer/touch wiring, visible focus, keyboard alternatives, control names, zoom/pan, and small-screen panels. Keep direct manipulation for loops/whammy; numeric entry must not be the only option.
- [ ] **M5.5 — Verify exports.** Check PNG/PDF bounds, scale, labels, wire colors, and clipping. Include truth tables/component values in a reproducible report and surface export failures.

Acceptance: users locate a fault, understand it, repair it, and hear the result. Keyboard and pointer flows work. Exported diagrams match the saved circuit and remain legible at documented sizes.

## 10. M6 — Complete planned guitar DSP refinements

Primary paths: `dsp/src/lib.rs`, `src/audio/processor.js`, `src/audio/wdf/`, pipeline/topology contracts, component schemas, and signal/parity tests. Implement each model separately; document equations, units, calibration, and limits in the DSP specification.

- [ ] **M6.1 — Add sympathetic coupling.** Prototype bounded, physically motivated shared-bridge coupling using existing per-string outputs. Define damping/energy behavior first. Verify unplucked-string response, decay, zero-coupling equivalence, and stability under chords/pitch modulation.
- [ ] **M6.2 — Add optional nonlinear pickup response.** Calibrate a magnetic-response approximation after the linear passive solve, consistent with the planned DSP contract. Keep tube/pedal nonlinearities distinct. Verify weak-signal linearity, harmonic growth, aliasing control, bypass equivalence, and bounds.
- [ ] **M6.3 — Complete advanced passive networks.** Define supported multi-branch topologies and add R-type/scattering adaptors where required. Complete wiring-dependent treble-bleed resistor/cap variants, blend pots, and independent concentric controls. Compare with independent circuit responses and preserve JS/TS parity.
- [ ] **M6.4 — Guard real-time invariants.** Check finite positive port resistances and adaptor consistency at construction/update time. Keep allocations/logging outside sample processing. Benchmark supported sample rates/worst-case presets with documented headroom below each render deadline.
- [ ] **M6.5 — Resolve fallback support.** Following M1's reachability decision, implement the explicitly supported compatibility behavior or retire unreachable code with documentation. Do not silently add lower-fidelity synthesis during initialization or remove supported fallback behavior without a defined replacement.
- [ ] **M6.6 — Preserve existing physical behavior.** Re-run pitch, harmonic suppression, scheduled-duration vibrato, string summation, and matched-level sag checks. Add swept interpolation-response tests if interpolation changes; this roadmap does not require replacing the existing interpolator.

Acceptance: each model has independent reference evidence, bypass/control bounds, signal regressions, and production-WASM/browser validation. Worst-case six-string playback stays finite and inside the measured render budget. Gain/damping constants require documented rationale.

## 11. M7 — Complete bass and isolated-string support

Primary paths: shared instrument configuration, `src/presets/bassPresets.ts`, graph/component schemas, tuning/tab/MIDI/fretboard consumers, DSP/routing, and serialization.

- [ ] **M7.1 — Introduce instrument configuration.** Define string count/order, scale length, tuning, and physical parameters centrally. Audit fixed six-string/guitar assumptions throughout UI, scheduling, MIDI, and DSP. Migrate existing guitar projects safely.
- [ ] **M7.2 — Finish bass circuits.** Wire the Jazz Bass scaffold completely; add P-Bass and Music Man-style passive pickup/preset models. Register library/templates and verify controls against truth tables/rendered response.
- [ ] **M7.3 — Deliver bass playback.** Add four-/five-string tunings, fretboard/tab layouts, low-frequency calibration, and 1x15/4x10 cabinet profiles. Measure B0/E1 pitch/decay/filter behavior; avoid applying inappropriate guitar sample processing.
- [ ] **M7.4 — Model active bass electronics.** Define power, headroom, gain, and controls in a separate active stage. Add bypass, clipped-input checks, and serialization rather than modeling an active preamp as a passive shortcut.
- [ ] **M7.5 — Expose isolated string output.** Reuse `string_output_ptr` for optional six-channel guitar routing. Define channel order, tap point, processing, mono/stereo compatibility, and supported devices. Measure isolation and verify mixed output remains correct.

Acceptance: bass presets are wired, playable, editable, portable, and accurate at low notes. Active electronics have documented behavior. Isolated output has verified identity/isolation and clear handling of unsupported destinations.

## 12. M8 — Deliver platform expansion independently

These remain planned deliverables after the core. Select libraries, hosting, models, and commercial integrations using current documentation when each implementation starts.

| ID                         | Deliverables                                                                                                                                                                                                                                                                          | Acceptance gate                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| M8.1 — Sharing/offline     | Finish link creation/import UX, preview, size limits/file fallback, offline assets/app, and local recovery. Reuse M2 migrations and existing serialization.                                                                                                                           | Shared projects restore consistently; cached offline launch/play/save works; updates preserve local projects.                       |
| M8.2 — BOM                 | Derive quantities, values, variants, and wiring notes from the graph; add printable/exportable BOM, then optional vendor mappings and identified affiliate links.                                                                                                                     | BOM matches the project; unsupported parts are explicit; ordering is a deliberate user action using available vendor data.          |
| M8.3 — Optional cloud sync | Define ownership, API, conflict resolution, retries, migrations, export, and deletion; local use stays independent of sign-in.                                                                                                                                                        | Two clients sync without silent overwrites; offline edits reconcile; users can export/delete data.                                  |
| M8.4 — OMR                 | Specify supported printed-tab layouts and a licensed evaluation corpus; prototype recognition, then cropping/correction, decoding, confidence review, and editable conversion into existing tab schema. Evaluate browser inference/offline model caching before selecting technology. | Publish accuracy/latency by layout; users correct uncertain notes before playback; unsupported acceleration has a defined fallback. |
| M8.5 — 3D cavity view      | Define dimensions/coordinates; derive the view from shared circuit/layout state; add placement/collision feedback and routing suggestions. Keep geometric suggestions separate from electrical connectivity until accepted.                                                           | 2D/3D edits round-trip, dimensions are meaningful, and visual routing never silently changes the circuit.                           |

Each row requires its own implementation tickets, fixtures, environment limits, and release evidence. OMR/3D begin with bounded feasibility prototypes; prototypes alone do not complete those features.

## 13. Release verification and handoff

Run repository-required checks for implementation PRs and record actual results:

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`npm run build` currently includes `build:wasm`. After Rust changes, confirm the rebuilt package and production-WASM tests match source. Use scoped formatting fixes during development; the repository-wide `npm run format` writes source and must not turn a narrow task into unrelated formatting changes.

| Change               | Additional acceptance evidence                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Graph/linter/presets | Independent expected connectivity, legal/illegal variants, relevant rendered response.          |
| WDF                  | `wdfWorkletParity.test.ts`, independent transfer references, control-extreme stability.         |
| Rust/string DSP      | Rebuilt WASM, `wasmProduction.test.ts`, spectral/pitch/decay metrics, actual worklet execution. |
| Scheduling/MIDI      | Ownership/timing tests and browser-rendered timing, release, and loops.                         |
| Stores/persistence   | Edit/history/import sequences, version round trips, failed-load preservation.                   |
| UI/comparison/export | Pointer/keyboard flows, export inspection, playback where applicable.                           |
| Performance          | Browser/device/sample-rate metadata, worst-case load, measured deadline headroom.               |

For each milestone attach: commit, delivered IDs, commands/results, metrics/tolerances, browser scenarios, limitations, and deferred tasks. Missing evidence stays open; historical counts and API assertions cannot substitute for current verification.

## 14. First implementation batch

1. Complete M0.1–M0.4: current issue register, reproducible baseline, CI, reference scenarios.
2. Build M1.1/M1.2 fixtures; fix reproduced defects and complete M1.3–M1.6.
3. Complete M2.1–M2.6, starting with coordinated history and the validated snapshot contract.
4. Complete M3.1–M3.5 and accept **Verified Circuit Comparison**.
5. Complete M4/M5, then accept M6's separately tested models to finish the core guitar workbench.
6. Execute M7 and independent M8 releases under the same completion rules.
