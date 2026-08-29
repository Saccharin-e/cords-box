import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Graph } from '@graph/Graph';
import { solveSignalPaths } from '@graph/solver';
import {
  TRUE_CEILING_LINEAR,
  audioPipeline,
  computeVoiceAwarePowerSagGain,
  createTrueCeilingCurve,
  deriveSynthPluckArticulation,
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

function solverResultWith(...activeNodeIds: string[]) {
  return {
    activePaths: [],
    activeNodes: new Set(activeNodeIds),
    activeEdges: new Set<string>(),
    deadEndNodes: new Set<string>(),
  };
}

describe('graph-derived WDF configuration', () => {
  it('maps source articulation and harmonic nodes into one synth pluck payload', () => {
    expect(deriveSynthPluckArticulation('palm_mute', 220, 2)).toMatchObject({
      frequency: 220,
      pickPosition: 0.1,
      pickHardness: 0.88,
    });
    expect(deriveSynthPluckArticulation('ghost', 220, 2).pickHardness).toBeLessThan(
      deriveSynthPluckArticulation('none', 220, 2).pickHardness,
    );
    expect(deriveSynthPluckArticulation('harmonic', 659.26, 0, 329.63)).toMatchObject({
      frequency: 329.63,
      harmonicNodeRatio: 0.5,
      harmonicStrength: 0.9,
    });
    expect(deriveSynthPluckArticulation('pinch_harmonic', 659.26, 0).harmonicNodeRatio).toBe(
      1 / 3,
    );
  });

  it('sags a six-string load more than a matched-energy single note', () => {
    const singleGain = computeVoiceAwarePowerSagGain(1, 0.05, 0.5);
    const chordGain = computeVoiceAwarePowerSagGain(6, 0.05, 0.5);
    expect(chordGain).toBeLessThan(singleGain - 0.1);
    expect(chordGain).toBeGreaterThan(0.7);
  });

  it('maps pickup electrical profiles from component types, not ids or labels', () => {
    expect(getPickupWdfProfile('pickup_humbucker')).toEqual({
      inductanceH: 4.2,
      resistanceOhms: 8500,
      windingCapFarads: 160e-12,
    });
    expect(getPickupWdfProfile('renamed-neck-pickup')).toBe(
      getPickupWdfProfile('pickup_single_coil'),
    );
  });

  it('distinguishes an isolated series link from a shared parallel output net', () => {
    const seriesGraph = new Graph('Guitar');
    addPickup(seriesGraph, 'neck', 'pickup_single_coil');
    addPickup(seriesGraph, 'bridge', 'pickup_single_coil');
    addOutput(seriesGraph);
    connect(seriesGraph, 'neck_hot', 'output_tip');
    connect(seriesGraph, 'neck_ground', 'bridge_hot');
    connect(seriesGraph, 'bridge_ground', 'output_sleeve');

    expect(inferPickupSelection(seriesGraph, solverResultWith('neck_hot'))).toEqual({
      activePickupIds: ['neck', 'bridge'],
      isSeries: true,
    });

    const parallelGraph = new Graph('Guitar');
    addPickup(parallelGraph, 'neck', 'pickup_single_coil');
    addPickup(parallelGraph, 'bridge', 'pickup_humbucker');
    addOutput(parallelGraph);
    connect(parallelGraph, 'neck_hot', 'output_tip');
    connect(parallelGraph, 'bridge_hot', 'output_tip');
    connect(parallelGraph, 'neck_ground', 'output_sleeve');
    connect(parallelGraph, 'bridge_ground', 'output_sleeve');

    expect(
      inferPickupSelection(parallelGraph, solverResultWith('neck_hot', 'bridge_hot', 'output_tip')),
    ).toEqual({ activePickupIds: ['neck', 'bridge'], isSeries: false });
  });

  it('only marks a pickup out of phase when both leads reach pulled DPDT commons', () => {
    const graph = new Graph('Guitar');
    addPickup(graph, 'neck', 'pickup_single_coil');
    graph.addComponent({ id: 'phase', type: 'switch_dpdt', label: 'Phase' });
    graph.addNode({
      id: 'phase_common_a',
      type: 'switch_lug',
      componentId: 'phase',
      role: 'common',
      signalState: 'inactive',
    });
    graph.addNode({
      id: 'phase_common_b',
      type: 'switch_lug',
      componentId: 'phase',
      role: 'common',
      signalState: 'inactive',
    });
    graph.setSwitchState({ componentId: 'phase', currentPosition: 2, totalPositions: 2, poles: 2 });
    connect(graph, 'neck_hot', 'phase_common_a');
    connect(graph, 'neck_ground', 'phase_common_b');

    expect(inferOutOfPhasePickupIds(graph, ['neck'])).toEqual(new Set(['neck']));
  });

  it('selects controls and capacitors attached to the solved signal path', () => {
    const graph = new Graph('Guitar');
    graph.addComponent({
      id: 'volume',
      type: 'pot_volume',
      label: 'Master volume',
      value: { resistance_kohms: 500, taper: 'audio', position: 0.7 },
    });
    graph.addComponent({
      id: 'tone',
      type: 'pot_tone',
      label: 'Tone',
      value: { resistance_kohms: 250, taper: 'linear', position: 0.4 },
    });
    graph.addComponent({
      id: 'tone-cap',
      type: 'capacitor',
      label: 'Tone capacitor',
      value: { capacitance_pf: 47000 },
    });
    graph.addComponent({
      id: 'bleed',
      type: 'treble_bleed',
      label: 'Treble bleed',
      value: { capacitance_pf: 1000 },
    });
    for (const id of ['volume', 'tone', 'tone-cap', 'bleed']) {
      graph.addNode({
        id: `${id}-node`,
        type: id.includes('cap') || id === 'bleed' ? 'capacitor_lead' : 'potentiometer_lug',
        componentId: id,
        signalState: 'active',
      });
    }
    connect(graph, 'tone-node', 'tone-cap-node');

    const controls = findActiveHarnessControls(
      graph,
      solverResultWith('volume-node', 'tone-node', 'tone-cap-node', 'bleed-node'),
    );
    expect(controls.volumePot?.id).toBe('volume');
    expect(controls.tonePot?.id).toBe('tone');
    expect(controls.toneCap?.id).toBe('tone-cap');
    expect(controls.trebleBleed?.id).toBe('bleed');
  });

  it('hard-clamps the final safety curve to the documented -1 dB ceiling', () => {
    const curve = createTrueCeilingCurve();
    expect(curve[0]).toBeCloseTo(-TRUE_CEILING_LINEAR, 7);
    expect(curve[curve.length - 1]).toBeCloseTo(TRUE_CEILING_LINEAR, 7);
    expect(Math.max(...curve)).toBeLessThanOrEqual(TRUE_CEILING_LINEAR);
  });
});

describe('Audio DSP Pipeline', () => {
  let graph: Graph;
  let mock: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    audioPipeline.cleanupNodes();
    graph = new Graph('Guitar');
    mock = createMockContext();
    vi.spyOn(audioEngine, 'getContext').mockReturnValue(mock.ctx);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404 })),
    );
  });

  afterEach(() => {
    audioPipeline.cleanupNodes();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps synthesized vibrato cycling for the scheduled sustain duration', () => {
    const messages: Array<{
      type: string;
      targetFreq?: number;
      time?: number;
    }> = [];
    const target = audioPipeline as unknown as {
      wdfWorkletNode: { port: { postMessage(message: (typeof messages)[number]): void } } | null;
      triggerSynthesizedGuitar(
        ctx: AudioContext,
        frequency: number,
        velocity: number,
        startTime: number,
        articulation: string,
        targetFrequency: number | undefined,
        stringIndex: number,
        sustainDurationSeconds: number,
      ): boolean;
    };
    target.wdfWorkletNode = {
      port: { postMessage: (message) => messages.push(message) },
    };

    expect(
      target.triggerSynthesizedGuitar(
        mock.ctx,
        220,
        0.7,
        1,
        'vibrato',
        undefined,
        2,
        0.72,
      ),
    ).toBe(true);
    const bends = messages.filter((message) => message.type === 'bend');
    expect(bends.length).toBeGreaterThan(8);
    expect(bends.some((message) => (message.time ?? 0) > 1.5)).toBe(true);
    expect(bends.at(-1)).toMatchObject({ targetFreq: 220, time: 1.72 });
    target.wdfWorkletNode = null;
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

  it('retains worklets created during the initial pipeline build', async () => {
    vi.spyOn(audioEngine, 'isWorkletReady').mockReturnValue(true);
    vi.stubGlobal('AudioWorkletNode', mock.MockAudioWorkletNode);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    addPickup(graph, 'custom-neck', 'pickup_single_coil');
    addOutput(graph);
    connect(graph, 'custom-neck_hot', 'output_tip');

    audioPipeline.updatePipeline(graph, solveSignalPaths(graph));
    await Promise.resolve();
    await Promise.resolve();

    expect(mock.worklets.map((worklet) => worklet.kind)).toEqual([
      'tone-stack-processor',
      'guitar-processor',
    ]);
    expect(audioPipeline.getWorkletStatus()).toBe('initializing');
    const guitarWorklet = mock.worklets.find((worklet) => worklet.kind === 'guitar-processor');
    expect(
      guitarWorklet?.port.messages.some((message: { type?: string }) => message.type === 'init'),
    ).toBe(true);
    const wdfUpdate = guitarWorklet?.port.messages.find(
      (message: { type?: string }) => message.type === 'wdf-update',
    );
    expect(wdfUpdate.params.pickups[0]).toMatchObject({
      inductanceH: 2.4,
      resistanceR: 6500,
      positionFraction: 0.275,
    });
  });

  it('should clean up nodes on dispose', () => {
    expect(() => audioPipeline.dispose()).not.toThrow();
  });
});
