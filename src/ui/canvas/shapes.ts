/**
 * Component Shape Definitions
 *
 * Width, height, and verified real-world physical lug anchor positions for each component type,
 * perfectly matched to DIYLC (DIY Layout Creator) datasheets and hardware standards.
 * Supports rotation and flipping transformations.
 */

import type { ComponentType } from '@graph/types';
import type { CanvasComponentInstance } from '@store/canvasStore';

export interface LugAnchor {
  id: string; // suffix appended to componentId to form node id
  label: string;
  role: 'hot' | 'ground' | 'wiper' | 'common' | 'output' | 'lug';
  relX: number; // 0..1 relative to component width
  relY: number; // 0..1 relative to component height
}

export interface ComponentShape {
  type: ComponentType;
  width: number;
  height: number;
  label: string;
  color: string; // accent color for UI selection
  lugs: LugAnchor[];
}

export interface CanvasLugTarget {
  nodeId: string; // e.g. "pickup_neck_hot"
  componentId: string; // e.g. "pickup_neck"
  lugId: string; // e.g. "_hot"
  label: string;
  x: number;
  y: number;
}

const SHAPES: Record<ComponentType, ComponentShape> = {
  pickup_single_coil: {
    type: 'pickup_single_coil',
    width: 140,
    height: 60,
    label: 'Single Coil',
    color: '#ff8c00',
    lugs: [
      { id: '_ground', label: 'GND (Black)', role: 'ground', relX: 0.35, relY: 0.9 },
      { id: '_hot', label: 'HOT (White)', role: 'hot', relX: 0.65, relY: 0.9 },
    ],
  },
  pickup_humbucker: {
    type: 'pickup_humbucker',
    width: 160,
    height: 75,
    label: 'Humbucker',
    color: '#ff8c00',
    lugs: [
      { id: '_north_start', label: 'N-Start (Black/Hot)', role: 'hot', relX: 0.15, relY: 0.92 },
      { id: '_north_finish', label: 'N-Finish (White)', role: 'lug', relX: 0.32, relY: 0.92 },
      { id: '_south_finish', label: 'S-Finish (Red)', role: 'lug', relX: 0.49, relY: 0.92 },
      { id: '_south_start', label: 'S-Start (Green)', role: 'ground', relX: 0.66, relY: 0.92 },
      { id: '_shield', label: 'Shield (Bare)', role: 'ground', relX: 0.83, relY: 0.92 },
    ],
  },
  switch_3way: {
    type: 'switch_3way',
    width: 100,
    height: 95,
    label: '3-Way Toggle',
    color: '#00e5ff',
    lugs: [
      { id: '_pos1', label: 'Neck (P1)', role: 'lug', relX: 0.15, relY: 0.25 },
      { id: '_pos2', label: 'Mid (P2)', role: 'lug', relX: 0.5, relY: 0.25 },
      { id: '_pos3', label: 'Brdg (P3)', role: 'lug', relX: 0.85, relY: 0.25 },
      { id: '_common', label: 'Output COM', role: 'common', relX: 0.5, relY: 0.9 },
    ],
  },
  switch_4way: {
    type: 'switch_4way',
    width: 170,
    height: 90,
    label: '4-Way Blade',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.08, relY: 0.88 },
      { id: '_poleA_pos1', label: 'A1', role: 'lug', relX: 0.17, relY: 0.88 },
      { id: '_poleA_pos2', label: 'A2', role: 'lug', relX: 0.26, relY: 0.88 },
      { id: '_poleA_pos3', label: 'A3', role: 'lug', relX: 0.35, relY: 0.88 },
      { id: '_poleA_pos4', label: 'A4', role: 'lug', relX: 0.44, relY: 0.88 },
      { id: '_poleB_pos1', label: 'B1', role: 'lug', relX: 0.56, relY: 0.88 },
      { id: '_poleB_pos2', label: 'B2', role: 'lug', relX: 0.65, relY: 0.88 },
      { id: '_poleB_pos3', label: 'B3', role: 'lug', relX: 0.74, relY: 0.88 },
      { id: '_poleB_pos4', label: 'B4', role: 'lug', relX: 0.83, relY: 0.88 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.92, relY: 0.88 },
    ],
  },
  switch_5way: {
    type: 'switch_5way',
    width: 170,
    height: 90,
    label: '5-Way Blade',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.08, relY: 0.88 },
      { id: '_poleA_pos1', label: 'A1', role: 'lug', relX: 0.2, relY: 0.88 },
      { id: '_poleA_pos2', label: 'A2', role: 'lug', relX: 0.32, relY: 0.88 },
      { id: '_poleA_pos3', label: 'A3', role: 'lug', relX: 0.44, relY: 0.88 },
      { id: '_poleB_pos1', label: 'B1', role: 'lug', relX: 0.56, relY: 0.88 },
      { id: '_poleB_pos2', label: 'B2', role: 'lug', relX: 0.68, relY: 0.88 },
      { id: '_poleB_pos3', label: 'B3', role: 'lug', relX: 0.8, relY: 0.88 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.92, relY: 0.88 },
    ],
  },
  switch_dpdt: {
    type: 'switch_dpdt',
    width: 80,
    height: 110,
    label: 'DPDT Mini',
    color: '#00e5ff',
    lugs: [
      { id: '_poleA_pos1', label: 'A1', role: 'lug', relX: 0.28, relY: 0.22 },
      { id: '_poleB_pos1', label: 'B1', role: 'lug', relX: 0.72, relY: 0.22 },
      { id: '_poleA_common', label: 'A-COM', role: 'common', relX: 0.28, relY: 0.53 },
      { id: '_poleB_common', label: 'B-COM', role: 'common', relX: 0.72, relY: 0.53 },
      { id: '_poleA_pos2', label: 'A2', role: 'lug', relX: 0.28, relY: 0.84 },
      { id: '_poleB_pos2', label: 'B2', role: 'lug', relX: 0.72, relY: 0.84 },
    ],
  },
  pot_volume: {
    type: 'pot_volume',
    width: 90,
    height: 100,
    label: 'Volume Pot',
    color: '#39ff14',
    lugs: [
      { id: '_lug1', label: 'L1 (CCW)', role: 'lug', relX: 0.2, relY: 0.9 },
      { id: '_wiper', label: 'Wiper (2)', role: 'wiper', relX: 0.5, relY: 0.9 },
      { id: '_lug3', label: 'L3 (CW)', role: 'lug', relX: 0.8, relY: 0.9 },
    ],
  },
  pot_tone: {
    type: 'pot_tone',
    width: 90,
    height: 100,
    label: 'Tone Pot',
    color: '#39ff14',
    lugs: [
      { id: '_lug1', label: 'L1 (CCW)', role: 'lug', relX: 0.2, relY: 0.9 },
      { id: '_wiper', label: 'Wiper (2)', role: 'wiper', relX: 0.5, relY: 0.9 },
      { id: '_lug3', label: 'L3 (CW)', role: 'lug', relX: 0.8, relY: 0.9 },
    ],
  },
  pot_blend: {
    type: 'pot_blend',
    width: 100,
    height: 120,
    label: 'Blend Pot',
    color: '#39ff14',
    lugs: [
      { id: '_potA_lug1', label: 'A1', role: 'lug', relX: 0.18, relY: 0.45 },
      { id: '_potA_wiper', label: 'AW', role: 'wiper', relX: 0.5, relY: 0.45 },
      { id: '_potA_lug3', label: 'A3', role: 'lug', relX: 0.82, relY: 0.45 },
      { id: '_potB_lug1', label: 'B1', role: 'lug', relX: 0.18, relY: 0.9 },
      { id: '_potB_wiper', label: 'BW', role: 'wiper', relX: 0.5, relY: 0.9 },
      { id: '_potB_lug3', label: 'B3', role: 'lug', relX: 0.82, relY: 0.9 },
    ],
  },
  pot_concentric: {
    type: 'pot_concentric',
    width: 100,
    height: 120,
    label: 'Dual Pot',
    color: '#39ff14',
    lugs: [
      { id: '_outer_lug1', label: 'O1', role: 'lug', relX: 0.18, relY: 0.45 },
      { id: '_outer_wiper', label: 'OW', role: 'wiper', relX: 0.5, relY: 0.45 },
      { id: '_outer_lug3', label: 'O3', role: 'lug', relX: 0.82, relY: 0.45 },
      { id: '_inner_lug1', label: 'I1', role: 'lug', relX: 0.18, relY: 0.9 },
      { id: '_inner_wiper', label: 'IW', role: 'wiper', relX: 0.5, relY: 0.9 },
      { id: '_inner_lug3', label: 'I3', role: 'lug', relX: 0.82, relY: 0.9 },
    ],
  },
  capacitor: {
    type: 'capacitor',
    width: 80,
    height: 44,
    label: 'Capacitor',
    color: '#ff00ff',
    lugs: [
      { id: '_lead1', label: 'L1', role: 'lug', relX: 0.05, relY: 0.5 },
      { id: '_lead2', label: 'L2', role: 'lug', relX: 0.95, relY: 0.5 },
    ],
  },
  resistor: {
    type: 'resistor',
    width: 90,
    height: 38,
    label: 'Resistor',
    color: '#ff00ff',
    lugs: [
      { id: '_lead1', label: 'L1', role: 'lug', relX: 0.05, relY: 0.5 },
      { id: '_lead2', label: 'L2', role: 'lug', relX: 0.95, relY: 0.5 },
    ],
  },
  output_jack: {
    type: 'output_jack',
    width: 80,
    height: 80,
    label: '1/4" Jack',
    color: '#ff3333',
    lugs: [
      { id: '_tip', label: 'Tip (Hot)', role: 'output', relX: 0.82, relY: 0.25 },
      { id: '_sleeve', label: 'Sleeve (GND)', role: 'ground', relX: 0.82, relY: 0.75 },
    ],
  },
  pickup_p90: {
    type: 'pickup_p90',
    width: 150,
    height: 65,
    label: 'P-90 Soapbar',
    color: '#ff8c00',
    lugs: [
      { id: '_ground', label: 'GND (Black)', role: 'ground', relX: 0.35, relY: 0.9 },
      { id: '_hot', label: 'HOT (White)', role: 'hot', relX: 0.65, relY: 0.9 },
    ],
  },
  pot_pushpull: {
    type: 'pot_pushpull',
    width: 95,
    height: 150,
    label: 'Push-Pull Pot',
    color: '#39ff14',
    lugs: [
      // Potentiometer Lugs
      { id: '_lug1', label: 'L1 (CCW)', role: 'lug', relX: 0.2, relY: 0.35 },
      { id: '_wiper', label: 'Wiper (2)', role: 'wiper', relX: 0.5, relY: 0.35 },
      { id: '_lug3', label: 'L3 (CW)', role: 'lug', relX: 0.8, relY: 0.35 },
      // DPDT Switch Lugs
      { id: '_swA1', label: 'SW A1', role: 'lug', relX: 0.25, relY: 0.68 },
      { id: '_swA2', label: 'SW A2 (COM)', role: 'common', relX: 0.25, relY: 0.8 },
      { id: '_swA3', label: 'SW A3', role: 'lug', relX: 0.25, relY: 0.92 },
      { id: '_swB1', label: 'SW B1', role: 'lug', relX: 0.75, relY: 0.68 },
      { id: '_swB2', label: 'SW B2 (COM)', role: 'common', relX: 0.75, relY: 0.8 },
      { id: '_swB3', label: 'SW B3', role: 'lug', relX: 0.75, relY: 0.92 },
    ],
  },
  battery_9v: {
    type: 'battery_9v',
    width: 80,
    height: 115,
    label: '9V Active Battery',
    color: '#eab308',
    lugs: [
      { id: '_pos', label: '9V (+) Red', role: 'hot', relX: 0.35, relY: 0.92 },
      { id: '_neg', label: 'GND (-) Black', role: 'ground', relX: 0.65, relY: 0.92 },
    ],
  },
  ground_terminal: {
    type: 'ground_terminal',
    width: 100,
    height: 55,
    label: 'Star Ground Lug',
    color: '#e2e8f0',
    lugs: [
      { id: '_g1', label: 'GND 1', role: 'ground', relX: 0.15, relY: 0.5 },
      { id: '_g2', label: 'GND 2', role: 'ground', relX: 0.35, relY: 0.5 },
      { id: '_g3', label: 'GND 3', role: 'ground', relX: 0.65, relY: 0.5 },
      { id: '_g4', label: 'GND 4', role: 'ground', relX: 0.85, relY: 0.5 },
    ],
  },
  treble_bleed: {
    type: 'treble_bleed',
    width: 75,
    height: 45,
    label: 'Treble Bleed Mod',
    color: '#a855f7',
    lugs: [
      { id: '_in', label: 'In (Wiper/Hot)', role: 'lug', relX: 0.08, relY: 0.5 },
      { id: '_out', label: 'Out (Lug3)', role: 'lug', relX: 0.92, relY: 0.5 },
    ],
  },
  text_box: {
    type: 'text_box',
    width: 220,
    height: 90,
    label: 'Text Box',
    color: '#38bdf8',
    lugs: [],
  },
  project_card: {
    type: 'project_card',
    width: 320,
    height: 150,
    label: 'Project Info Card',
    color: '#38bdf8',
    lugs: [],
  },
  shape_rect: {
    type: 'shape_rect',
    width: 160,
    height: 120,
    label: 'Shield / Box Shape',
    color: '#a855f7',
    lugs: [],
  },
  shape_circle: {
    type: 'shape_circle',
    width: 120,
    height: 120,
    label: 'Cavity Circle',
    color: '#a855f7',
    lugs: [],
  },
  shape_line: {
    type: 'shape_line',
    width: 140,
    height: 40,
    label: 'Guide Line',
    color: '#a855f7',
    lugs: [],
  },
  shape_arrow: {
    type: 'shape_arrow',
    width: 140,
    height: 40,
    label: 'Pointer Arrow',
    color: '#a855f7',
    lugs: [],
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
  rotation = 0,
  flippedH = false,
  flippedV = false,
): { x: number; y: number } {
  let dx = (lug.relX - 0.5) * shape.width;
  let dy = (lug.relY - 0.5) * shape.height;

  if (flippedH) dx = -dx;
  if (flippedV) dy = -dy;

  if (rotation !== 0) {
    const rad = (rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    dx = rx;
    dy = ry;
  }

  return {
    x: x + shape.width / 2 + dx,
    y: y + shape.height / 2 + dy,
  };
}

export function getAllCanvasLugs(instances: CanvasComponentInstance[]): CanvasLugTarget[] {
  const targets: CanvasLugTarget[] = [];
  for (const inst of instances) {
    const shape = getShape(inst.type);
    for (const lug of shape.lugs) {
      const pos = getLugAbsolutePosition(
        shape,
        lug,
        inst.x,
        inst.y,
        inst.rotation ?? 0,
        inst.flippedH ?? false,
        inst.flippedV ?? false,
      );
      targets.push({
        nodeId: `${inst.id}${lug.id}`,
        componentId: inst.id,
        lugId: lug.id,
        label: lug.label,
        x: pos.x,
        y: pos.y,
      });
    }
  }
  return targets;
}
