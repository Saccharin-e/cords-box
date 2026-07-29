/**
 * Adjacency-List Circuit Graph
 *
 * Core graph data structure for managing circuit nodes and edges.
 * Fully decoupled from UI — runs headless for CI testing (NFR-4).
 */

import type { CircuitGraph, CircuitNode, CircuitEdge, Component, SwitchState } from './types';
import { createEmptyGraph } from './types';
import type { InstrumentFamily } from './types';

export class Graph {
  private graph: CircuitGraph;
  private adjacencyList: Map<string, Set<string>>;

  constructor(family: InstrumentFamily = 'Guitar') {
    this.graph = createEmptyGraph(family);
    this.adjacencyList = new Map();
  }

  // ─── Node Operations ────────────────────────────────────────────────────────

  addNode(node: CircuitNode): void {
    if (this.graph.nodes.find((n) => n.id === node.id)) {
      throw new Error(`Node with id "${node.id}" already exists`);
    }
    this.graph.nodes.push(node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
  }

  removeNode(nodeId: string): void {
    this.graph.nodes = this.graph.nodes.filter((n) => n.id !== nodeId);
    // Remove all edges connected to this node
    this.graph.edges = this.graph.edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    // Clean adjacency list
    this.adjacencyList.delete(nodeId);
    for (const neighbors of this.adjacencyList.values()) {
      neighbors.delete(nodeId);
    }
  }

  getNode(nodeId: string): CircuitNode | undefined {
    return this.graph.nodes.find((n) => n.id === nodeId);
  }

  getNodes(): ReadonlyArray<CircuitNode> {
    return this.graph.nodes;
  }

  // ─── Edge Operations ────────────────────────────────────────────────────────

  addEdge(edge: CircuitEdge): void {
    if (this.graph.edges.find((e) => e.id === edge.id)) {
      throw new Error(`Edge with id "${edge.id}" already exists`);
    }
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    if (!this.adjacencyList.has(edge.target)) {
      this.adjacencyList.set(edge.target, new Set());
    }
    this.graph.edges.push(edge);
    this.adjacencyList.get(edge.source)!.add(edge.target);
    this.adjacencyList.get(edge.target)!.add(edge.source);
  }

  removeEdge(edgeId: string): void {
    const edge = this.graph.edges.find((e) => e.id === edgeId);
    if (edge) {
      this.adjacencyList.get(edge.source)?.delete(edge.target);
      this.adjacencyList.get(edge.target)?.delete(edge.source);
    }
    this.graph.edges = this.graph.edges.filter((e) => e.id !== edgeId);
  }

  getEdge(edgeId: string): CircuitEdge | undefined {
    return this.graph.edges.find((e) => e.id === edgeId);
  }

  getEdges(): ReadonlyArray<CircuitEdge> {
    return this.graph.edges;
  }

  getEdgesBetween(sourceId: string, targetId: string): CircuitEdge[] {
    return this.graph.edges.filter(
      (e) =>
        (e.source === sourceId && e.target === targetId) ||
        (e.source === targetId && e.target === sourceId),
    );
  }

  // ─── Component Operations ──────────────────────────────────────────────────

  addComponent(component: Component): void {
    if (this.graph.components.find((c) => c.id === component.id)) {
      throw new Error(`Component with id "${component.id}" already exists`);
    }
    this.graph.components.push(component);
  }

  removeComponent(componentId: string): void {
    this.graph.components = this.graph.components.filter((c) => c.id !== componentId);
    // Remove all nodes belonging to this component
    const nodeIds = this.graph.nodes
      .filter((n) => n.componentId === componentId)
      .map((n) => n.id);
    for (const nodeId of nodeIds) {
      this.removeNode(nodeId);
    }
  }

  getComponent(componentId: string): Component | undefined {
    return this.graph.components.find((c) => c.id === componentId);
  }

  getComponents(): ReadonlyArray<Component> {
    return this.graph.components;
  }

  getComponentNodes(componentId: string): CircuitNode[] {
    return this.graph.nodes.filter((n) => n.componentId === componentId);
  }

  // ─── Switch State ──────────────────────────────────────────────────────────

  setSwitchState(state: SwitchState): void {
    const idx = this.graph.switchStates.findIndex((s) => s.componentId === state.componentId);
    if (idx >= 0) {
      this.graph.switchStates[idx] = state;
    } else {
      this.graph.switchStates.push(state);
    }
  }

  getSwitchState(componentId: string): SwitchState | undefined {
    return this.graph.switchStates.find((s) => s.componentId === componentId);
  }

  // ─── Graph Queries ─────────────────────────────────────────────────────────

  getNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) ?? []);
  }

  hasPath(fromId: string, toId: string): boolean {
    if (fromId === toId) return true;
    const visited = new Set<string>();
    const stack = [fromId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === toId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return false;
  }

  getConnectedComponent(nodeId: string): Set<string> {
    const visited = new Set<string>();
    const stack = [nodeId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }
    return visited;
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  toJSON(): CircuitGraph {
    return structuredClone(this.graph);
  }

  static fromJSON(data: CircuitGraph): Graph {
    const graph = new Graph(data.instrument_family);
    for (const node of data.nodes) {
      graph.addNode(node);
    }
    for (const edge of data.edges) {
      graph.addEdge(edge);
    }
    for (const component of data.components) {
      graph.addComponent(component);
    }
    for (const switchState of data.switchStates) {
      graph.setSwitchState(switchState);
    }
    return graph;
  }
}
