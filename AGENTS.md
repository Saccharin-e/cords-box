# AGENTS.md — Multi-Model & Agentic Workflow Guide

Welcome to **Cords Box** (`cords-box`). This document defines the engineering standards, subsystem boundaries, and cross-model collaboration protocol for AI agents and paired programmers operating across multiple models (e.g., Gemini Flash/Pro, Claude Opus/Sonnet, OpenAI o-series/Codex).

---

## 1. Project Overview & Mission

Cords Box is an advanced, web-based guitar crafting sandbox, wiring simulator, and physical modeling synthesizer.

### Core Stack & Architecture
- **Synthesizer Engine:** Digital Waveguide (DWG) physical string modeling written in **Rust** compiled to **WebAssembly** (`dsp/src/lib.rs` -> `src/audio/wasm-pkg/`).
- **Passive Circuit & Tone Stack Modeling:** Real-time Wave Digital Filters (WDF) running inside an off-thread **AudioWorklet** (`src/audio/processor.js`) paired with TypeScript reference solvers (`src/audio/wdf/`).
- **Circuit Netlist Engine:** Headless, pure TypeScript graph model (`src/graph/`) resolving active signal paths, pot tapers, and switch matrices.
- **Circuit Linter & Truth Tables:** Static rules engine (`src/lint/`) detecting shorts, open circuits, and generating truth tables.
- **State Management:** Zustand 5 stores (`src/store/`) coordinating circuit topology, canvas UI state, slots, and presets.
- **Frontend & Rendering:** React 19 + TypeScript + Konva.js (`react-konva`) for dual physical-layout and schematic rendering.

---

## 2. Multi-Model Collaboration Protocol

When working across multiple AI models, agents must coordinate cleanly, respect specialized strengths, and maintain architectural integrity.

### Model Roles & Task Routing

| Model Class | Recommended Task Types | Key Responsibilities |
| :--- | :--- | :--- |
| **High-Reasoning / Thinking Models** *(e.g., Claude Opus Thinking, OpenAI o-series, Gemini Pro/Thinking)* | • Complex DSP acoustic math & filter derivation<br>• WDF multi-port adaptor tree scattering<br>• Graph traversal algorithms (Oak Grigsby switches, push-pull phase detection)<br>• Store architectural consolidation & synchronization | • Validate physical equations against [DSP_SPEC.md](docs/DSP_SPEC.md)<br>• Ensure zero drift between JS worklet & TS solvers<br>• Document architectural decisions in `docs/` |
| **Fast Execution / Coding Models** *(e.g., Gemini Flash, Claude Sonnet, GPT-4o)* | • Implementing targeted bug fixes from audit reports<br>• Writing Vitest unit & integration tests<br>• UI components, canvas rendering, CSS/styling<br>• Lint rules, preset authoring, refactoring | • Run tests immediately before & after changes<br>• Keep type checking strictly passing (`npm run typecheck`)<br>• Preserve all existing docstrings and comments |

### Cross-Agent Continuity Rules

1. **Check Known Audits First:** Always check [docs/AUDIT_2026_08_30.md](docs/AUDIT_2026_08_30.md), [docs/DSP_SPEC.md](docs/DSP_SPEC.md), and [docs/charter.md](docs/charter.md) before diagnosing DSP or graph bugs.
2. **Never Break JS Worklet ↔ TS Solver Parity:**
   - `src/audio/processor.js` (Web Audio Worklet) and `src/audio/wdf/wdfNodes.ts` / `wdfCircuitSolver.ts` (TS reference) must compute bit-identical reflections, port resistances, and pot tapers.
   - If modifying one, always update both and verify with `tests/audio/wdfWorkletParity.test.ts`.
3. **No Uncalibrated "Magic Numbers":** Do not arbitrarily tweak gain scalars, pot taper exponents, or pickup filter delays without checking the physics in [DSP_SPEC.md](docs/DSP_SPEC.md).
4. **Preserve Documentation Integrity:** Maintain existing comments, type annotations, and mathematical explanations unless explicitly correcting a proven defect.

---

## 3. Subsystem Boundaries & Invariants

```
┌────────────────────────────────────────────────────────┐
│               UI & Canvas (src/ui/)                    │
│      React 19, Konva.js (Physical / Schematic)         │
└──────────────────────────┬─────────────────────────────┘
                           │ uses selectors / actions
┌──────────────────────────▼─────────────────────────────┐
│              Zustand Stores (src/store/)               │
│  circuitStore ◄──► canvasStore ◄──► slotStore / etc.   │
└──────────────────────────┬─────────────────────────────┘
                           │ syncs on change
┌──────────────────────────▼─────────────────────────────┐
│          Circuit Graph Engine (src/graph/)             │
│        Pure, Headless Netlist (Nodes & Edges)          │
│            + Circuit Linter (src/lint/)                │
└──────────────────────────┬─────────────────────────────┘
                           │ passes SolverResult & ActiveTopology
┌──────────────────────────▼─────────────────────────────┐
│              Audio Engine (src/audio/)                 │
│  • pipeline.ts: Web Audio routing, IRs, amp curves     │
│  • processor.js: AudioWorklet (WDF circuit + Tone)     │
│  • dsp/ (Rust/WASM): Digital Waveguide String Core     │
└────────────────────────────────────────────────────────┘
```

### Invariant Rules by Subsystem

1. **`src/graph/` (Circuit Graph):**
   - **Strictly Headless:** NEVER import from `src/ui/` or `src/audio/`.
   - Node and edge structures are validated with Zod (`src/graph/types.ts`).
   - `solveSignalPaths` must remain synchronous, fast (<1ms), and side-effect free.

2. **`src/audio/` (Audio Pipeline & DSP):**
   - Signal chain: `DWG String (WASM)` → `Pickup Comb Filter` → `WDF Passive Circuit` → `WDF Tone Stack` → `Tube Preamp Waveshapers` → `Cab IR Convolver` → `Master Limiter`.
   - Worklet communication: Uses structured `postMessage` (`'wdf-update'`, `'pluck'`, `'bend'`, `'damp'`).
   - Always gate synthesized audio playback on `wdfWorkletStatus === 'ready'`.

3. **`dsp/` (Rust Waveguide Engine):**
   - Lives in `dsp/src/lib.rs`.
   - Recompile to WASM after changes: `npm run build:wasm`.
   - Test WASM output stability with `tests/audio/wasmProduction.test.ts`.

4. **`src/store/` (Zustand State Stores):**
   - `circuitStore`: Owns the canonical `Graph` instance and `solverResult`.
   - `canvasStore`: Owns visual rendering instances, wire layouts, zoom/pan.
   - When updating components, ensure both graph values and UI instance attributes stay in sync.

---

## 4. Developer & Verification Commands

All agents must verify changes against the automated test suite before concluding work:

```bash
# 1. Run all unit & parity tests (Vitest)
npm test

# 2. Type-check TypeScript codebase
npm run typecheck

# 3. Fast linter check
npm run lint

# 4. Format check / fix
npm run format

# 5. Rebuild Rust WASM package (if dsp/ changes)
npm run build:wasm

# 6. Full production bundle build
npm run build
```

---

## 5. Git Commit & Handoff Conventions

When completing a task, summarize:
- **Files Modified/Added:** Clear list with markdown links.
- **Root Cause & Solution:** Physics/algorithmic rationale for why the change was made.
- **Verification Results:** Test suite counts (`X passed`), RMS/spectral checks, or UI behavior verified.
- **Follow-Up / Next Steps:** Any deferred architectural items from [AUDIT_2026_08_30.md](docs/AUDIT_2026_08_30.md) left for subsequent agent passes.
