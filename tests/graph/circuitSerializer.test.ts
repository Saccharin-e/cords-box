import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportProjectToCordsBox,
  importProjectFromCordsBox,
} from '@graph/circuitSerializer';
import { validateCordsBoxFile, computeProjectChecksum } from '@graph/cordsboxSchema';
import { useCanvasStore } from '@store/canvasStore';
import { useCircuitStore } from '@store/circuitStore';
import { useTuningStore } from '@store/tuningStore';
import { audioPipeline } from '@audio/pipeline';

describe('Circuit Serializer & .cordsbox Save File System', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();
  });

  it('should export and import full workspace state with 1:1 roundtrip accuracy', () => {
    // 1. Setup sample canvas instances
    const sampleInstance = {
      id: 'pickup_neck_1',
      type: 'pickup_single_coil' as const,
      label: 'Strat Vintage Neck',
      x: 120,
      y: 240,
      width: 150,
      height: 50,
      rotation: 90,
      customLabel: 'Custom Strat PU',
    };
    useCanvasStore.setState({
      instances: [sampleInstance],
      activeView: 'physical',
      scale: 1.25,
      panX: 40,
      panY: -20,
      wireDrawOptions: {
        color: '#3b82f6',
        wireType: 'vintage_cloth_pushback',
        connectionType: 'solder',
      },
    });

    // 2. Setup graph netlist
    const graph = useCircuitStore.getState().graph;
    graph.addComponent({
      id: 'pickup_neck_1',
      type: 'pickup_single_coil',
      label: 'Strat Vintage Neck',
    });
    graph.addNode({
      id: 'pickup_neck_1_hot',
      componentId: 'pickup_neck_1',
      role: 'Hot',
      type: 'terminal',
      signalState: 'active',
    });
    graph.addNode({
      id: 'pickup_neck_1_ground',
      componentId: 'pickup_neck_1',
      role: 'Ground',
      type: 'terminal',
      signalState: 'grounded',
    });
    graph.addEdge({
      id: 'edge_1',
      source: 'pickup_neck_1_hot',
      target: 'pickup_neck_1_ground',
      wireColor: '#3b82f6',
      resistance: 0.02,
      connectionType: 'solder',
      wireType: 'vintage_cloth_pushback',
    });

    // 3. Setup audio DSP & tuning
    audioPipeline.updateAmpPedalboardState({
      ampModel: 'crunch_800',
      ampGain: 0.75,
      ampBass: 0.6,
      ampMid: 0.8,
      ampTreble: 0.7,
      overdriveEnabled: true,
      overdriveDrive: 0.65,
    });
    useTuningStore.getState().setTuning('drop_d');

    // 4. Export to .cordsbox
    const exported = exportProjectToCordsBox({
      title: 'Custom HSS Hot Rod',
      description: 'Hot-rodded strat circuit with coil tap',
      author: 'GuitarTech',
      templateOriginId: 'guitar_sound_test_template',
      tags: ['strat', 'humbucker', 'custom'],
    });

    expect(exported.format).toBe('cordsbox-project');
    expect(exported.schemaVersion).toBe('2.0.0');
    expect(exported.metadata.title).toBe('Custom HSS Hot Rod');
    expect(exported.metadata.templateOriginId).toBe('guitar_sound_test_template');
    expect(exported.instances.length).toBe(1);
    expect(exported.graph.components.length).toBe(1);
    expect(exported.graph.edges.length).toBe(1);
    expect(exported.tuning.tuningId).toBe('drop_d');
    expect(exported.audioState.ampModel).toBe('crunch_800');
    expect(exported.checksum).toBeDefined();

    // 5. Clear state
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();
    useTuningStore.getState().setTuning('standard_e');

    expect(useCanvasStore.getState().instances.length).toBe(0);
    expect(useCircuitStore.getState().graph.getComponents().length).toBe(0);

    // 6. Re-import and verify 1:1 restoration
    const importRes = importProjectFromCordsBox(exported);
    expect(importRes.valid).toBe(true);

    const restoredCanvas = useCanvasStore.getState();
    expect(restoredCanvas.instances.length).toBe(1);
    expect(restoredCanvas.instances[0].id).toBe('pickup_neck_1');
    expect(restoredCanvas.instances[0].x).toBe(120);
    expect(restoredCanvas.instances[0].y).toBe(240);
    expect(restoredCanvas.instances[0].rotation).toBe(90);
    expect(restoredCanvas.instances[0].customLabel).toBe('Custom Strat PU');
    expect(restoredCanvas.activeView).toBe('physical');
    expect(restoredCanvas.scale).toBe(1.25);
    expect(restoredCanvas.panX).toBe(40);
    expect(restoredCanvas.panY).toBe(-20);

    const restoredGraph = useCircuitStore.getState().graph;
    expect(restoredGraph.getComponents().length).toBe(1);
    expect(restoredGraph.getEdges().length).toBe(1);
    expect(restoredGraph.getEdges()[0].wireColor).toBe('#3b82f6');

    expect(useTuningStore.getState().activeTuningId).toBe('drop_d');
    expect(audioPipeline.getAmpPedalboardState().ampModel).toBe('crunch_800');
    expect(audioPipeline.getAmpPedalboardState().overdriveEnabled).toBe(true);
  });

  it('should calculate consistent checksums', () => {
    const exported = exportProjectToCordsBox({ title: 'Checksum Test' });
    const { checksum, ...rest } = exported;
    const computed = computeProjectChecksum(rest);
    expect(checksum).toBe(computed);
  });

  it('should migrate legacy v1.0 envelopes seamlessly', () => {
    const legacyEnvelope = {
      version: '1.0.0',
      timestamp: '2026-01-01T00:00:00.000Z',
      instances: [
        {
          id: 'pot_1',
          type: 'pot_volume',
          label: 'Volume Pot',
          x: 100,
          y: 100,
          width: 50,
          height: 50,
        },
      ],
      graphData: {
        components: [{ id: 'pot_1', type: 'pot_volume', label: 'Volume Pot' }],
        nodes: [{ id: 'pot_1_in', componentId: 'pot_1', role: 'In', type: 'terminal', signalState: 'inactive' }],
        edges: [],
      },
      ampPedalState: {
        ampModel: 'clean_twin',
      },
    };

    const validation = validateCordsBoxFile(legacyEnvelope);
    expect(validation.valid).toBe(true);
    expect(validation.isLegacy).toBe(true);
    expect(validation.project?.format).toBe('cordsbox-project');
    expect(validation.project?.instances.length).toBe(1);

    const importRes = importProjectFromCordsBox(legacyEnvelope);
    expect(importRes.valid).toBe(true);
    expect(useCanvasStore.getState().instances.length).toBe(1);
  });

  it('should reject invalid or corrupt JSON payloads with descriptive errors', () => {
    const invalidNull = validateCordsBoxFile(null);
    expect(invalidNull.valid).toBe(false);
    expect(invalidNull.errors.length).toBeGreaterThan(0);

    const invalidEmpty = validateCordsBoxFile({});
    expect(invalidEmpty.valid).toBe(false);

    const corruptV2 = validateCordsBoxFile({
      format: 'cordsbox-project',
      metadata: { title: 123 }, // invalid type
      instances: 'not an array',
    });
    expect(corruptV2.valid).toBe(false);
    expect(corruptV2.errors.length).toBeGreaterThan(0);
  });
});
