import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../../src/graph/Graph';
import { solveSignalPaths } from '../../src/graph/solver';
import type { CircuitNode, CircuitEdge } from '../../src/graph/types';

describe('Signal Path Solver', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph('Guitar');
  });

  it('should find a direct path from pickup to output', () => {
    const pickupHot: CircuitNode = {
      id: 'pickup_hot',
      type: 'terminal',
      componentId: 'pickup_neck',
      role: 'hot',
      signalState: 'active',
    };
    const outputTip: CircuitNode = {
      id: 'output_tip',
      type: 'jack_terminal',
      componentId: 'output_jack',
      role: 'tip',
      signalState: 'inactive',
    };
    const wire: CircuitEdge = {
      id: 'wire_1',
      source: 'pickup_hot',
      target: 'output_tip',
      resistance: 0,
      wireColor: '#888',
      connectionType: 'solder',
      wireType: 'modern_vinyl',
    };

    graph.addNode(pickupHot);
    graph.addNode(outputTip);
    graph.addEdge(wire);

    const result = solveSignalPaths(graph);

    expect(result.activePaths).toHaveLength(1);
    expect(result.activePaths[0].reachesOutput).toBe(true);
    expect(result.activePaths[0].nodes).toEqual(['pickup_hot', 'output_tip']);
    expect(result.activeNodes.has('pickup_hot')).toBe(true);
    expect(result.activeNodes.has('output_tip')).toBe(true);
  });

  it('should detect dead-end paths', () => {
    const pickupHot: CircuitNode = {
      id: 'pickup_hot',
      type: 'terminal',
      componentId: 'pickup_neck',
      role: 'hot',
      signalState: 'active',
    };
    // No output jack — so the path is a dead end
    graph.addNode(pickupHot);

    const result = solveSignalPaths(graph);

    expect(result.activePaths).toHaveLength(0);
    expect(result.deadEndNodes.has('pickup_hot')).toBe(true);
  });

  it('should handle multi-hop paths through switches', () => {
    const nodes: CircuitNode[] = [
      { id: 'pickup_hot', type: 'terminal', componentId: 'pickup', role: 'hot', signalState: 'active' },
      { id: 'switch_in', type: 'switch_lug', componentId: 'switch', role: 'input', signalState: 'inactive' },
      { id: 'switch_out', type: 'switch_lug', componentId: 'switch', role: 'output', signalState: 'inactive' },
      { id: 'output_tip', type: 'jack_terminal', componentId: 'jack', role: 'tip', signalState: 'inactive' },
    ];
    const edges: CircuitEdge[] = [
      { id: 'w1', source: 'pickup_hot', target: 'switch_in', resistance: 0, wireColor: '#888', connectionType: 'solder', wireType: 'modern_vinyl' },
      { id: 'w2', source: 'switch_in', target: 'switch_out', resistance: 0, wireColor: '#888', connectionType: 'solder', wireType: 'modern_vinyl' },
      { id: 'w3', source: 'switch_out', target: 'output_tip', resistance: 0, wireColor: '#888', connectionType: 'solder', wireType: 'modern_vinyl' },
    ];

    for (const n of nodes) graph.addNode(n);
    for (const e of edges) graph.addEdge(e);

    const result = solveSignalPaths(graph);

    expect(result.activePaths).toHaveLength(1);
    expect(result.activePaths[0].nodes).toEqual([
      'pickup_hot', 'switch_in', 'switch_out', 'output_tip',
    ]);
  });
});
