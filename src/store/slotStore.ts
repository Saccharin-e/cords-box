/**
 * slotStore.ts — Saveable Layout Slots & Template Storage Manager
 *
 * Manages persistent storage slots for guitar wiring harness layouts.
 * Features:
 * - 6 Saveable Slots stored in localStorage
 * - Pre-populated with default circuit templates (HSS Test Bench, Indie Tele, 50s Tele)
 * - Save current canvas to any slot with custom name
 * - Load slot directly onto canvas and re-solve Web Audio DSP graph
 * - Reset and rename custom slots
 */

import { create } from 'zustand';
import type { CanvasComponentInstance } from './canvasStore';
import { useCanvasStore } from './canvasStore';
import { useCircuitStore } from './circuitStore';
import type { Component, CircuitEdge, CircuitNode } from '@graph/types';
import { PRESETS } from '@presets/presetLibrary';

export interface SavedLayoutData {
  instances: CanvasComponentInstance[];
  components: Component[];
  nodes: CircuitNode[];
  edges: CircuitEdge[];
  switchStates?: Record<
    string,
    { currentPosition: number; totalPositions: number; poles?: number }
  >;
}

export interface LayoutSlot {
  slotId: string;
  name: string;
  updatedAt: number;
  isCustom: boolean;
  presetTemplateId?: string;
  data: SavedLayoutData;
}

const STORAGE_KEY = 'cords_box_layout_slots_v1';

// Build initial default slots from built-in PRESETS
function createDefaultSlots(): LayoutSlot[] {
  const t1 = PRESETS.find((p) => p.id === 'guitar_sound_test_template');
  const t2 = PRESETS.find((p) => p.id === 'indie_telecaster_harness');
  const t3 = PRESETS.find((p) => p.id === 'standard_50s_telecaster');

  return [
    {
      slotId: 'slot_1',
      name: 'Slot 1: Sound Test Bench (HSS)',
      updatedAt: Date.now(),
      isCustom: false,
      presetTemplateId: 'guitar_sound_test_template',
      data: {
        instances: t1?.components ?? [],
        components: t1?.components ?? [],
        nodes: [],
        edges: t1?.edges ?? [],
      },
    },
    {
      slotId: 'slot_2',
      name: 'Slot 2: Indie-Rock Telecaster',
      updatedAt: Date.now(),
      isCustom: false,
      presetTemplateId: 'indie_telecaster_harness',
      data: {
        instances: t2?.components ?? [],
        components: t2?.components ?? [],
        nodes: [],
        edges: t2?.edges ?? [],
      },
    },
    {
      slotId: 'slot_3',
      name: 'Slot 3: Standard 50s Telecaster',
      updatedAt: Date.now(),
      isCustom: false,
      presetTemplateId: 'standard_50s_telecaster',
      data: {
        instances: t3?.components ?? [],
        components: t3?.components ?? [],
        nodes: [],
        edges: t3?.edges ?? [],
      },
    },
    {
      slotId: 'slot_4',
      name: 'Slot 4: Empty Custom Slot',
      updatedAt: Date.now(),
      isCustom: false,
      data: { instances: [], components: [], nodes: [], edges: [] },
    },
    {
      slotId: 'slot_5',
      name: 'Slot 5: Empty Custom Slot',
      updatedAt: Date.now(),
      isCustom: false,
      data: { instances: [], components: [], nodes: [], edges: [] },
    },
    {
      slotId: 'slot_6',
      name: 'Slot 6: Empty Custom Slot',
      updatedAt: Date.now(),
      isCustom: false,
      data: { instances: [], components: [], nodes: [], edges: [] },
    },
  ];
}

function loadInitialSlots(): LayoutSlot[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultSlots();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultSlots();
    const parsed = JSON.parse(raw) as LayoutSlot[];
    if (Array.isArray(parsed) && parsed.length >= 6) {
      return parsed;
    }
  } catch {
    // Ignore parse errors and fallback to defaults
  }
  return createDefaultSlots();
}

function persistSlots(slots: LayoutSlot[]) {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
    } catch {
      // Quota or access error ignored
    }
  }
}

export interface SlotStoreState {
  slots: LayoutSlot[];
  activeSlotId: string | null;
  saveCurrentToSlot: (slotId: string, customName?: string) => void;
  loadSlot: (slotId: string) => boolean;
  renameSlot: (slotId: string, newName: string) => void;
  resetSlotToDefault: (slotId: string) => void;
}

