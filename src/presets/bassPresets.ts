/**
 * bassPresets.ts — Classic Bass Wiring Harness Presets
 */

import { Graph } from '@graph/Graph';
import type { Component } from '@graph/types';

export function createJazzBassPreset(): Graph {
  const graph = new Graph('Bass');

  const components: Component[] = [
    {
      id: 'pickup_neck_j',
      type: 'pickup_single_coil',
      label: 'Jazz Neck Pickup',
      position: { x: 100, y: 150 },
    },
    {
      id: 'pickup_bridge_j',
      type: 'pickup_single_coil',
      label: 'Jazz Bridge Pickup',
      position: { x: 250, y: 150 },
    },
    {
      id: 'pot_vol_neck',
      type: 'pot_volume',
      label: 'Neck Volume (250k)',
      position: { x: 100, y: 300 },
      value: { resistance_kohms: 250, position: 1.0, taper: 'audio' },
    },
    {
      id: 'pot_vol_bridge',
      type: 'pot_volume',
      label: 'Bridge Volume (250k)',
      position: { x: 250, y: 300 },
      value: { resistance_kohms: 250, position: 1.0, taper: 'audio' },
    },
    {
      id: 'pot_master_tone',
      type: 'pot_tone',
      label: 'Master Tone (250k)',
      position: { x: 400, y: 300 },
      value: { resistance_kohms: 250, position: 1.0, taper: 'audio' },
    },
    {
      id: 'cap_tone',
      type: 'capacitor',
      label: 'Tone Cap (0.047µF)',
      position: { x: 400, y: 400 },
      value: { capacitance_pf: 47000 },
    },
    {
      id: 'jack_out',
      type: 'output_jack',
      label: 'Mono Output Jack',
      position: { x: 550, y: 300 },
    },
  ];

  components.forEach((c) => graph.addComponent(c));

  // Add nodes for components
  components.forEach((c) => {
    const pos = c.position ?? { x: 0, y: 0 };
    if (c.type.startsWith('pickup_')) {
      graph.addNode({
        id: `${c.id}_hot`,
        componentId: c.id,
        role: 'hot',
        type: 'terminal',
        signalState: 'active',
        position: pos,
      });
      graph.addNode({
        id: `${c.id}_ground`,
        componentId: c.id,
        role: 'ground',
        type: 'ground',
        signalState: 'grounded',
        position: { x: pos.x + 30, y: pos.y },
      });
    } else if (c.type === 'output_jack') {
      graph.addNode({
        id: `${c.id}_tip`,
        componentId: c.id,
        role: 'tip',
        type: 'jack_terminal',
        signalState: 'active',
        position: pos,
      });
      graph.addNode({
        id: `${c.id}_sleeve`,
        componentId: c.id,
        role: 'sleeve',
        type: 'ground',
        signalState: 'grounded',
        position: { x: pos.x, y: pos.y + 30 },
      });
    }
  });

  return graph;
}
