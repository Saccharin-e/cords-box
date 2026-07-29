/**
 * Default Circuit Specification — High-Performance Indie-Rock Telecaster Wiring Harness
 *
 * Automatically loaded on startup:
 * - Squier Classic Vibe Alnico Single Coils (Neck 3-wire mod)
 * - Oak Grigsby 4-Way Series/Parallel Selector Switch
 * - Alpha DPDT Push-Pull Phase Switch
 * - A250K Volume Pot
 * - B500K Concentric Tone & Blend Pot
 * - 470pF Treble Bleed Capacitor
 * - 470kΩ Load Taming Resistor
 * - 1/4" Mono Switchcraft Output Jack
 */

import type { CanvasComponentInstance } from '@store/canvasStore';
import type { Component, CircuitEdge } from '@graph/types';

export const DEFAULT_COMPONENTS: (Component & CanvasComponentInstance)[] = [
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
];

function makeEdge(id: string, source: string, target: string, wireColor: string): CircuitEdge {
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

export const DEFAULT_EDGES: CircuitEdge[] = [
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
];
