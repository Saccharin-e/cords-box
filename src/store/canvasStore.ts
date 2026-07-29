/**
 * Canvas Store (Zustand)
 *
 * Manages view-level state for the dual canvas:
 * component positions, zoom, pan, selection, and wiring mode.
 * Separated from circuitStore to keep graph logic pure.
 */

import { create } from 'zustand';
import type { ComponentType } from '@graph/types';

export interface CanvasComponentInstance {
  id: string;           // matches Component.id in circuitStore
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WireAnchor {
  componentId: string;
  lugId: string;       // node id in graph
  x: number;
  y: number;
}

export interface PendingWire {
  from: WireAnchor;
  toX: number;         // current cursor position during draw
  toY: number;
}

export interface CanvasStore {
  // Components placed on canvas
  instances: CanvasComponentInstance[];
  // Zoom & pan
  scale: number;
  panX: number;
  panY: number;
  // Selection
  selectedId: string | null;
  // Wiring mode
  wiringMode: boolean;
  pendingWire: PendingWire | null;
  // View mode
  viewMode: 'physical' | 'schematic';

  // Actions
  addInstance: (inst: CanvasComponentInstance) => void;
  moveInstance: (id: string, x: number, y: number) => void;
  removeInstance: (id: string) => void;
  selectInstance: (id: string | null) => void;
  setViewMode: (mode: 'physical' | 'schematic') => void;
  setScale: (scale: number) => void;
  setPan: (x: number, y: number) => void;
  startWiring: (anchor: WireAnchor) => void;
  updateWiringCursor: (x: number, y: number) => void;
  cancelWiring: () => void;
  completeWiring: (to: WireAnchor) => void;
  resetCanvas: () => void;
}

export const useCanvasStore = create<CanvasStore>((set) => ({
  instances: [],
  scale: 1,
  panX: 0,
  panY: 0,
  selectedId: null,
  wiringMode: false,
  pendingWire: null,
  viewMode: 'physical',

  addInstance: (inst) =>
    set((s) => ({ instances: [...s.instances, inst] })),

  moveInstance: (id, x, y) =>
    set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, x, y } : i)),
    })),

  removeInstance: (id) =>
    set((s) => ({ instances: s.instances.filter((i) => i.id !== id) })),

  selectInstance: (id) => set({ selectedId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),

  setScale: (scale) => set({ scale: Math.min(3, Math.max(0.25, scale)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  startWiring: (anchor) =>
    set({ wiringMode: true, pendingWire: { from: anchor, toX: anchor.x, toY: anchor.y } }),

  updateWiringCursor: (x, y) =>
    set((s) =>
      s.pendingWire ? { pendingWire: { ...s.pendingWire, toX: x, toY: y } } : {},
    ),

  cancelWiring: () => set({ wiringMode: false, pendingWire: null }),

  completeWiring: (_to) => set({ wiringMode: false, pendingWire: null }),

  resetCanvas: () =>
    set({
      instances: [],
      scale: 1,
      panX: 0,
      panY: 0,
      selectedId: null,
      wiringMode: false,
      pendingWire: null,
    }),
}));
