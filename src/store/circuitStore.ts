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
import { audioPipeline } from '@audio/index';
import type { CircuitNode, CircuitEdge, Component, SwitchState } from '@graph/types';

export interface CircuitStore {
  graph: Graph;
  solverResult: SolverResult | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedComponentId: string | null;

  // Mutations
  addNode: (node: CircuitNode) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: CircuitEdge) => void;
  removeEdge: (edgeId: string) => void;
  addComponent: (component: Component) => void;
  updateComponentValue: (componentId: string, value: Component['value']) => void;
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
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedComponentId: null,

  addNode: (node) => {
    get().graph.addNode(node);
    get().solve();
    set({});
  },
  removeNode: (nodeId) => {
    get().graph.removeNode(nodeId);
    get().solve();
    set({});
  },
  addEdge: (edge) => {
    get().graph.addEdge(edge);
    get().solve();
    set({});
  },
  removeEdge: (edgeId) => {
    get().graph.removeEdge(edgeId);
    get().solve();
    set({});
  },
  addComponent: (component) => {
    get().graph.addComponent(component);
    set({});
  },
  updateComponentValue: (componentId, value) => {
    get().graph.updateComponentValue(componentId, value);
    get().solve();
    set({});
  },
  removeComponent: (componentId: string) => {
    get().graph.removeComponent(componentId);
    get().solve();
    set({});
  },
  setSwitchState: (state) => {
    get().graph.setSwitchState(state);
    get().solve();
    set({});
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
    const result = solveSignalPaths(graph);
    audioPipeline.updatePipeline(graph, result);
    set({ solverResult: result });
  },

  exportJSON: () => JSON.stringify(get().graph.toJSON(), null, 2),
  importJSON: (json) => {
    const data = JSON.parse(json);
    const graph = Graph.fromJSON(data);
    set({ graph, solverResult: null });
    get().solve();
  },
  reset: () => {
    set({ graph: new Graph('Guitar'), solverResult: null });
    get().clearSelection();
  },
}));
