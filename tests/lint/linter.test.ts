import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '@graph/Graph';
import { lintCircuit } from '@lint/linter';
import { generateTruthTable, formatTruthTable } from '@lint/truthTable';
import { create3WaySwitchMap } from '@graph/switch';

describe('Circuit Linter & Validation Suite', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph('Guitar');
  });

  it('should detect direct dead shorts to ground', () => {
    graph.addNode({
      id: 'pu_hot',
      type: 'terminal',
      componentId: 'pu1',
      role: 'hot',
      signalState: 'active',
    });
    graph.addNode({
      id: 'gnd',
      type: 'ground',
      componentId: 'gnd1',
      role: 'ground',
      signalState: 'grounded',
    });
    graph.addEdge({
      id: 'e1',
      source: 'pu_hot',
      target: 'gnd',
      resistance: 0,
      wireColor: '#000000',
      connectionType: 'solder',
      wireType: 'modern_vinyl',
    });

    const diagnostics = lintCircuit(graph);
    const shortDiag = diagnostics.find((d) => d.code === 'DEAD_SHORT');
    expect(shortDiag).toBeDefined();
    expect(shortDiag?.severity).toBe('error');
  });

  it('should detect open circuits when pickup has no path to output', () => {
    graph.addNode({
      id: 'pu_hot',
      type: 'terminal',
      componentId: 'pu1',
      role: 'hot',
      signalState: 'active',
    });
    graph.addNode({
      id: 'jack_tip',
      type: 'jack_terminal',
      componentId: 'jack1',
      role: 'tip',
      signalState: 'inactive',
    });

    const diagnostics = lintCircuit(graph);
    const openDiag = diagnostics.find((d) => d.code === 'OPEN_CIRCUIT');
    expect(openDiag).toBeDefined();
    expect(openDiag?.severity).toBe('warning');
  });

  it('should pass cleanly when pickup connects to output jack', () => {
    graph.addNode({
      id: 'pu_hot',
      type: 'terminal',
      componentId: 'pu1',
      role: 'hot',
      signalState: 'active',
    });
    graph.addNode({
      id: 'jack_tip',
      type: 'jack_terminal',
      componentId: 'jack1',
      role: 'tip',
      signalState: 'inactive',
    });
    graph.addEdge({
      id: 'wire1',
      source: 'pu_hot',
      target: 'jack_tip',
      resistance: 0,
      wireColor: '#888888',
      connectionType: 'solder',
      wireType: 'modern_vinyl',
    });

    const diagnostics = lintCircuit(graph);
    const openDiag = diagnostics.find((d) => d.code === 'OPEN_CIRCUIT');
    const shortDiag = diagnostics.find((d) => d.code === 'DEAD_SHORT');
    expect(openDiag).toBeUndefined();
    expect(shortDiag).toBeUndefined();
  });

  it('should generate and format a switch truth table', () => {
    const map = create3WaySwitchMap('sw1');
    const table = generateTruthTable(graph, 'sw1', map);

    expect(table.switchId).toBe('sw1');
    expect(table.rows).toHaveLength(3);

    const formatted = formatTruthTable(table);
    expect(formatted).toContain('Truth Table for sw1');
    expect(formatted).toContain('Position 1:');
  });
});
