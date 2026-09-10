/**
 * Preset Circuit Library
 *
 * Pre-configured guitar wiring harnesses including:
 * 1. Guitar Sound Test Bench (HSS Stratocaster & DSP Test Harness)
 * 2. High-Performance Indie-Rock Telecaster (4-Way Series/Parallel + DPDT Phase Flip + Concentric Tone/Blend)
 * 3. Standard 50s Telecaster (3-Way Blade)
 */

import type { CanvasComponentInstance } from '@store/canvasStore';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { getShape } from '../ui/canvas/shapes';
import type { Component, CircuitEdge, CircuitNode } from '@graph/types';

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  components: (Component & CanvasComponentInstance)[];
  edges: CircuitEdge[];
}

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

export const PRESETS: PresetDefinition[] = [
  {
    id: 'guitar_sound_test_template',
    name: 'Guitar Sound Test Bench (HSS Stratocaster)',
    description:
      'Ideal template for testing guitar sound DSP: Neck Single Coil, Middle Single Coil, Bridge Humbucker, 5-Way Blade Switch, Master Vol, Master Tone & .047µF Cap.',
    components: [
      {
        id: 'pickup_neck',
        type: 'pickup_single_coil',
        label: 'Neck Pickup (Strat Vintage)',
        x: 60,
        y: 80,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_middle',
        type: 'pickup_single_coil',
        label: 'Middle Pickup (Strat RWRP)',
        x: 60,
        y: 170,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_humbucker',
        label: 'Bridge Humbucker (PAF 8.4k)',
        x: 60,
        y: 260,
        width: 160,
        height: 75,
      },
      {
        id: 'switch_5way_strat',
        type: 'switch_5way',
        label: '5-Way Blade Selector',
        x: 270,
        y: 150,
        width: 170,
        height: 90,
      },
      {
        id: 'pot_vol',
        type: 'pot_volume',
        label: 'Master Volume (A250K)',
        value: { resistance_kohms: 250, taper: 'audio', position: 1 },
        x: 490,
        y: 80,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_tone',
        type: 'pot_tone',
        label: 'Master Tone (B250K)',
        value: { resistance_kohms: 250, taper: 'linear', position: 1 },
        x: 490,
        y: 230,
        width: 90,
        height: 100,
      },
      {
        id: 'cap_tone',
        type: 'capacitor',
        label: '.047µF Tone Cap',
        value: { capacitance_pf: 47000 },
        x: 640,
        y: 230,
        width: 80,
        height: 44,
      },
      {
        id: 'jack_out',
        type: 'output_jack',
        label: '1/4" Output Jack',
        x: 640,
        y: 80,
        width: 80,
        height: 80,
      },
      {
        id: 'card_info',
        type: 'project_card',
        label: 'Sound Test Bench Specs',
        textValue:
          'HSS Stratocaster Test Harness\nTest notes, chords, volume roll-off & tone filtering in real time.',
        authorValue: 'Cords Box Lab',
        modelValue: 'HSS Sound Bench',
        revisionValue: 'v1.0',
        x: 270,
        y: 280,
        width: 350,
        height: 110,
      },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_hot', 'switch_5way_strat_poleA_pos1', '#ffffff'),
      makeEdge('e2', 'pickup_middle_hot', 'switch_5way_strat_poleA_pos2', '#38bdf8'),
      makeEdge('e3', 'pickup_bridge_north_start', 'switch_5way_strat_poleA_pos3', '#ff8c00'),
      makeEdge('e4', 'switch_5way_strat_poleA_common', 'pot_vol_lug3', '#ffffff'),
      makeEdge('e5', 'pot_vol_lug3', 'pot_vol_wiper', '#ffffff'),
      makeEdge('e6', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),
      makeEdge('e7', 'pot_vol_lug3', 'pot_tone_lug3', '#38bdf8'),
      makeEdge('e8', 'pot_tone_wiper', 'cap_tone_lead1', '#ea580c'),
      makeEdge('e9', 'cap_tone_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e10', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e11', 'pickup_neck_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e12', 'pickup_middle_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e13', 'pickup_bridge_south_start', 'jack_out_sleeve', '#000000'),
      makeEdge('e14', 'pickup_bridge_shield', 'jack_out_sleeve', '#000000'),
    ],
  },
  {
    id: 'indie_rock_tele',
    name: 'Custom Telecaster (Push-Pull Phase + 4-Way + Concentric Tone/Blend)',
    description:
      'Mahogany Tele: Push-pull DPDT phase-reversal volume, Oak Grigsby neck-first 4-way, B500K concentric tone+blend (half-blender), 470pF treble bleed, 470kΩ+0.022µF tone section.',
    components: [
      // ── Pickups ──
      {
        id: 'pickup_neck',
        type: 'pickup_single_coil',
        label: 'Neck Pickup (Tele Chrome Cover)',
        x: 60,
        y: 60,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_single_coil',
        label: 'Bridge Pickup (Tele Twang 8.2k)',
        x: 60,
        y: 200,
        width: 140,
        height: 60,
      },
      // ── Push-Pull Volume Pot (A250K + integrated DPDT phase switch) ──
      {
        id: 'pot_vol',
        type: 'pot_pushpull',
        label: 'Volume Push-Pull (A250K + Phase DPDT)',
        value: { resistance_kohms: 250, taper: 'audio', position: 1 },
        x: 260,
        y: 60,
        width: 95,
        height: 150,
      },
      // ── 4-Way Switch (Oak Grigsby, neck-first order) ──
      {
        id: 'sw_4way',
        type: 'switch_4way',
        label: 'Oak Grigsby 4-Way (Neck-First)',
        x: 410,
        y: 60,
        width: 170,
        height: 90,
      },
      // ── Concentric Pot: Outer = Tone (B500K), Inner = Blend (B500K) ──
      {
        id: 'pot_conc',
        type: 'pot_concentric',
        label: 'Concentric Tone (outer) / Blend (inner)',
        value: { resistance_kohms: 500, taper: 'linear', position: 1 },
        x: 410,
        y: 190,
        width: 100,
        height: 120,
      },
      // ── 470pF Treble Bleed Cap (across volume pot) ──
      {
        id: 'cap_tbleed',
        type: 'capacitor',
        label: '470pF Treble Bleed',
        value: { capacitance_pf: 470 },
        x: 260,
        y: 240,
        width: 80,
        height: 44,
      },
      // ── 470kΩ Resistor (bridges tone pot outer lugs 1-3) ──
      {
        id: 'res_tone_tame',
        type: 'resistor',
        label: '470kΩ Tone Taming Resistor',
        value: { resistance_ohms: 470000 },
        x: 560,
        y: 190,
        width: 90,
        height: 38,
      },
      // ── 0.022µF Tone Cap ──
      {
        id: 'cap_tone',
        type: 'capacitor',
        label: '0.022µF Tone Cap',
        value: { capacitance_pf: 22000 },
        x: 560,
        y: 250,
        width: 80,
        height: 44,
      },
      // ── Output Jack ──
      {
        id: 'jack_out',
        type: 'output_jack',
        label: 'Switchcraft 1/4" Output Jack',
        x: 660,
        y: 100,
        width: 80,
        height: 80,
      },
      // ── Info Card ──
      {
        id: 'card_info',
        type: 'project_card',
        label: 'Custom Tele Wiring Specs',
        textValue:
          'Mahogany body · Roasted maple neck · Rosewood fretboard\nPhase-reversal push-pull vol · 4-way neck-first · Concentric tone+blend half-blender',
        authorValue: 'Cords Box Lab',
        modelValue: 'Custom Tele',
        revisionValue: 'v1.0',
        x: 260,
        y: 320,
        width: 380,
        height: 100,
      },
    ],
    edges: [
      // ═══ PHASE REVERSAL SWITCH (push-pull DPDT on volume pot) ═══
      // Neck pickup HOT → DPDT pole A common (swA2)
      makeEdge('ph1', 'pickup_neck_hot', 'pot_vol_swA2', '#ffffff'),
      // Neck pickup GND → DPDT pole B common (swB2)
      makeEdge('ph2', 'pickup_neck_ground', 'pot_vol_swB2', '#000000'),
      // Normal (pushed, pos1): swA2→swA1, swB2→swB1 (straight through)
      //   swA1 = neck hot out (normal)
      //   swB1 = neck gnd out (normal)
      // Phase-reversed wiring: cross-connect A and B outputs
      //   swA3 connects to where swB1 goes (ground path)
      //   swB3 connects to where swA1 goes (hot path)
      // This creates the crossover when pulled (pos2): swA2→swA3→gnd, swB2→swB3→hot
      makeEdge('ph_x1', 'pot_vol_swA3', 'pot_vol_swB1', '#a855f7'),
      makeEdge('ph_x2', 'pot_vol_swB3', 'pot_vol_swA1', '#a855f7'),

      // ═══ PROCESSED NECK SIGNAL → 4-WAY SWITCH ═══
      // Processed Neck Hot (swA1) connects to Pole A pos 1 (Neck), pos 2 (Parallel), pos 4 (Series)
      makeEdge('n2sw_p1', 'pot_vol_swA1', 'sw_4way_poleA_pos1', '#ffffff'),
      makeEdge('n2sw_p2', 'pot_vol_swA1', 'sw_4way_poleA_pos2', '#ffffff'),
      makeEdge('n2sw_p4', 'pot_vol_swA1', 'sw_4way_poleA_pos4', '#ffffff'),

      // Processed Neck Ground (swB1) connects to 4-way Pole B Common (routed to Ground in 1..3, Bridge Hot in 4)
      makeEdge('ngnd2sw', 'pot_vol_swB1', 'sw_4way_poleB_common', '#000000'),

      // Pole B pos 1, 2, 3 → Main Ground
      makeEdge('sw_b1_gnd', 'sw_4way_poleB_pos1', 'jack_out_sleeve', '#000000'),
      makeEdge('sw_b2_gnd', 'sw_4way_poleB_pos2', 'jack_out_sleeve', '#000000'),
      makeEdge('sw_b3_gnd', 'sw_4way_poleB_pos3', 'jack_out_sleeve', '#000000'),

      // ═══ BRIDGE PICKUP → 4-WAY SWITCH ═══
      // Bridge Hot (pickup_bridge_hot) connects to Pole A pos 2 (Parallel), pos 3 (Bridge), Pole B pos 4 (Series link)
      makeEdge('b2sw_p2', 'pickup_bridge_hot', 'sw_4way_poleA_pos2', '#ff8c00'),
      makeEdge('b2sw_p3', 'pickup_bridge_hot', 'sw_4way_poleA_pos3', '#ff8c00'),
      makeEdge('b2sw_p4', 'pickup_bridge_hot', 'sw_4way_poleB_pos4', '#ff8c00'),

      // Bridge Ground → Main Ground (always stable & unswitched)
      makeEdge('bgnd', 'pickup_bridge_ground', 'jack_out_sleeve', '#000000'),

      // ═══ 4-WAY COMMONS → VOLUME POT ═══
      // Pole A common feeds volume pot input (lug3)
      makeEdge('sw2v1', 'sw_4way_poleA_common', 'pot_vol_lug3', '#ffffff'),

      // ═══ VOLUME POT ═══
      // Lug3 (input) → Wiper (output)
      makeEdge('v_int', 'pot_vol_lug3', 'pot_vol_wiper', '#ffffff'),
      // Wiper → Output Jack tip (main signal out)
      makeEdge('v2j', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),
      // Lug1 (CCW end) → Ground
      makeEdge('v_gnd', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),

      // ═══ 470pF TREBLE BLEED (cap-only, across vol pot wiper ↔ lug3) ═══
      makeEdge('tb1', 'pot_vol_wiper', 'cap_tbleed_lead1', '#38bdf8'),
      makeEdge('tb2', 'cap_tbleed_lead2', 'pot_vol_lug3', '#38bdf8'),

      // ═══ BLEND POT (inner half of concentric) ═══
      // Half-blender: input from processed neck (swA1), output to 4-way common
      // Inner lug3 ← processed neck hot (post-phase-switch)
      makeEdge('bl_in', 'pot_vol_swA1', 'pot_conc_inner_lug3', '#d946ef'),
      // Inner wiper → Pole A common on 4-way (mixes into selected output)
      makeEdge('bl_out', 'pot_conc_inner_wiper', 'sw_4way_poleA_common', '#d946ef'),
      // Inner lug1 → open (no connection needed for blend-to-zero)

      // ═══ TONE POT (outer half of concentric) ═══
      // Outer lug3 ← signal from volume pot wiper
      makeEdge('tn_in', 'pot_vol_wiper', 'pot_conc_outer_lug3', '#ea580c'),
      // 470kΩ resistor bridges outer lug1 ↔ lug3 (tames 500K down to ~242K effective)
      makeEdge('tn_r1', 'pot_conc_outer_lug1', 'res_tone_tame_lead1', '#a855f7'),
      makeEdge('tn_r2', 'res_tone_tame_lead2', 'pot_conc_outer_lug3', '#a855f7'),
      // 0.022µF tone cap: outer wiper → ground (RC filter)
      makeEdge('tn_c1', 'pot_conc_outer_wiper', 'cap_tone_lead1', '#ea580c'),
      makeEdge('tn_c2', 'cap_tone_lead2', 'jack_out_sleeve', '#000000'),
      // Outer lug1 → ground
      makeEdge('tn_gnd', 'pot_conc_outer_lug1', 'jack_out_sleeve', '#000000'),
    ],
  },
  {
    id: 'les_paul_hh',
    name: 'Gibson Les Paul Standard (HH Dual Vol/Tone + 3-Way)',
    description:
      'Classic 2-Humbucker 50s Les Paul wiring: 2 Volume Pots (A500K), 2 Tone Pots (B500K), 3-Way Toggle & twin .022µF Tone Caps.',
    components: [
      {
        id: 'pickup_neck',
        type: 'pickup_humbucker',
        label: 'Neck Humbucker (57 Classic 7.8k)',
        x: 60,
        y: 60,
        width: 160,
        height: 75,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_humbucker',
        label: 'Bridge Humbucker (BurstBucker 8.4k)',
        x: 60,
        y: 220,
        width: 160,
        height: 75,
      },
      {
        id: 'switch_3way_lp',
        type: 'switch_3way',
        label: '3-Way Toggle Switch',
        x: 280,
        y: 140,
        width: 100,
        height: 95,
      },
      {
        id: 'pot_vol_neck',
        type: 'pot_volume',
        label: 'Neck Volume (A500K)',
        value: { resistance_kohms: 500, taper: 'audio', position: 1 },
        x: 440,
        y: 60,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_tone_neck',
        type: 'pot_tone',
        label: 'Neck Tone (B500K)',
        value: { resistance_kohms: 500, taper: 'linear', position: 1 },
        x: 570,
        y: 60,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_vol_bridge',
        type: 'pot_volume',
        label: 'Bridge Volume (A500K)',
        value: { resistance_kohms: 500, taper: 'audio', position: 1 },
        x: 440,
        y: 220,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_tone_bridge',
        type: 'pot_tone',
        label: 'Bridge Tone (B500K)',
        value: { resistance_kohms: 500, taper: 'linear', position: 1 },
        x: 570,
        y: 220,
        width: 90,
        height: 100,
      },
      {
        id: 'cap_tone_neck',
        type: 'capacitor',
        label: '.022µF Neck Cap',
        value: { capacitance_pf: 22000 },
        x: 680,
        y: 60,
        width: 80,
        height: 44,
      },
      {
        id: 'cap_tone_bridge',
        type: 'capacitor',
        label: '.022µF Bridge Cap',
        value: { capacitance_pf: 22000 },
        x: 680,
        y: 220,
        width: 80,
        height: 44,
      },
      {
        id: 'jack_out',
        type: 'output_jack',
        label: '1/4" Output Jack',
        x: 780,
        y: 140,
        width: 80,
        height: 80,
      },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_north_start', 'pot_vol_neck_lug3', '#ffffff'),
      makeEdge('e2', 'pickup_bridge_north_start', 'pot_vol_bridge_lug3', '#ff8c00'),
      makeEdge('e3', 'pot_vol_neck_wiper', 'switch_3way_lp_pos1', '#ffffff'),
      makeEdge('e4', 'pot_vol_bridge_wiper', 'switch_3way_lp_pos3', '#ff8c00'),
      makeEdge('e5', 'switch_3way_lp_common', 'jack_out_tip', '#eab308'),
      makeEdge('e6', 'pot_vol_neck_lug3', 'pot_tone_neck_lug3', '#38bdf8'),
      makeEdge('e7', 'pot_tone_neck_wiper', 'cap_tone_neck_lead1', '#ea580c'),
      makeEdge('e8', 'cap_tone_neck_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e9', 'pot_vol_bridge_lug3', 'pot_tone_bridge_lug3', '#38bdf8'),
      makeEdge('e10', 'pot_tone_bridge_wiper', 'cap_tone_bridge_lead1', '#ea580c'),
      makeEdge('e11', 'cap_tone_bridge_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e12', 'pot_vol_neck_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e13', 'pot_vol_bridge_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e14', 'pickup_neck_south_start', 'jack_out_sleeve', '#000000'),
      makeEdge('e15', 'pickup_bridge_south_start', 'jack_out_sleeve', '#000000'),
      // As in the Tele/Strat harnesses, expose the volume pot's signal path
      // to the connectivity solver. The WDF stage models its loaded taper.
      makeEdge('e16', 'pot_vol_neck_lug3', 'pot_vol_neck_wiper', '#ffffff'),
      makeEdge('e17', 'pot_vol_bridge_lug3', 'pot_vol_bridge_wiper', '#ff8c00'),
    ],
  },
  {
    id: 'strat_sss',
    name: 'Fender Stratocaster Vintage SSS (5-Way Blade)',
    description:
      'Classic 3 Single-Coil Fender Stratocaster: 3 Vintage Single Coils, Oak Grigsby 5-Way Blade Switch, Master Volume, Tone 1 (Neck/Middle), Tone 2 (Bridge).',
    components: [
      {
        id: 'pickup_neck',
        type: 'pickup_single_coil',
        label: 'Neck Pickup (Strat 57/62)',
        x: 60,
        y: 60,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_middle',
        type: 'pickup_single_coil',
        label: 'Middle Pickup (RWRP Strat)',
        x: 60,
        y: 150,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_single_coil',
        label: 'Bridge Pickup (Custom Shop 69)',
        x: 60,
        y: 240,
        width: 140,
        height: 60,
      },
      {
        id: 'switch_5way_strat',
        type: 'switch_5way',
        label: '5-Way Blade Switch',
        x: 260,
        y: 140,
        width: 170,
        height: 90,
      },
      {
        id: 'pot_vol',
        type: 'pot_volume',
        label: 'Master Volume (A250K)',
        value: { resistance_kohms: 250, taper: 'audio', position: 1 },
        x: 470,
        y: 60,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_tone',
        type: 'pot_tone',
        label: 'Master Tone (B250K)',
        value: { resistance_kohms: 250, taper: 'linear', position: 1 },
        x: 470,
        y: 200,
        width: 90,
        height: 100,
      },
      {
        id: 'cap_tone',
        type: 'capacitor',
        label: '.047µF Cap',
        value: { capacitance_pf: 47000 },
        x: 610,
        y: 200,
        width: 80,
        height: 44,
      },
      {
        id: 'jack_out',
        type: 'output_jack',
        label: '1/4" Output Jack',
        x: 610,
        y: 60,
        width: 80,
        height: 80,
      },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_hot', 'switch_5way_strat_poleA_pos1', '#ffffff'),
      makeEdge('e2', 'pickup_middle_hot', 'switch_5way_strat_poleA_pos2', '#38bdf8'),
      makeEdge('e3', 'pickup_bridge_hot', 'switch_5way_strat_poleA_pos3', '#ff8c00'),
      makeEdge('e4', 'switch_5way_strat_poleA_common', 'pot_vol_lug3', '#ffffff'),
      makeEdge('e5', 'pot_vol_lug3', 'pot_vol_wiper', '#ffffff'),
      makeEdge('e6', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),
      makeEdge('e7', 'pot_vol_lug3', 'pot_tone_lug3', '#38bdf8'),
      makeEdge('e8', 'pot_tone_wiper', 'cap_tone_lead1', '#ea580c'),
      makeEdge('e9', 'cap_tone_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e10', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e11', 'pickup_neck_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e12', 'pickup_middle_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e13', 'pickup_bridge_ground', 'jack_out_sleeve', '#000000'),
    ],
  },
  {
    id: 'std_tele',
    name: 'Standard Telecaster (3-Way)',
    description:
      'Vintage 2 Single-Coil Telecaster wiring with 3-Way Blade Switch, 250K Vol, 250K Tone & .047µF Cap.',
    components: [
      {
        id: 'pickup_neck',
        type: 'pickup_single_coil',
        label: 'Neck Pickup (Tele Chrome Cover)',
        x: 80,
        y: 100,
        width: 140,
        height: 60,
      },
      {
        id: 'pickup_bridge',
        type: 'pickup_single_coil',
        label: 'Bridge Pickup (Tele Twang 8.2k)',
        x: 80,
        y: 220,
        width: 140,
        height: 60,
      },
      {
        id: 'switch_3way_tele',
        type: 'switch_3way',
        label: '3-Way Toggle',
        x: 280,
        y: 140,
        width: 100,
        height: 95,
      },
      {
        id: 'pot_vol',
        type: 'pot_volume',
        label: 'Volume Pot',
        x: 450,
        y: 100,
        width: 90,
        height: 100,
      },
      {
        id: 'pot_tone',
        type: 'pot_tone',
        label: 'Tone Pot',
        x: 450,
        y: 240,
        width: 90,
        height: 100,
      },
      {
        id: 'cap_tone',
        type: 'capacitor',
        label: '.047µF Cap',
        x: 600,
        y: 240,
        width: 80,
        height: 44,
      },
      {
        id: 'jack_out',
        type: 'output_jack',
        label: '1/4" Jack',
        x: 600,
        y: 100,
        width: 80,
        height: 80,
      },
    ],
    edges: [
      makeEdge('e1', 'pickup_neck_hot', 'switch_3way_tele_pos1', '#ffffff'),
      makeEdge('e2', 'pickup_bridge_hot', 'switch_3way_tele_pos3', '#ff8c00'),
      makeEdge('e3', 'switch_3way_tele_common', 'pot_vol_lug3', '#ffffff'),
      makeEdge('e4', 'pot_vol_lug3', 'pot_vol_wiper', '#ffffff'),
      makeEdge('e5', 'pot_vol_wiper', 'jack_out_tip', '#eab308'),
      makeEdge('e6', 'pot_vol_lug3', 'pot_tone_lug3', '#38bdf8'),
      makeEdge('e7', 'pot_tone_wiper', 'cap_tone_lead1', '#ea580c'),
      makeEdge('e8', 'cap_tone_lead2', 'jack_out_sleeve', '#000000'),
      makeEdge('e9', 'pot_vol_lug1', 'jack_out_sleeve', '#000000'),
      makeEdge('e10', 'pickup_neck_ground', 'jack_out_sleeve', '#000000'),
      makeEdge('e11', 'pickup_bridge_ground', 'jack_out_sleeve', '#000000'),
    ],
  },
];

/**
 * Load a Preset Definition into both CanvasStore and CircuitStore.
 */
export function loadPreset(preset: PresetDefinition): void {
  // 1. Reset state
  useCanvasStore.getState().resetCanvas();
  useCircuitStore.getState().reset();

  const circuitStore = useCircuitStore.getState();
  const graph = circuitStore.graph;

  const newInstances: CanvasComponentInstance[] = [];

  // 2. Prepare Instances & Graph Components + Nodes
  for (const comp of preset.components) {
    newInstances.push({
      id: comp.id,
      type: comp.type,
      label: comp.label,
      x: comp.x,
      y: comp.y,
      width: comp.width,
      height: comp.height,
      value: comp.value,
      textValue: comp.textValue,
      authorValue: comp.authorValue,
      modelValue: comp.modelValue,
      revisionValue: comp.revisionValue,
    });

    graph.addComponent({
      id: comp.id,
      type: comp.type,
      label: comp.label,
      value: comp.value,
    });

    const shape = getShape(comp.type);
    if (shape && shape.lugs) {
      for (const lug of shape.lugs) {
        const nodeId = `${comp.id}${lug.id}`;
        const isJack = comp.type === 'output_jack';
        const isHot = lug.role === 'hot' || lug.role === 'common' || lug.role === 'output';

        const nodeRole = isJack && lug.role === 'output' ? 'tip' : lug.role;

        const node: CircuitNode = {
          id: nodeId,
          type: isJack ? 'jack_terminal' : lug.role === 'ground' ? 'ground' : 'terminal',
          componentId: comp.id,
          role: nodeRole,
          signalState: isHot ? 'active' : 'inactive',
        };

        try {
          graph.addNode(node);
        } catch {
          // Node already exists
        }
      }
    }

    // Initialize default switch state for switch components
    if (comp.type.startsWith('switch_') || comp.type === 'pot_pushpull') {
      const totalPos =
        comp.type === 'switch_3way'
          ? 3
          : comp.type === 'switch_4way'
            ? 4
            : comp.type === 'switch_5way'
              ? 5
              : 2;
      graph.setSwitchState({
        componentId: comp.id,
        currentPosition: 1,
        totalPositions: totalPos,
        poles:
          comp.type === 'switch_dpdt' || comp.type === 'pot_pushpull'
            ? 2
            : comp.type === 'switch_3way'
              ? 1
              : 2,
      });
    }
  }

  // Batch set instances to CanvasStore
  useCanvasStore.setState({ instances: newInstances });

  // 3. Add Wire Edges
  for (const edge of preset.edges) {
    try {
      graph.addEdge(edge);
    } catch {
      // Edge already exists
    }
  }

  // 4. Solve signal paths & sync state
  circuitStore.solve();
  useCanvasStore.getState().pushHistory();
}

/**
 * Load a preset by ID
 */
export function loadPresetById(presetId: string): boolean {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (preset) {
    loadPreset(preset);
    return true;
  }
  return false;
}
