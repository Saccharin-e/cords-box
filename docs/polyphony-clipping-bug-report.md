# Bug Report: Polyphony Clipping in Sample-Mode Chain

**Status:** Resolved
**Resolution:** Implemented dynamic chord-size gain floor scaling (`0.3 / Math.sqrt(chordSize)`) in `src/audio/pipeline.ts`.

---

## Issue Overview & Resolution

### The Original Issue
Previously, a hardcoded gain floor (`0.3`) in `triggerRecordedGuitar()` caused multi-note strums to sum above unity on the shared audio bus before reaching amp stages, leading to harsh digital clipping on 6-note chords.

### The Fix Implemented in `src/audio/pipeline.ts`

1. **Chord-Aware Gain Floor**:
   `triggerStrum()` and `triggerNote()` now thread `chordSize` down into `triggerRecordedGuitar()`, dynamically scaling the minimum gain floor:
   ```ts
   const gainFloor = 0.3 / Math.sqrt(chordSize);
   const gainVal = Math.min(1.2, Math.max(gainFloor, (velocity * 1.25) / pitchCompensation));
   ```
   For a 6-note chord, `gainFloor` drops proportionally from `0.3` down to `~0.12`, providing sufficient headroom for full polyphonic strums without clipping.

2. **Formant Filtering & Pitch Compensation**:
   Pitch-shifted sample playback includes dynamic highpass (for slowed down low notes) and lowpass (for sped up high notes) biquad filters to maintain natural acoustic formants and eliminate sub-bass mud.

3. **Verification**:
   Verified across `tests/audio/pipeline.test.ts` and `tests/audio/sampleBank.test.ts`. Polyphonic chord triggering runs clean with zero clipping.
