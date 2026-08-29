/**
 * tabTypes.ts — Schema Definitions for Guitar Tablature
 */

export type ArticulationType =
  | 'none'
  | 'hammer'
  | 'pull'
  | 'slide_up'
  | 'slide_down'
  | 'bend'
  | 'release'
  | 'vibrato'
  | 'tap'
  | 'harmonic'
  | 'pinch_harmonic'
  | 'palm_mute'
  | 'mute'
  | 'ghost';

export interface TabNote {
  /** String index: 0 = High E, 5 = Low E */
  stringIdx: number;
  /** Fret number (0-24) */
  fret: number;
  /** Note duration in beat units (e.g. 0.25 = 16th note, 0.5 = 8th note, 1.0 = quarter note) */
  durationBeats: number;
  /** Normalized velocity (0.0 to 1.0) */
  velocity: number;
  /** Playing technique / articulation */
  articulation: ArticulationType;
  /** Target fret for slides or pitch bends */
  targetFret?: number;
}

export interface TabBeat {
  /** Offset from the beginning of the measure in beats */
  offsetBeats: number;
  /** Notes struck simultaneously at this beat */
  notes: TabNote[];
}

export interface TabMeasure {
  /** Measure index (0-based) */
  index: number;
  /** Optional section name parsed from a preceding [Label] marker */
  label?: string;
  /** Beats contained in this measure */
  beats: TabBeat[];
}

export interface TabScore {
  /** Score title or parsed header */
  title: string;
  /** Tempo in Beats Per Minute */
  tempoBpm: number;
  /** Time signature: [numerator, denominator] e.g. [4, 4] */
  timeSignature: [number, number];
  /** Tuning identifier (e.g. 'standard', 'drop_d') */
  tuningId: string;
  /** Measures list */
  measures: TabMeasure[];
}

/** Convert a time signature into quarter-note beat units per measure. */
export function getBeatsPerMeasure(timeSignature: [number, number]): number {
  const [numerator, denominator] = timeSignature;
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    numerator <= 0 ||
    denominator <= 0
  ) {
    return 4;
  }
  return numerator * (4 / denominator);
}
