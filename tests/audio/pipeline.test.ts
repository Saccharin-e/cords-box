import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '@graph/Graph';
import { solveSignalPaths } from '@graph/solver';
import { audioPipeline } from '@audio/pipeline';

describe('Audio DSP Pipeline', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph('Guitar');
  });

  it('should handle updatePipeline gracefully when AudioContext is inactive', () => {
    graph.addComponent({ id: 'pu1', type: 'pickup_single_coil', label: 'Neck Pickup' });
    graph.addNode({
      id: 'pu1_hot',
      type: 'terminal',
      componentId: 'pu1',
      role: 'hot',
      signalState: 'active',
    });

    const result = solveSignalPaths(graph);
    expect(() => audioPipeline.updatePipeline(graph, result)).not.toThrow();
  });

  it('should clean up nodes on dispose', () => {
    expect(() => audioPipeline.dispose()).not.toThrow();
  });
});
