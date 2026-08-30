/**
 * Circuit Store (Zustand)
 *
 * Single source of truth for the circuit graph state.
 * Subscribed by both UI canvas and audio engine layers.
 */

import { create } from 'zustand';
import { Graph } from '@graph/Graph';
import { solveSignalPaths } from '@graph/solver';
import type { SolverResult } from '@graph/solver';
import { lintCircuit } from '@lint/linter';
import type { LintDiagnostic } from '@lint/linter';
import { audioPipeline } from '@audio/index';
import type { CircuitNode, CircuitEdge, Component, SwitchState } from '@graph/types';

import { useCanvasStore } from './canvasStore';

export interface CircuitStore {
  graph: Graph;
  solverResult: SolverResult | null;
  diagnostics: LintDiagnostic[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedComponentId: string | null;
  version: number;

  // Mutations
  addNode: (node: CircuitNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CircuitEdge) => void;
  removeEdge: (edgeId: string) => void;
  addComponent: (component: Component) => void;
  updateComponentValue: (componentId: string, value: Component['value'], skipHistory?: boolean) => void;
  updateComponentLabel: (componentId: string, label: string) => void;
  updateEdge: (
    edgeId: string,
    updates: Partial<CircuitEdge>,
    skipSolve?: boolean,
    skipHistory?: boolean,
  ) => void;
  removeComponent: (componentId: string) => void;
  setSwitchState: (state: SwitchState) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  selectComponent: (componentId: string | null) => void;
  clearSelection: () => void;

  // Solver
  solve: () => void;

  // Serialization
  exportJSON: () => string;
  importJSON: (json: string) => void;
  reset: () => void;
}

export const useCircuitStore = create<CircuitStore>((set, get) => ({
  graph: new Graph('Guitar'),
  solverResult: null,
  diagnostics: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedComponentId: null,
  version: 0,

  addNode: (node) => {
    get().graph.addNode(node);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  removeNode: (nodeId) => {
    get().graph.removeNode(nodeId);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  addEdge: (edge) => {
    get().graph.addEdge(edge);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  removeEdge: (edgeId) => {
    get().graph.removeEdge(edgeId);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  addComponent: (component) => {
    get().graph.addComponent(component);
    set((s) => ({
      version: s.version + 1,
      diagnostics: lintCircuit(get().graph),
    }));
    useCanvasStore.getState().pushHistory();
  },
  updateComponentValue: (componentId, value, skipHistory = false) => {
    get().graph.updateComponentValue(componentId, value);
    useCanvasStore.setState((s) => ({
      instances: s.instances.map((inst) =>
        inst.id === componentId ? { ...inst, value } : inst,
      ),
    }));
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    if (!skipHistory) {
      useCanvasStore.getState().pushHistory();
    }
  },
  updateComponentLabel: (componentId, label) => {
    get().graph.updateComponentLabel(componentId, label);
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  updateEdge: (edgeId, updates, skipSolve = false, skipHistory = false) => {
    get().graph.updateEdge(edgeId, updates);
    if (!skipSolve) {
      get().solve();
    }
    set((s) => ({ version: s.version + 1 }));
    if (!skipHistory) {
      useCanvasStore.getState().pushHistory();
    }
  },
  removeComponent: (componentId: string) => {
    get().graph.removeComponent(componentId);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },
  setSwitchState: (state) => {
    get().graph.setSwitchState(state);
    get().solve();
    set((s) => ({ version: s.version + 1 }));
    useCanvasStore.getState().pushHistory();
  },

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null, selectedComponentId: null }),
  selectEdge: (edgeId) =>
    set({ selectedNodeId: null, selectedEdgeId: edgeId, selectedComponentId: null }),
  selectComponent: (componentId) =>
    set({ selectedNodeId: null, selectedEdgeId: null, selectedComponentId: componentId }),
  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null, selectedComponentId: null }),

  solve: () => {
    const graph = get().graph;
    const solverResult = solveSignalPaths(graph);
    audioPipeline.updatePipeline(graph, solverResult);
    set((s) => ({
      solverResult,
      diagnostics: lintCircuit(graph),
      version: s.version + 1,
    }));
  },

  exportJSON: () => JSON.stringify(get().graph.toJSON(), null, 2),
  importJSON: (json) => {
    const data = JSON.parse(json);
    const graph = Graph.fromJSON(data);
    set((s) => ({ graph, solverResult: null, version: s.version + 1 }));
    get().solve();
  },
  reset: () => {
    set((s) => ({
      graph: new Graph('Guitar'),
      solverResult: null,
      diagnostics: [],
      version: s.version + 1,
    }));
    get().clearSelection();
  },
}));