export const useSlotStore = create<SlotStoreState>((set, get) => ({
  slots: loadInitialSlots(),
  activeSlotId: null,

  saveCurrentToSlot: (slotId: string, customName?: string) => {
    const canvasState = useCanvasStore.getState();
    const circuitState = useCircuitStore.getState();

    const instances = canvasState.instances;
    const graph = circuitState.graph;
    const components = graph.getComponents();
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    const switchStates: Record<
      string,
      { currentPosition: number; totalPositions: number; poles?: number }
    > = {};
    for (const comp of components) {
      const sw = graph.getSwitchState(comp.id);
      if (sw) switchStates[comp.id] = { ...sw };
    }

    const nextSlots = get().slots.map((slot) => {
      if (slot.slotId !== slotId) return slot;
      return {
        ...slot,
        name: customName && customName.trim() ? customName.trim() : slot.name,
        updatedAt: Date.now(),
        isCustom: true,
        presetTemplateId: undefined,
        data: {
          instances: JSON.parse(JSON.stringify(instances)),
          components: JSON.parse(JSON.stringify(components)),
          nodes: JSON.parse(JSON.stringify(nodes)),
          edges: JSON.parse(JSON.stringify(edges)),
          switchStates,
        },
      };
    });

    set({ slots: nextSlots, activeSlotId: slotId });
    persistSlots(nextSlots);
  },

  loadSlot: (slotId: string) => {
    const slot = get().slots.find((s) => s.slotId === slotId);
    if (!slot) return false;

    // If slot has a built-in preset template ID and hasn't been overwritten as custom, load preset definition directly
    if (slot.presetTemplateId && !slot.isCustom) {
      const preset = PRESETS.find((p) => p.id === slot.presetTemplateId);
      if (preset) {
        useCircuitStore.getState().reset();
        const graph = useCircuitStore.getState().graph;

        const newInstances: CanvasComponentInstance[] = [];
        for (const comp of preset.components) {
          const compCopy = { ...comp };
          graph.addComponent(compCopy);
          newInstances.push(compCopy);
        }

        useCanvasStore.setState({ instances: newInstances });
        for (const edge of preset.edges) {
          try {
            graph.addEdge(edge);
          } catch {
            // Ignore
          }
        }
        useCircuitStore.getState().solve();
        useCanvasStore.getState().pushHistory();
        set({ activeSlotId: slotId });
        return true;
      }
    }

    // Load custom saved slot data
    const { instances, components, nodes, edges, switchStates } = slot.data;
    useCircuitStore.getState().reset();
    const graph = useCircuitStore.getState().graph;

    // 1. Add components
    for (const comp of components) {
      try {
        graph.addComponent(comp);
      } catch {
        // Ignore
      }
    }

    // 2. Add custom nodes
    for (const node of nodes) {
      try {
        graph.addNode(node);
      } catch {
        // Ignore
      }
    }

    // 3. Add edges
    for (const edge of edges) {
      try {
        graph.addEdge(edge);
      } catch {
        // Ignore
      }
    }

    // 4. Restore switch states
    if (switchStates) {
      for (const [compId, sw] of Object.entries(switchStates)) {
        graph.setSwitchState({
          componentId: compId,
          currentPosition: sw.currentPosition,
          totalPositions: sw.totalPositions,
          poles: sw.poles ?? 2,
        });
      }
    }

    // Sync to CanvasStore
    useCanvasStore.setState({ instances: JSON.parse(JSON.stringify(instances)) });
    useCircuitStore.getState().solve();
    useCanvasStore.getState().pushHistory();

    set({ activeSlotId: slotId });
    return true;
  },

  renameSlot: (slotId: string, newName: string) => {
    if (!newName.trim()) return;
    const nextSlots = get().slots.map((slot) => {
      if (slot.slotId !== slotId) return slot;
      return {
        ...slot,
        name: newName.trim(),
        updatedAt: Date.now(),
      };
    });
    set({ slots: nextSlots });
    persistSlots(nextSlots);
  },

  resetSlotToDefault: (slotId: string) => {
    const defaults = createDefaultSlots();
    const defaultSlot = defaults.find((s) => s.slotId === slotId);
    if (!defaultSlot) return;

    const nextSlots = get().slots.map((slot) => {
      if (slot.slotId !== slotId) return slot;
      return { ...defaultSlot };
    });

    set({ slots: nextSlots });
    persistSlots(nextSlots);
  },
}));
