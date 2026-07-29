/**
 * Circuit Graph Type Definitions
 *
 * Zod-validated schemas and inferred TypeScript types for the circuit graph
 * data model. Designed for extensibility via the `instrument_family` tag
 * to support bass, mandolin, etc. in future versions (NFR-1).
 */

import { z } from 'zod/v4';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const InstrumentFamily = z.enum(['Guitar', 'Bass', 'Mandolin', 'Ukulele', 'Other']);
export type InstrumentFamily = z.infer<typeof InstrumentFamily>;

export const NodeType = z.enum([
  'terminal',
  'switch_lug',
  'potentiometer_lug',
  'capacitor_lead',
  'resistor_lead',
  'jack_terminal',
  'ground',
  'junction',
]);
export type NodeType = z.infer<typeof NodeType>;

export const ComponentType = z.enum([
  'pickup_single_coil',
  'pickup_humbucker',
  'switch_3way',
  'switch_4way',
  'switch_5way',
  'switch_dpdt',
  'pot_volume',
  'pot_tone',
  'pot_blend',
  'pot_concentric',
  'capacitor',
  'resistor',
  'output_jack',
]);
export type ComponentType = z.infer<typeof ComponentType>;

export const PotTaper = z.enum(['linear', 'audio', 'reverse_audio']);
export type PotTaper = z.infer<typeof PotTaper>;

export const WireType = z.enum(['vintage_cloth_pushback', 'modern_vinyl', 'shielded', 'bare']);
export type WireType = z.infer<typeof WireType>;

export const ConnectionType = z.enum(['solder', 'quick_connect', 'crimp', 'twist']);
export type ConnectionType = z.infer<typeof ConnectionType>;

export const SignalState = z.enum(['active', 'inactive', 'grounded']);
export type SignalState = z.infer<typeof SignalState>;

// ─── Component Value Schemas ─────────────────────────────────────────────────

export const CapacitorValue = z.object({
  capacitance_pf: z.number().positive(),
  voltage_rating: z.number().positive().optional(),
});
export type CapacitorValue = z.infer<typeof CapacitorValue>;

export const ResistorValue = z.object({
  resistance_ohms: z.number().nonnegative(),
});
export type ResistorValue = z.infer<typeof ResistorValue>;

export const PotentiometerValue = z.object({
  resistance_kohms: z.number().positive(),
  taper: PotTaper,
  position: z.number().min(0).max(1), // 0 = fully CCW, 1 = fully CW
});
export type PotentiometerValue = z.infer<typeof PotentiometerValue>;

// ─── Node Schema ─────────────────────────────────────────────────────────────

export const CircuitNode = z.object({
  id: z.string().min(1),
  type: NodeType,
  componentId: z.string().min(1),
  role: z.string().optional(),
  signalState: SignalState.default('inactive'),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type CircuitNode = z.infer<typeof CircuitNode>;

// ─── Edge Schema ─────────────────────────────────────────────────────────────

export const CircuitEdge = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  resistance: z.number().nonnegative().default(0),
  wireColor: z.string().default('#888888'),
  connectionType: ConnectionType.default('solder'),
  wireType: WireType.default('modern_vinyl'),
  wireGauge: z.number().positive().optional(),
  controlPoint: z.object({ x: z.number(), y: z.number() }).optional(),
  controlPoints: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
});
export type CircuitEdge = z.infer<typeof CircuitEdge>;

// ─── Component Schema ────────────────────────────────────────────────────────

export const Component = z.object({
  id: z.string().min(1),
  type: ComponentType,
  label: z.string(),
  value: z.union([CapacitorValue, ResistorValue, PotentiometerValue]).optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type Component = z.infer<typeof Component>;

// ─── Switch State ────────────────────────────────────────────────────────────

export const SwitchState = z.object({
  componentId: z.string().min(1),
  currentPosition: z.number().int().nonnegative(),
  totalPositions: z.number().int().positive(),
  poles: z.number().int().positive(),
});
export type SwitchState = z.infer<typeof SwitchState>;

// ─── Circuit Graph (Root) ────────────────────────────────────────────────────

export const CircuitGraph = z.object({
  instrument_family: InstrumentFamily,
  nodes: z.array(CircuitNode),
  edges: z.array(CircuitEdge),
  components: z.array(Component),
  switchStates: z.array(SwitchState).default([]),
});
export type CircuitGraph = z.infer<typeof CircuitGraph>;

// ─── Factory Helpers ─────────────────────────────────────────────────────────

export function createEmptyGraph(family: InstrumentFamily = 'Guitar'): CircuitGraph {
  return {
    instrument_family: family,
    nodes: [],
    edges: [],
    components: [],
    switchStates: [],
  };
}

let nodeCounter = 0;
let edgeCounter = 0;
let componentCounter = 0;

export function generateNodeId(): string {
  return `node_${++nodeCounter}`;
}

export function generateEdgeId(): string {
  return `edge_${++edgeCounter}`;
}

export function generateComponentId(): string {
  return `comp_${++componentCounter}`;
}

/** Reset ID counters (useful for testing) */
export function resetIdCounters(): void {
  nodeCounter = 0;
  edgeCounter = 0;
  componentCounter = 0;
}
