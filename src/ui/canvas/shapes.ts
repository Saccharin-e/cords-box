/**
 * Component Shape Definitions
 *
 * Width, height, and lug anchor positions for each component type,
 * used by both the Physical and Schematic canvas renderers.
 */

import type { ComponentType } from '@graph/types';

export interface LugAnchor {
  id: string;       // suffix appended to componentId to form node id
  label: string;
  role: 'hot' | 'ground' | 'wiper' | 'common' | 'output' | 'lug';
  relX: number;     // 0..1 relative to component width
  relY: number;     // 0..1 relative to component height
}

export interface ComponentShape {
  type: ComponentType;
  width: number;
  height: number;
  label: string;
  color: string;   // accent color matching the hardware theme
  lugs: LugAnchor[];
}

const SHAPES: Record<ComponentType, ComponentShape> = {
  pickup_single_coil: {
    type: 'pickup_single_coil',
    width: 120,
    height: 56,
    label: 'Single Coil',
    color: '#ff8c00',
    lugs: [
      { id: '_hot',    label: 'Hot',    role: 'hot',    relX: 0.8, relY: 0.5 },
      { id: '_ground', label: 'GND',    role: 'ground', relX: 0.2, relY: 0.5 },
    ],
  },
  pickup_humbucker: {
    type: 'pickup_humbucker',
    width: 140,
    height: 56,
    label: 'Humbucker',
    color: '#ff8c00',
    lugs: [
      { id: '_hot',    label: 'Hot',    role: 'hot',    relX: 0.85, relY: 0.5 },
      { id: '_ground', label: 'GND',    role: 'ground', relX: 0.15, relY: 0.5 },
      { id: '_tap',    label: 'Tap',    role: 'lug',    relX: 0.5,  relY: 1.0 },
    ],
  },
  switch_3way: {
    type: 'switch_3way',
    width: 100,
    height: 80,
    label: '3-Way',
    color: '#00e5ff',
    lugs: [
      { id: '_common',  label: 'COM',  role: 'common', relX: 0.5, relY: 1.0 },
      { id: '_pos1',    label: 'P1',   role: 'lug',    relX: 0.1, relY: 0.2 },
      { id: '_pos2',    label: 'P2',   role: 'lug',    relX: 0.5, relY: 0.2 },
      { id: '_pos3',    label: 'P3',   role: 'lug',    relX: 0.9, relY: 0.2 },
    ],
  },
  switch_4way: {
    type: 'switch_4way',
    width: 120,
    height: 100,
    label: '4-Way',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.25, relY: 1.0 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.75, relY: 1.0 },
      { id: '_poleA_pos1',   label: 'A1',    role: 'lug',    relX: 0.05, relY: 0.15 },
      { id: '_poleA_pos2',   label: 'A2',    role: 'lug',    relX: 0.25, relY: 0.15 },
      { id: '_poleA_pos3',   label: 'A3',    role: 'lug',    relX: 0.45, relY: 0.15 },
      { id: '_poleB_pos1',   label: 'B1',    role: 'lug',    relX: 0.55, relY: 0.15 },
      { id: '_poleB_pos2',   label: 'B2',    role: 'lug',    relX: 0.75, relY: 0.15 },
      { id: '_poleB_pos3',   label: 'B3',    role: 'lug',    relX: 0.95, relY: 0.15 },
    ],
  },
  switch_5way: {
    type: 'switch_5way',
    width: 160,
    height: 80,
    label: '5-Way',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.25, relY: 1.0 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.75, relY: 1.0 },
      { id: '_poleA_pos1',   label: 'A1',    role: 'lug',    relX: 0.07, relY: 0.15 },
      { id: '_poleA_pos2',   label: 'A2',    role: 'lug',    relX: 0.2,  relY: 0.15 },
      { id: '_poleA_pos3',   label: 'A3',    role: 'lug',    relX: 0.33, relY: 0.15 },
      { id: '_poleB_pos1',   label: 'B1',    role: 'lug',    relX: 0.6,  relY: 0.15 },
      { id: '_poleB_pos2',   label: 'B2',    role: 'lug',    relX: 0.73, relY: 0.15 },
      { id: '_poleB_pos3',   label: 'B3',    role: 'lug',    relX: 0.86, relY: 0.15 },
    ],
  },
  switch_dpdt: {
    type: 'switch_dpdt',
    width: 80,
    height: 100,
    label: 'DPDT',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.25, relY: 0.5 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.75, relY: 0.5 },
      { id: '_poleA_pos1',   label: 'A1',    role: 'lug',    relX: 0.25, relY: 0.1 },
      { id: '_poleA_pos2',   label: 'A2',    role: 'lug',    relX: 0.25, relY: 0.9 },
      { id: '_poleB_pos1',   label: 'B1',    role: 'lug',    relX: 0.75, relY: 0.1 },
      { id: '_poleB_pos2',   label: 'B2',    role: 'lug',    relX: 0.75, relY: 0.9 },
    ],
  },
  pot_volume: {
    type: 'pot_volume',
    width: 72,
    height: 72,
    label: 'Volume',
    color: '#39ff14',
    lugs: [
      { id: '_lug1',  label: '1',     role: 'lug',    relX: 0.0, relY: 0.8 },
      { id: '_wiper', label: 'Wiper', role: 'wiper',  relX: 0.5, relY: 1.0 },
      { id: '_lug3',  label: '3',     role: 'lug',    relX: 1.0, relY: 0.8 },
    ],
  },
  pot_tone: {
    type: 'pot_tone',
    width: 72,
    height: 72,
    label: 'Tone',
    color: '#39ff14',
    lugs: [
      { id: '_lug1',  label: '1',     role: 'lug',    relX: 0.0, relY: 0.8 },
      { id: '_wiper', label: 'Wiper', role: 'wiper',  relX: 0.5, relY: 1.0 },
      { id: '_lug3',  label: '3',     role: 'lug',    relX: 1.0, relY: 0.8 },
    ],
  },
  pot_blend: {
    type: 'pot_blend',
    width: 72,
    height: 72,
    label: 'Blend',
    color: '#39ff14',
    lugs: [
      { id: '_lug1',  label: '1',     role: 'lug',    relX: 0.0, relY: 0.8 },
      { id: '_wiper', label: 'Wiper', role: 'wiper',  relX: 0.5, relY: 1.0 },
      { id: '_lug3',  label: '3',     role: 'lug',    relX: 1.0, relY: 0.8 },
    ],
  },
  pot_concentric: {
    type: 'pot_concentric',
    width: 80,
    height: 80,
    label: 'Concentric',
    color: '#39ff14',
    lugs: [
      { id: '_outer_lug1',  label: 'O1',    role: 'lug',   relX: 0.0, relY: 0.4 },
      { id: '_outer_wiper', label: 'O-Wip', role: 'wiper', relX: 0.5, relY: 0.0 },
      { id: '_outer_lug3',  label: 'O3',    role: 'lug',   relX: 1.0, relY: 0.4 },
      { id: '_inner_lug1',  label: 'I1',    role: 'lug',   relX: 0.0, relY: 0.8 },
      { id: '_inner_wiper', label: 'I-Wip', role: 'wiper', relX: 0.5, relY: 1.0 },
      { id: '_inner_lug3',  label: 'I3',    role: 'lug',   relX: 1.0, relY: 0.8 },
    ],
  },
  capacitor: {
    type: 'capacitor',
    width: 56,
    height: 40,
    label: 'Cap',
    color: '#ff00ff',
    lugs: [
      { id: '_lead1', label: '+', role: 'lug', relX: 0.0, relY: 0.5 },
      { id: '_lead2', label: '−', role: 'lug', relX: 1.0, relY: 0.5 },
    ],
  },
  resistor: {
    type: 'resistor',
    width: 64,
    height: 32,
    label: 'R',
    color: '#ff00ff',
    lugs: [
      { id: '_lead1', label: '1', role: 'lug', relX: 0.0, relY: 0.5 },
      { id: '_lead2', label: '2', role: 'lug', relX: 1.0, relY: 0.5 },
    ],
  },
  output_jack: {
    type: 'output_jack',
    width: 56,
    height: 56,
    label: 'Jack',
    color: '#ff3333',
    lugs: [
      { id: '_tip',    label: 'Tip',    role: 'output', relX: 0.5, relY: 0.0 },
      { id: '_sleeve', label: 'Sleeve', role: 'ground', relX: 0.5, relY: 1.0 },
    ],
  },
};

export function getShape(type: ComponentType): ComponentShape {
  return SHAPES[type];
}

export function getLugAbsolutePosition(
  shape: ComponentShape,
  lug: LugAnchor,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: x + lug.relX * shape.width,
    y: y + lug.relY * shape.height,
  };
}
