/**
 * Canvas Store (Zustand)
 *
 * Manages view-level state for the dual canvas:
 * - Retractable panels (Toolbar, Sidebar Library, Value Inspector, CAD Floating Bar)
 * - Theme modes (Dark, Light, Blueprint, Vintage Paper)
 * - Grid styles (Dots, Grid lines, Crosshatch, Isometric, None)
 * - Snap-to-grid toggle & grid size settings
 * - Editing operations: Multi-selection, Copy/Paste, Rotate, Flip, Group/Ungroup, Undo/Redo
 */

import { create } from 'zustand';
import { Graph } from '@graph/Graph';
import type { CircuitGraph, ComponentType } from '@graph/types';
import { useCircuitStore } from './circuitStore';

export interface HistorySnapshot {
  instances: CanvasComponentInstance[];
  graphData: CircuitGraph | null;
}

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
  rotation?: number; // 0, 90, 180, 270 degrees
  flippedH?: boolean;
  flippedV?: boolean;
  groupId?: string;
  // Customization & Editable Fields
  customLabel?: string;
  customLugLabels?: Record<string, string>;
  textValue?: string;
  authorValue?: string;
  modelValue?: string;
  revisionValue?: string;
  colorTheme?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  dashStyle?: 'solid' | 'dashed' | 'dotted';
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

export type WireColorPreset = (typeof WIRE_COLOR_PRESETS)[number];

export const WIRE_COLOR_PRESETS = [
  { id: 'black', label: 'Black', hex: '#18181b' },
  { id: 'white', label: 'White', hex: '#e4e4e7' },
  { id: 'red', label: 'Red', hex: '#dc2626' },
  { id: 'green', label: 'Green', hex: '#16a34a' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'orange', label: 'Orange', hex: '#d97706' },
  { id: 'brown', label: 'Brown', hex: '#78350f' },
  { id: 'purple', label: 'Purple', hex: '#7c3aed' },
  { id: 'bare', label: 'Bare Copper', hex: '#b45309' },
] as const;

export type WireDrawType = 'vintage_cloth_pushback' | 'modern_vinyl' | 'shielded' | 'bare';

export interface WireDrawOptions {
  color: string;
  wireType: WireDrawType;
  connectionType: 'solder' | 'quick_connect' | 'crimp' | 'twist';
}

export interface ExportBox {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  aspectRatio: 'auto' | '1:1' | '16:9' | '4:3' | 'a4';
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
  wireDrawOptions: WireDrawOptions;
  viewMode: 'physical' | 'schematic';

  // Export Settings
  exportBox: ExportBox;
  showExportBox: boolean;
  isExportModalOpen: boolean;
  setExportBox: (box: Partial<ExportBox>) => void;
  toggleShowExportBox: () => void;
  toggleExportModal: () => void;
  recalculateAutoExportBox: () => void;

  // Retractable Panel Layout State
  isToolbarOpen: boolean;
  isSidebarOpen: boolean;
  isInspectorOpen: boolean;
  isControlsOpen: boolean;
  inspectorWidth: number;
  setInspectorWidth: (width: number) => void;

  // Display & Grid Options
  themeMode: CanvasTheme;
  gridStyle: GridStyle;
  gridSize: number;
  snapToGrid: boolean;
  showComponentLabels: boolean;
  toggleShowComponentLabels: () => void;

  // History & Clipboard
  history: HistorySnapshot[];
  historyIndex: number;
  clipboard: CanvasComponentInstance[] | null;

  // Panel Toggles
  toggleToolbar: () => void;
  toggleSidebar: () => void;
  toggleInspector: () => void;
  toggleControls: () => void;

