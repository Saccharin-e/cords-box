import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@graph/Graph';
import { solveSignalPaths } from '@graph/solver';
import {
  TRUE_CEILING_LINEAR,
  audioPipeline,
  findActiveHarnessControls,
  getPickupWdfProfile,
  inferOutOfPhasePickupIds,
  inferPickupSelection,
} from '@audio/pipeline';
import { audioEngine } from '@audio/context';
import type { CircuitNode, ComponentType } from '@graph/types';

function createMockContext() {
  const counts = { createGain: 0, createBuffer: 0, createConvolver: 0 };
  const nodes: any[] = [];
  const worklets: any[] = [];
  let nextNodeId = 0;
  const makeParam = () => ({
    value: 0,
    targets: [] as Array<{ value: number; time: number; timeConstant: number }>,
    setValues: [] as Array<{ value: number; time: number }>,
    cancelScheduledValues: () => {},
    setValueAtTime(value: number, time: number) {
      this.value = value;
      this.setValues.push({ value, time });
    },
    setTargetAtTime(value: number, time: number, timeConstant: number) {
      this.value = value;
      this.targets.push({ value, time, timeConstant });
    },
    linearRampToValueAtTime(value: number) {
      this.value = value;
    },
  });
  const makeNode = (kind = 'node') => {
    const node: any = {
      id: ++nextNodeId,
      kind,
      connections: [] as any[],
      connect(target: any) {
        this.connections.push(target);
        return target;
      },
      disconnect(target?: any) {
        this.connections = target
          ? this.connections.filter((connection: any) => connection !== target)
          : [];
      },
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
    };
    nodes.push(node);
    return node;
  };

  class MockAudioWorkletNode {
    readonly kind: string;
    readonly connections: any[] = [];
    onprocessorerror: (() => void) | null = null;
    readonly port = {
      messages: [] as any[],
      onmessage: null as ((event: { data: any }) => void) | null,
      postMessage: (message: any) => {
        this.port.messages.push(message);
      },
      emit: (message: any) => {
        this.port.onmessage?.({ data: message });
      },
    };

    constructor(_context: AudioContext, name: string) {
      this.kind = name;
      worklets.push(this);
    }

    connect(target: any) {
      this.connections.push(target);
      return target;
    }

    disconnect() {
      this.connections.length = 0;
    }
  }

  const ctx: any = {
    sampleRate: 44100,
    currentTime: 0,
    state: 'running',
    audioWorklet: {},
    destination: makeNode(),
    createGain: () => {
      counts.createGain += 1;
      return makeNode('gain');
    },
    createBiquadFilter: () => makeNode('biquad'),
    createDynamicsCompressor: () => makeNode('compressor'),
    createWaveShaper: () => makeNode('waveshaper'),
    createConvolver: () => {
      counts.createConvolver += 1;
      return makeNode('convolver');
    },
    createDelay: () => makeNode('delay'),
    createOscillator: () => ({
      ...makeNode('oscillator'),
      start: () => {},
      stop: () => {},
    }),
    createChannelMerger: () => makeNode('merger'),
    createAnalyser: () => makeNode('analyser'),
    createBuffer: (_channels: number, length: number, sampleRate: number) => {
      counts.createBuffer += 1;
      return { getChannelData: () => new Float32Array(length), sampleRate, length };
    },
  };
  return { ctx, counts, nodes, worklets, MockAudioWorkletNode };
}

function addPickup(graph: Graph, id: string, type: ComponentType, label = id) {
  graph.addComponent({ id, type, label });
  graph.addNode({
    id: `${id}_hot`,
    type: 'terminal',
    componentId: id,
    role: 'hot',
    signalState: 'inactive',
  });
  graph.addNode({
    id: `${id}_ground`,
    type: 'ground',
    componentId: id,
    role: 'ground',
    signalState: 'inactive',
  });
}

function addOutput(graph: Graph) {
  graph.addComponent({ id: 'output_jack', type: 'output_jack', label: 'Output' });
  graph.addNode({
    id: 'output_tip',
    type: 'jack_terminal',
    componentId: 'output_jack',
    role: 'tip',
    signalState: 'inactive',
  });
  graph.addNode({
    id: 'output_sleeve',
    type: 'jack_terminal',
    componentId: 'output_jack',
    role: 'ground',
    signalState: 'inactive',
  });
}

let edgeIndex = 0;
function connect(graph: Graph, source: string, target: string) {
  graph.addEdge({
    id: `test-edge-${++edgeIndex}`,
    source,
    target,
    resistance: 0,
    wireColor: '#888',
    connectionType: 'solder',
    wireType: 'modern_vinyl',
  });
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
