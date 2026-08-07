/**
 * tuningStore.ts — Alternate Guitar/Bass Tunings Store
 */

import { create } from 'zustand';

export interface TuningStringConfig {
  name: string;
  openFreq: number;
  openMidi: number;
}

export interface TuningPreset {
  id: string;
  label: string;
  description: string;
  strings: TuningStringConfig[];
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: 'standard_e',
    label: 'Standard E',
    description: 'E2 A2 D3 G3 B3 E4',
    strings: [
      { name: 'E4 (High E)', openFreq: 329.63, openMidi: 64 },
      { name: 'B3', openFreq: 246.94, openMidi: 59 },
      { name: 'G3', openFreq: 196.0, openMidi: 55 },
      { name: 'D3', openFreq: 146.83, openMidi: 50 },
      { name: 'A2', openFreq: 110.0, openMidi: 45 },
      { name: 'E2 (Low E)', openFreq: 82.41, openMidi: 40 },
    ],
  },
  {
    id: 'drop_d',
    label: 'Drop D',
    description: 'D2 A2 D3 G3 B3 E4',
    strings: [
      { name: 'E4 (High E)', openFreq: 329.63, openMidi: 64 },
      { name: 'B3', openFreq: 246.94, openMidi: 59 },
      { name: 'G3', openFreq: 196.0, openMidi: 55 },
      { name: 'D3', openFreq: 146.83, openMidi: 50 },
      { name: 'A2', openFreq: 110.0, openMidi: 45 },
      { name: 'D2 (Drop D)', openFreq: 73.42, openMidi: 38 },
    ],
  },
  {
    id: 'eb_standard',
    label: 'Eb Standard',
    description: 'Eb2 Ab2 Db3 Gb3 Bb3 Eb4',
    strings: [
      { name: 'Eb4', openFreq: 311.13, openMidi: 63 },
      { name: 'Bb3', openFreq: 233.08, openMidi: 58 },
      { name: 'Gb3', openFreq: 185.0, openMidi: 54 },
      { name: 'Db3', openFreq: 138.59, openMidi: 49 },
      { name: 'Ab2', openFreq: 103.83, openMidi: 44 },
      { name: 'Eb2', openFreq: 77.78, openMidi: 39 },
    ],
  },
  {
    id: 'open_g',
    label: 'Open G',
    description: 'D2 G2 D3 G3 B3 D4',
    strings: [
      { name: 'D4', openFreq: 293.66, openMidi: 62 },
      { name: 'B3', openFreq: 246.94, openMidi: 59 },
      { name: 'G3', openFreq: 196.0, openMidi: 55 },
      { name: 'D3', openFreq: 146.83, openMidi: 50 },
      { name: 'G2', openFreq: 98.0, openMidi: 43 },
      { name: 'D2', openFreq: 73.42, openMidi: 38 },
    ],
  },
  {
    id: 'dadgad',
    label: 'DADGAD',
    description: 'D2 A2 D3 G3 A3 D4',
    strings: [
      { name: 'D4', openFreq: 293.66, openMidi: 62 },
      { name: 'A3', openFreq: 220.0, openMidi: 57 },
      { name: 'G3', openFreq: 196.0, openMidi: 55 },
      { name: 'D3', openFreq: 146.83, openMidi: 50 },
      { name: 'A2', openFreq: 110.0, openMidi: 45 },
      { name: 'D2', openFreq: 73.42, openMidi: 38 },
    ],
  },
];

interface TuningState {
  activeTuningId: string;
  currentPreset: TuningPreset;
  setTuning: (presetId: string) => void;
}

export const useTuningStore = create<TuningState>((set) => ({
  activeTuningId: 'standard_e',
  currentPreset: TUNING_PRESETS[0],
  setTuning: (presetId: string) => {
    const preset = TUNING_PRESETS.find((p) => p.id === presetId) || TUNING_PRESETS[0];
    set({ activeTuningId: preset.id, currentPreset: preset });
  },
}));
