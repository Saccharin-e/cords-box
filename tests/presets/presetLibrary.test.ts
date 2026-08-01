import { describe, it, expect, beforeEach } from 'vitest';
import { PRESETS, loadPreset, loadPresetById } from '../../src/presets/presetLibrary';
import { useCircuitStore } from '../../src/store/circuitStore';
import { useCanvasStore } from '../../src/store/canvasStore';

describe('Preset Circuit Library & Preset Loader', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();
  });

  it('should contain the Guitar Sound Test Bench template', () => {
    const testTemplate = PRESETS.find((p) => p.id === 'guitar_sound_test_template');
    expect(testTemplate).toBeDefined();
    expect(testTemplate?.name).toContain('Guitar Sound Test Bench');
    expect(testTemplate?.components.length).toBeGreaterThan(5);
    expect(testTemplate?.edges.length).toBeGreaterThan(5);
  });

  it('should load Guitar Sound Test Bench preset and solve signal paths reaching output jack', () => {
    const loaded = loadPresetById('guitar_sound_test_template');
    expect(loaded).toBe(true);

    const instances = useCanvasStore.getState().instances;
    expect(instances.length).toBe(9);

    const graph = useCircuitStore.getState().graph;
    expect(graph.getComponents().length).toBe(9);
    expect(graph.getNodes().length).toBeGreaterThan(15);

    const solverResult = useCircuitStore.getState().solverResult;
    expect(solverResult).not.toBeNull();
    expect(solverResult?.activePaths.length).toBeGreaterThan(0);

    const reachesOutput = solverResult?.activePaths.some((p) => p.reachesOutput);
    expect(reachesOutput).toBe(true);
  });

  it('should load Standard Telecaster preset using loadPreset and loadPresetById', () => {
    const loaded = loadPresetById('std_tele');
    expect(loaded).toBe(true);

    const preset = PRESETS.find((p) => p.id === 'std_tele');
    if (preset) loadPreset(preset);

    const instances = useCanvasStore.getState().instances;
    expect(instances.length).toBe(7);

    const solverResult = useCircuitStore.getState().solverResult;
    expect(solverResult?.activePaths.length).toBeGreaterThan(0);
  });

  it('should load Indie-Rock Telecaster preset and solve active signal paths', () => {
    const loaded = loadPresetById('indie_rock_tele');
    expect(loaded).toBe(true);

    const solverResult = useCircuitStore.getState().solverResult;
    expect(solverResult).not.toBeNull();
    expect(solverResult?.activePaths.length).toBeGreaterThan(0);
    expect(solverResult?.activePaths.some((p) => p.reachesOutput)).toBe(true);
  });
});
