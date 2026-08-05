import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@graph/Graph';
import { solveSignalPaths } from '@graph/solver';
import { audioPipeline } from '@audio/pipeline';
import { audioEngine } from '@audio/context';
import type { CircuitNode } from '@graph/types';

function createMockContext() {
  const counts = { createGain: 0, createBuffer: 0, createConvolver: 0 };
  const makeParam = () => ({ value: 0, setValueAtTime: () => {} });
  const makeNode = () => ({
    connect: () => makeNode(),
    disconnect: () => {},
    gain: makeParam(),
    frequency: makeParam(),
    Q: makeParam(),
    threshold: makeParam(),
    knee: makeParam(),
    ratio: makeParam(),
    attack: makeParam(),
    release: makeParam(),
    delayTime: makeParam(),
    curve: null,
    oversample: 'none',
    type: '',
    buffer: null,
    normalize: true,
    fftSize: 256,
    getByteTimeDomainData: () => {},
  });
  const ctx: any = {
    sampleRate: 44100,
    currentTime: 0,
    destination: makeNode(),
    createGain: () => {
      counts.createGain += 1;
      return makeNode();
    },
    createBiquadFilter: () => makeNode(),
    createDynamicsCompressor: () => makeNode(),
    createWaveShaper: () => makeNode(),
    createConvolver: () => {
      counts.createConvolver += 1;
      return makeNode();
    },
    createDelay: () => makeNode(),
    createChannelMerger: () => makeNode(),
    createAnalyser: () => makeNode(),
    createBuffer: (_channels: number, length: number, sampleRate: number) => {
      counts.createBuffer += 1;
      return { getChannelData: () => new Float32Array(length), sampleRate, length };
    },
  };
  return { ctx, counts };
}

describe('Audio DSP Pipeline', () => {
  let graph: Graph;
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    graph = new Graph('Guitar');
    mock = createMockContext();
    vi.spyOn(audioEngine, 'getContext').mockReturnValue(mock.ctx);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should handle updatePipeline gracefully when AudioContext is inactive', () => {
    const spy = vi.spyOn(audioEngine, 'getContext').mockReturnValue(null);
    graph.addComponent({ id: 'pickup_neck', type: 'pickup_single_coil', label: 'Neck Pickup' });
    graph.addNode({
      id: 'pickup_neck_hot',
      type: 'terminal',
      componentId: 'pickup_neck',
      role: 'hot',
      signalState: 'active',
    });

    const result = solveSignalPaths(graph);
    expect(() => audioPipeline.updatePipeline(graph, result)).not.toThrow();
    spy.mockRestore();
  });

  it('should only rebuild the audio graph when circuit topology changes', () => {
    const pu1Hot: CircuitNode = {
      id: 'pickup_neck_hot',
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
    graph.addComponent({ id: 'pickup_neck', type: 'pickup_single_coil', label: 'Neck Pickup' });
    graph.addNode(pu1Hot);
    graph.addNode(outputTip);
    graph.addEdge({
      id: 'wire_1',
      source: 'pickup_neck_hot',
      target: 'output_tip',
      resistance: 0,
      wireColor: '#888',
      connectionType: 'solder',
      wireType: 'modern_vinyl',
    });

    let result = solveSignalPaths(graph);
    expect(result.activeNodes.has('pickup_neck_hot')).toBe(true);

    // Initial build creates the full node graph.
    audioPipeline.updatePipeline(graph, result);
    const initialGainCount = mock.counts.createGain;
    expect(initialGainCount).toBeGreaterThan(0);

    // Identical topology: no rebuild, no node churn.
    audioPipeline.updatePipeline(graph, result);
    expect(mock.counts.createGain).toBe(initialGainCount);

    // Adding a second pickup changes the topology signature → rebuild.
    const pu2Hot: CircuitNode = {
      id: 'pickup_bridge_hot',
      type: 'terminal',
      componentId: 'pickup_bridge',
      role: 'hot',
      signalState: 'active',
    };
    graph.addComponent({ id: 'pickup_bridge', type: 'pickup_humbucker', label: 'Bridge Pickup' });
    graph.addNode(pu2Hot);
    graph.addEdge({
      id: 'wire_2',
      source: 'pickup_bridge_hot',
      target: 'output_tip',
      resistance: 0,
      wireColor: '#888',
      connectionType: 'solder',
      wireType: 'modern_vinyl',
    });

    result = solveSignalPaths(graph);
    audioPipeline.updatePipeline(graph, result);
    expect(mock.counts.createGain).toBeGreaterThan(initialGainCount);

    // Impulse responses are cached: two rebuilds still only created two IRs.
    expect(mock.counts.createBuffer).toBe(2);
  });

  it('should clean up nodes on dispose', () => {
    expect(() => audioPipeline.dispose()).not.toThrow();
  });
});
