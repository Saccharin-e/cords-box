/**
 * Canvas Store (Zustand)
 *
 * Manages view-level state for the dual canvas:
 * - Theme modes (Dark, Light, Blueprint, Vintage Paper)
 * - Grid styles (Dots, Grid lines, Crosshatch, Isometric, None)
 * - Snap-to-grid toggle & grid size settings
 * - Editing operations: Multi-selection, Copy/Paste, Rotate, Flip, Group/Ungroup, Undo/Redo
 */

import { create } from 'zustand';
import type { ComponentType } from '@graph/types';

export type CanvasTheme = 'dark' | 'light' | 'blueprint' | 'vintage';
export type GridStyle = 'dots' | 'lines' | 'crosshatch' | 'isometric' | 'none';

export interface CanvasComponentInstance {
  id: string;
  type: ComponentType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;  // 0, 90, 180, 270 degrees
  flippedH?: boolean;
  flippedV?: boolean;
  groupId?: string;
}

export interface WireAnchor {
  componentId: string;
  lugId: string;
  x: number;
  y: number;
}

export interface PendingWire {
  from: WireAnchor;
  toX: number;
  toY: number;
}

export interface CanvasStore {
  instances: CanvasComponentInstance[];
  scale: number;
  panX: number;
  panY: number;
  selectedId: string | null;
  selectedIds: string[];
  wiringMode: boolean;
  pendingWire: PendingWire | null;
  viewMode: 'physical' | 'schematic';

  // Display & Grid Options
  themeMode: CanvasTheme;
  gridStyle: GridStyle;
  gridSize: number;
  snapToGrid: boolean;

  // History & Clipboard
  history: CanvasComponentInstance[][];
  historyIndex: number;
  clipboard: CanvasComponentInstance[] | null;

