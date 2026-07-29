/**
 * Preset Circuit Library
 *
 * Pre-configured guitar wiring harnesses including:
 * 1. High-Performance Indie-Rock Telecaster (4-Way Series/Parallel + DPDT Phase Flip + Concentric Tone/Blend)
 * 2. Standard 50s Telecaster (3-Way Blade)
 */

import type { CanvasComponentInstance } from '@store/canvasStore';
import type { Component, CircuitEdge } from '@graph/types';

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  components: (Component & CanvasComponentInstance)[];
  edges: CircuitEdge[];
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  wireColor: string,
): CircuitEdge {
  return {
    id,
    source,
    target,
    wireColor,
    resistance: 0.05,
    connectionType: 'solder',
    wireType: 'vintage_cloth_pushback',
  };
}

export const PRESETS: PresetDefinition[] = [
  {
    id: 'indie_rock_tele',
    name: 'Indie-Rock Telecaster (4-Way + DPDT Phase + Concentric)',
    description:
      'Squier CV Alnico Single Coils, 4-Way Series/Parallel Blade, Alpha DPDT Phase Flip, A250K Vol, B500K Concentric Tone/Blend, 470pF Treble Bleed & 470kΩ Resistor.',
    components: [
      {
        id: 'pickup_neck',
        type: 'pickup_single_coil',
        label: 'Neck Pickup (Squier CV 3-Wire)',
        x: 60,
        y: 80,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_single_coil',
        label: 'Bridge Pickup (Squier CV)',
        x: 60,
        y: 220,
        width: 140,
        height: 60,
      },
      {
        id: 'switch_4way_tele',
        type: 'switch_4way',
        label: 'Oak Grigsby 4-Way Blade',
        x: 280,
        y: 80,
        width: 150,
        height: 90,
      },
      {
        id: 'dpdt_phase',
        type: 'switch_dpdt',
        label: 'Alpha DPDT Phase Switch',
        x: 280,
        y: 220,
        width: 80,
        height: 110,
      },
      {
        id: 'pot_vol',
        type: 'pot_volume',
        label: 'Vol Pot (A250K Audio)',
        value: { resistance_kohms: 250, taper: 'audio', position: 1 },
        x: 480,
        y: 80,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_concentric_tb',
        type: 'pot_concentric',
        label: 'Concentric Tone/Blend (B500K)',
        value: { resistance_kohms: 500, taper: 'linear', position: 1 },
        x: 480,
        y: 240,
        width: 100,
        height: 120,
      },
      {
        id: 'cap_treble_bleed',
        type: 'capacitor',
        label: '470pF Treble Bleed Cap',
        value: { capacitance_pf: 470 },
        x: 660,
        y: 80,
        width: 80,
        height: 44,
      },
      {
        id: 'res_tame',
        type: 'resistor',
        label: '470kΩ Load Resistor',
        value: { resistance_ohms: 470000 },
        x: 660,
        y: 170,
        width: 90,
        height: 38,
      },
      {
        id: 'jack_out',
        type: 'output_jack',
        label: 'Switchcraft 1/4" Output Jack',
        x: 660,
        y: 260,
        width: 80,
        height: 80,
      },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_hot', 'dpdt_phase_poleA_common', '#ffffff'),
      makeEdge('e2', 'pickup_neck_ground', 'dpdt_phase_poleB_common', '#000000'),
      makeEdge('e3', 'dpdt_phase_poleA_pos1', 'switch_4way_tele_poleA_pos3', '#ffffff'),
      makeEdge('e4', 'dpdt_phase_poleB_pos1', 'switch_4way_tele_poleA_common', '#38bdf8'),
      makeEdge('e5', 'pickup_bridge_hot', 'switch_4way_tele_poleB_pos1', '#ff8c00'),
      makeEdge('e6', 'pickup_bridge_ground', 'jack_out_sleeve', '#000000'),

      makeEdge('e7', 'switch_4way_tele_poleB_common', 'pot_vol_lug3', '#ffffff'),

      makeEdge('e8', 'pot_vol_lug3', 'cap_treble_bleed_lead1', '#38bdf8'),
      makeEdge('e9', 'pot_vol_wiper', 'cap_treble_bleed_lead2', '#38bdf8'),

      makeEdge('e10', 'pot_vol_wiper', 'pot_concentric_tb_outer_lug3', '#38bdf8'),
      makeEdge('e11', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),

      makeEdge('e12', 'pot_concentric_tb_outer_wiper', 'res_tame_lead1', '#a855f7'),
      makeEdge('e13', 'res_tame_lead2', 'jack_out_sleeve', '#000000'),

      makeEdge('e14', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),
    ],
  },
  {
    id: 'std_tele',
    name: 'Standard Telecaster (3-Way)',
    description:
      'Vintage 2 Single-Coil Telecaster wiring with 3-Way Blade Switch, 250K Vol, 250K Tone & .047µF Cap.',
    components: [
      { id: 'pickup_neck', type: 'pickup_single_coil', label: 'Neck Pickup', x: 80, y: 100, width: 140, height: 60 },
      { id: 'pickup_bridge', type: 'pickup_single_coil', label: 'Bridge Pickup', x: 80, y: 220, width: 140, height: 60 },
      { id: 'switch_3way_tele', type: 'switch_3way', label: '3-Way Toggle', x: 280, y: 140, width: 100, height: 95 },
      { id: 'pot_vol', type: 'pot_volume', label: 'Volume Pot', x: 450, y: 100, width: 90, height: 100 },
      { id: 'pot_tone', type: 'pot_tone', label: 'Tone Pot', x: 450, y: 240, width: 90, height: 100 },
      { id: 'cap_tone', type: 'capacitor', label: '.047µF Cap', x: 600, y: 240, width: 80, height: 44 },
      { id: 'jack_out', type: 'output_jack', label: '1/4" Jack', x: 600, y: 100, width: 80, height: 80 },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_hot', 'switch_3way_tele_pos1', '#ffffff'),
      makeEdge('e2', 'pickup_bridge_hot', 'switch_3way_tele_pos3', '#ff8c00'),
      makeEdge('e3', 'switch_3way_tele_common', 'pot_vol_lug3', '#ffffff'),
      makeEdge('e4', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),
      makeEdge('e5', 'pot_vol_lug3', 'pot_tone_lug3', '#38bdf8'),
      makeEdge('e6', 'pot_tone_wiper', 'cap_tone_lead1', '#ea580c'),
      makeEdge('e7', 'cap_tone_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e8', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e9', 'pickup_neck_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e10', 'pickup_bridge_ground', 'jack_out_sleeve', '#000000'),
    ],
  },
];