  // Actions
  addInstance: (inst: CanvasComponentInstance) => void;
  updateInstance: (
    id: string,
    updates: Partial<CanvasComponentInstance>,
    skipHistory?: boolean,
  ) => void;
  moveInstance: (id: string, x: number, y: number) => void;
  moveInstances: (deltas: { id: string; x: number; y: number }[]) => void;
  removeInstance: (id: string) => void;
  removeSelected: () => void;
  selectInstance: (id: string | null, multi?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setViewMode: (mode: 'physical' | 'schematic') => void;
  setScale: (scale: number) => void;
  setPan: (x: number, y: number) => void;
  startWiring: (anchor: WireAnchor) => void;
  toggleWiringMode: () => void;
  updateWiringCursor: (x: number, y: number) => void;
  cancelWiring: () => void;
  completeWiring: (to: WireAnchor) => void;
  setWireDrawOptions: (opts: Partial<WireDrawOptions>) => void;

  // Layer Ordering Actions
  bringToFront: (id?: string) => void;
  sendToBack: (id?: string) => void;
  bringForward: (id?: string) => void;
  sendBackward: (id?: string) => void;

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
  wireDrawOptions: {
    color: '#d97706',
    wireType: 'modern_vinyl',
    connectionType: 'solder',
  },
  viewMode: 'physical',

  // Export Settings
  exportBox: {
    x: 40,
    y: 40,
    width: 800,
    height: 550,
    padding: 60,
    aspectRatio: 'auto',
  },
  showExportBox: false,
  isExportModalOpen: false,

  setExportBox: (box) =>
    set((s) => ({
      exportBox: { ...s.exportBox, ...box },
    })),

  toggleShowExportBox: () =>
    set((s) => ({
      showExportBox: !s.showExportBox,
    })),

  toggleExportModal: () =>
    set((s) => {
      const nextOpen = !s.isExportModalOpen;
      if (nextOpen) {
        // Automatically calculate export bounds on modal open
        s.recalculateAutoExportBox();
      }
      return {
        isExportModalOpen: nextOpen,
        showExportBox: nextOpen ? true : s.showExportBox,
      };
    }),

  recalculateAutoExportBox: () => {
    const { instances, exportBox } = get();
    const padding = exportBox.padding ?? 60;

    if (instances.length === 0) {
      set({
        exportBox: {
          ...exportBox,
          x: 40,
          y: 40,
          width: 800,
          height: 550,
        },
      });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const inst of instances) {
      // Get width and height from shape lookup or default
      const w = inst.width ?? 120;
      const h = inst.height ?? 80;
      minX = Math.min(minX, inst.x);
      minY = Math.min(minY, inst.y);
      maxX = Math.max(maxX, inst.x + w);
      maxY = Math.max(maxY, inst.y + h);
    }

    const calcX = Math.max(0, minX - padding);
    const calcY = Math.max(0, minY - padding);
    let calcWidth = maxX - minX + padding * 2;
    let calcHeight = maxY - minY + padding * 2;

    // Apply aspect ratio constraints if selected
    if (exportBox.aspectRatio === '1:1') {
      const size = Math.max(calcWidth, calcHeight);
      calcWidth = size;
      calcHeight = size;
    } else if (exportBox.aspectRatio === '16:9') {
      calcHeight = Math.round(calcWidth * (9 / 16));
    } else if (exportBox.aspectRatio === '4:3') {
      calcHeight = Math.round(calcWidth * (3 / 4));
    } else if (exportBox.aspectRatio === 'a4') {
      calcHeight = Math.round(calcWidth / 1.414);
    }

    set({
      exportBox: {
        ...exportBox,
        x: Math.round(calcX),
        y: Math.round(calcY),
        width: Math.round(calcWidth),
        height: Math.round(calcHeight),
      },
    });
  },

  // Default panels expanded
  isToolbarOpen: true,
  isSidebarOpen: true,
  isInspectorOpen: true,
  isControlsOpen: true,
  inspectorWidth: 320,
  setInspectorWidth: (width) =>
    set({ inspectorWidth: Math.max(220, Math.min(650, width)) }),

  themeMode: 'dark',
  gridStyle: 'dots',
  gridSize: 20,
  snapToGrid: true,
  showComponentLabels: false,

  toggleShowComponentLabels: () => set((s) => ({ showComponentLabels: !s.showComponentLabels })),

  history: [{ instances: [], graphData: null }],
  historyIndex: 0,
  clipboard: null,

  toggleToolbar: () => set((s) => ({ isToolbarOpen: !s.isToolbarOpen })),
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleInspector: () => set((s) => ({ isInspectorOpen: !s.isInspectorOpen })),
  toggleControls: () => set((s) => ({ isControlsOpen: !s.isControlsOpen })),

  pushHistory: () => {
    const { instances, history, historyIndex } = get();
    const graph = useCircuitStore.getState().graph;
    const graphData = graph ? graph.toJSON() : null;

    const newHistory = history.slice(0, historyIndex + 1);
    const clonedInstances =
      typeof structuredClone === 'function'
        ? structuredClone(instances)
        : JSON.parse(JSON.stringify(instances));
    const clonedGraph = graphData
      ? typeof structuredClone === 'function'
        ? structuredClone(graphData)
        : JSON.parse(JSON.stringify(graphData))
      : null;

    newHistory.push({
      instances: clonedInstances,
      graphData: clonedGraph,
    });

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

  updateInstance: (id, updates, skipHistory = false) => {
    set((s) => ({
      instances: s.instances.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
    if (!skipHistory) {
      get().pushHistory();
    }
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
    import('./circuitStore').then(({ useCircuitStore }) => {
      useCircuitStore.getState().removeComponent(id);
      get().pushHistory();
    });
  },

  removeSelected: () => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.filter((i) => !selectedIds.includes(i.id)),
      selectedId: null,
      selectedIds: [],
    }));
    import('./circuitStore').then(({ useCircuitStore }) => {
      selectedIds.forEach((id) => useCircuitStore.getState().removeComponent(id));
      get().pushHistory();
    });
  },

  selectInstance: (id, multi = false) => {
    if (!id) {
      set({ selectedId: null, selectedIds: [] });
      return;
    }
    set((s) => {
      if (multi) {
        const exists = s.selectedIds.includes(id);
        const newIds = exists ? s.selectedIds.filter((sid) => sid !== id) : [...s.selectedIds, id];
        return { selectedIds: newIds, selectedId: newIds[newIds.length - 1] ?? null };
      }
      return { selectedId: id, selectedIds: [id] };
    });
  },

  setSelectedIds: (ids) => set({ selectedIds: ids, selectedId: ids[0] ?? null }),

  selectAll: () => {
    const { instances } = get();
    const allIds = instances.map((i) => i.id);
    set({ selectedIds: allIds, selectedId: allIds[0] ?? null });
  },

  clearSelection: () => set({ selectedId: null, selectedIds: [] }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setScale: (scale) => set({ scale: Math.min(3, Math.max(0.25, scale)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  startWiring: (anchor) => {
    const { wiringMode, pendingWire } = get();
    if (!wiringMode) {
      // First click: enable wiring mode and start from this lug
      set({ wiringMode: true, pendingWire: { from: anchor, toX: anchor.x, toY: anchor.y } });
    } else if (pendingWire) {
      // Second click: complete the wire to this lug
      // Prevent self-wiring to the same lug
      if (
        pendingWire.from.componentId === anchor.componentId &&
        pendingWire.from.lugId === anchor.lugId
      ) {
        return;
      }
      // Dispatch to completeWiring
      get().completeWiring(anchor);
    } else {
      // Wiring mode active but no pending wire — start new
      set({ pendingWire: { from: anchor, toX: anchor.x, toY: anchor.y } });
    }
  },
  updateWiringCursor: (x, y) =>
    set((s) => (s.pendingWire ? { pendingWire: { ...s.pendingWire, toX: x, toY: y } } : {})),
  toggleWiringMode: () => {
    const { wiringMode } = get();
    if (wiringMode) {
      set({ wiringMode: false, pendingWire: null });
    } else {
      set({ wiringMode: true, pendingWire: null });
    }
  },
  cancelWiring: () => set({ wiringMode: false, pendingWire: null }),
  completeWiring: (to) => {
    const { pendingWire } = get();
    if (!pendingWire) {
      set({ wiringMode: false, pendingWire: null });
      return;
    }

    const sourceNodeId = pendingWire.from.componentId + pendingWire.from.lugId;
    const targetNodeId = to.componentId + to.lugId;

    // Prevent self-wiring
    if (sourceNodeId === targetNodeId) {
      set({ pendingWire: null });
      return;
    }

    const { wireDrawOptions } = get();
    const edgeId = `wire_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    useCircuitStore.getState().addEdge({
      id: edgeId,
      source: sourceNodeId,
      target: targetNodeId,
      resistance: 0,
      wireColor: wireDrawOptions.color,
      connectionType: wireDrawOptions.connectionType,
      wireType: wireDrawOptions.wireType,
    });

    // Stay in wiring mode so user can draw another wire immediately
    set({ pendingWire: null });
  },
  setWireDrawOptions: (opts) =>
    set((s) => ({ wireDrawOptions: { ...s.wireDrawOptions, ...opts } })),

  setThemeMode: (themeMode) => set({ themeMode }),
  setGridStyle: (gridStyle) => set({ gridStyle }),
  setGridSize: (gridSize) => set({ gridSize }),
  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  bringToFront: (targetId) => {
    const { selectedId, selectedIds, instances } = get();
    const idsToMove = targetId
      ? [targetId]
      : selectedIds.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
    if (!idsToMove.length) return;

    const remaining = instances.filter((i) => !idsToMove.includes(i.id));
    const moved = instances.filter((i) => idsToMove.includes(i.id));
    set({ instances: [...remaining, ...moved] });
    get().pushHistory();
  },

  sendToBack: (targetId) => {
    const { selectedId, selectedIds, instances } = get();
    const idsToMove = targetId
      ? [targetId]
      : selectedIds.length
        ? selectedIds
        : selectedId
          ? [selectedId]
          : [];
    if (!idsToMove.length) return;

    const remaining = instances.filter((i) => !idsToMove.includes(i.id));
    const moved = instances.filter((i) => idsToMove.includes(i.id));
    set({ instances: [...moved, ...remaining] });
    get().pushHistory();
  },

  bringForward: (targetId) => {
    const { selectedId, instances } = get();
    const id = targetId || selectedId;
    if (!id) return;
    const idx = instances.findIndex((i) => i.id === id);
    if (idx < 0 || idx === instances.length - 1) return;
    const next = [...instances];
    const temp = next[idx];
    next[idx] = next[idx + 1];
    next[idx + 1] = temp;
    set({ instances: next });
    get().pushHistory();
  },

  sendBackward: (targetId) => {
    const { selectedId, instances } = get();
    const id = targetId || selectedId;
    if (!id) return;
    const idx = instances.findIndex((i) => i.id === id);
    if (idx <= 0) return;
    const next = [...instances];
    const temp = next[idx];
    next[idx] = next[idx - 1];
    next[idx - 1] = temp;
    set({ instances: next });
    get().pushHistory();
  },

  rotateSelected: (angleDelta = 90) => {
    const { selectedIds } = get();
    if (selectedIds.length === 0) return;
    set((s) => ({
      instances: s.instances.map((i) =>
        selectedIds.includes(i.id) ? { ...i, rotation: ((i.rotation ?? 0) + angleDelta) % 360 } : i,
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
      instances: s.instances.map((i) => (selectedIds.includes(i.id) ? { ...i, groupId } : i)),
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
      const snapshot = history[prevIndex];
      if (!snapshot) return;

      const prevInstances =
        typeof structuredClone === 'function'
          ? structuredClone(snapshot.instances)
          : JSON.parse(JSON.stringify(snapshot.instances));

      set({ instances: prevInstances, historyIndex: prevIndex });

      if (snapshot.graphData) {
        import('./circuitStore').then(({ useCircuitStore }) => {
          const newGraph = Graph.fromJSON(snapshot.graphData!);
          useCircuitStore.setState({ graph: newGraph, solverResult: null });
          useCircuitStore.getState().solve();
        });
      }
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const snapshot = history[nextIndex];
      if (!snapshot) return;

      const nextInstances =
        typeof structuredClone === 'function'
          ? structuredClone(snapshot.instances)
          : JSON.parse(JSON.stringify(snapshot.instances));

      set({ instances: nextInstances, historyIndex: nextIndex });

      if (snapshot.graphData) {
        import('./circuitStore').then(({ useCircuitStore }) => {
          const newGraph = Graph.fromJSON(snapshot.graphData!);
          useCircuitStore.setState({ graph: newGraph, solverResult: null });
          useCircuitStore.getState().solve();
        });
      }
    }
  },

  resetCanvas: () => {
    set({
      instances: [],
      scale: 1,
      panX: 0,
      panY: 0,
      selectedId: null,
      selectedIds: [],
      wiringMode: false,
      pendingWire: null,
      history: [],
      historyIndex: -1,
      clipboard: null,
    });
    import('./circuitStore').then(({ useCircuitStore }) => {
      useCircuitStore.getState().reset();
      get().pushHistory();
    });
  },
}));