  // Actions
  addInstance: (inst: CanvasComponentInstance) => void;
  moveInstance: (id: string, x: number, y: number) => void;
  moveInstances: (deltas: { id: string; x: number; y: number }[]) => void;
  removeInstance: (id: string) => void;
  removeSelected: () => void;
  selectInstance: (id: string | null, multi?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setViewMode: (mode: 'physical' | 'schematic') => void;
  setScale: (scale: number) => void;
  setPan: (x: number, y: number) => void;
  startWiring: (anchor: WireAnchor) => void;
  updateWiringCursor: (x: number, y: number) => void;
  cancelWiring: () => void;
  completeWiring: (to: WireAnchor) => void;

  // Display Settings Mutators
  setThemeMode: (theme: CanvasTheme) => void;
  setGridStyle: (style: GridStyle) => void;
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;

  // Transform Actions
  rotateSelected: (angleDelta?: number) => void;
  flipSelectedH: () => void;
  flipSelectedV: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  nudgeSelected: (dx: number, dy: number) => void;

  // Clipboard Actions
  copySelected: () => void;
  pasteSelected: () => void;
  duplicateSelected: () => void;

  // History Actions
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  resetCanvas: () => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  instances: [],
  scale: 1,
  panX: 0,
  panY: 0,
  selectedId: null,
  selectedIds: [],
  wiringMode: false,
  pendingWire: null,
  viewMode: 'physical',

  themeMode: 'dark',
  gridStyle: 'dots',
  gridSize: 20,
  snapToGrid: true,

  history: [[]],
  historyIndex: 0,
  clipboard: null,

  pushHistory: () => {
    const { instances, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(instances)));
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  addInstance: (inst) => {
    set((s) => ({
      instances: [...s.instances, inst],
      selectedId: inst.id,
      selectedIds: [inst.id],
    }));
    get().pushHistory();
  },

  moveInstance: (id, x, y) => {
    const { snapToGrid, gridSize } = get();
    const finalX = snapToGrid ? Math.round(x / gridSize) * gridSize : x;
    const finalY = snapToGrid ? Math.round(y / gridSize) * gridSize : y;

    set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, x: finalX, y: finalY } : i)),
    }));
    get().pushHistory();
  },

  moveInstances: (deltas) => {
    const { snapToGrid, gridSize } = get();
    const deltaMap = new Map(deltas.map((d) => [d.id, d]));
    set((s) => ({
      instances: s.instances.map((i) => {
        const d = deltaMap.get(i.id);
        if (!d) return i;
        const nx = snapToGrid ? Math.round(d.x / gridSize) * gridSize : d.x;
        const ny = snapToGrid ? Math.round(d.y / gridSize) * gridSize : d.y;
        return { ...i, x: nx, y: ny };
      }),
    }));
    get().pushHistory();
  },

  removeInstance: (id) => {
    set((s) => ({
      instances: s.instances.filter((i) => i.id !== id),
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    }));
    get().pushHistory();
  },

  removeSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.filter((i) => !selectedIds.includes(i.id)),
      selectedId: null,
      selectedIds: [],
    }));
    get().pushHistory();
  },

  selectInstance: (id, multi = false) => {
    if (!id) {
      set({ selectedId: null, selectedIds: [] });
      return;
    }
    set((s) => {
      if (multi) {
        const exists = s.selectedIds.includes(id);
        const newIds = exists
          ? s.selectedIds.filter((sid) => sid !== id)
          : [...s.selectedIds, id];
        return { selectedIds: newIds, selectedId: newIds[newIds.length - 1] ?? null };
      }
      return { selectedId: id, selectedIds: [id] };
    });
  },

  selectAll: () => {
    const { instances } = get();
    const allIds = instances.map((i) => i.id);
    set({ selectedIds: allIds, selectedId: allIds[0] ?? null });
  },

  clearSelection: () => set({ selectedId: null, selectedIds: [] }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setScale: (scale) => set({ scale: Math.min(3, Math.max(0.25, scale)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  startWiring: (anchor) =>
    set({ wiringMode: true, pendingWire: { from: anchor, toX: anchor.x, toY: anchor.y } }),
  updateWiringCursor: (x, y) =>
    set((s) => (s.pendingWire ? { pendingWire: { ...s.pendingWire, toX: x, toY: y } } : {})),
  cancelWiring: () => set({ wiringMode: false, pendingWire: null }),
  completeWiring: (_to) => set({ wiringMode: false, pendingWire: null }),

  setThemeMode: (themeMode) => set({ themeMode }),
  setGridStyle: (gridStyle) => set({ gridStyle }),
  setGridSize: (gridSize) => set({ gridSize }),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  rotateSelected: (angleDelta = 90) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id)
          ? { ...i, rotation: ((i.rotation ?? 0) + angleDelta) % 360 }
          : i,
      ),
    }));
    get().pushHistory();
  },

  flipSelectedH: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, flippedH: !i.flippedH } : i,
      ),
    }));
    get().pushHistory();
  },

  flipSelectedV: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, flippedV: !i.flippedV } : i,
      ),
    }));
    get().pushHistory();
  },

  groupSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length < 2) return;
    const groupId = `group_${Date.now()}`;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, groupId } : i,
      ),
    }));
    get().pushHistory();
  },

  ungroupSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, groupId: undefined } : i,
      ),
    }));
    get().pushHistory();
  },

  nudgeSelected: (dx, dy) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i,
      ),
    }));
    get().pushHistory();
  },

  copySelected: () => {
    const { instances, selectedIds } = get();
    const copied = instances.filter((i) => selectedIds.includes(i.id));
    set({ clipboard: JSON.parse(JSON.stringify(copied)) });
  },

  pasteSelected: () => {
    const { clipboard } = get();
    if (!clipboard || clipboard.length === 0) return;
    const newInstances: CanvasComponentInstance[] = [];
    const newIds: string[] = [];

    for (const item of clipboard) {
      const newId = `${item.type}_${Math.random().toString(36).substr(2, 6)}`;
      newInstances.push({
        ...item,
        id: newId,
        x: item.x + 30,
        y: item.y + 30,
      });
      newIds.push(newId);
    }

    set((s) => ({
      instances: [...s.instances, ...newInstances],
      selectedIds: newIds,
      selectedId: newIds[0] ?? null,
    }));
    get().pushHistory();
  },

  duplicateSelected: () => {
    get().copySelected();
    get().pasteSelected();
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevInstances = JSON.parse(JSON.stringify(history[prevIndex]));
      set({ instances: prevInstances, historyIndex: prevIndex });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextInstances = JSON.parse(JSON.stringify(history[nextIndex]));
      set({ instances: nextInstances, historyIndex: nextIndex });
    }
  },

  resetCanvas: () =>
    set({
      instances: [],
      scale: 1,
      panX: 0,
      panY: 0,
      selectedId: null,
      selectedIds: [],
      wiringMode: false,
      pendingWire: null,
      history: [[]],
      historyIndex: 0,
      clipboard: null,
    }),
}));
