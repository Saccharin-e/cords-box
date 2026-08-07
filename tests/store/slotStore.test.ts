import { describe, it, expect, beforeEach } from 'vitest';
import { useSlotStore } from '../../src/store/slotStore';
import { useCanvasStore } from '../../src/store/canvasStore';
import { useCircuitStore } from '../../src/store/circuitStore';

describe('SlotStore Layout Manager', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();
  });

  it('should initialize with 6 layout slots', () => {
    const slots = useSlotStore.getState().slots;
    expect(slots).toHaveLength(6);
    expect(slots[0].slotId).toBe('slot_1');
    expect(slots[5].slotId).toBe('slot_6');
  });

  it('should allow loading a default template slot onto the canvas', () => {
    const success = useSlotStore.getState().loadSlot('slot_1');
    expect(success).toBe(true);

    const instances = useCanvasStore.getState().instances;
    expect(instances.length).toBeGreaterThan(0);
    expect(useSlotStore.getState().activeSlotId).toBe('slot_1');
  });

  it('should save the current canvas state into a custom slot', () => {
    // Add a component to canvas
    useCanvasStore.getState().addInstance({
      id: 'pickup_test_1',
      type: 'pickup_single_coil',
      label: 'Test Pickup',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
    });

    useSlotStore.getState().saveCurrentToSlot('slot_4', 'My Custom Harness');

    const slots = useSlotStore.getState().slots;
    const slot4 = slots.find((s) => s.slotId === 'slot_4');

    expect(slot4).toBeDefined();
    expect(slot4?.name).toBe('My Custom Harness');
    expect(slot4?.isCustom).toBe(true);
    expect(slot4?.data.instances).toHaveLength(1);
  });

  it('should allow renaming a layout slot', () => {
    useSlotStore.getState().renameSlot('slot_5', 'Indie Rock Setup');
    const slot5 = useSlotStore.getState().slots.find((s) => s.slotId === 'slot_5');
    expect(slot5?.name).toBe('Indie Rock Setup');
  });

  it('should save and reload custom wires/edges correctly', () => {
    // 1. Add components
    const c1 = { id: 'pickup_1', type: 'pickup_single_coil' as const, label: 'P1', x: 100, y: 100, width: 100, height: 60 };
    const c2 = { id: 'jack_1', type: 'output_jack' as const, label: 'J1', x: 300, y: 100, width: 60, height: 60 };
    useCanvasStore.getState().addInstance(c1);
    useCanvasStore.getState().addInstance(c2);
    useCircuitStore.getState().addComponent(c1);
    useCircuitStore.getState().addComponent(c2);

    // 2. Add wire
    useCircuitStore.getState().addEdge({
      id: 'wire_123',
      source: 'pickup_1_hot',
      target: 'jack_1_tip',
      resistance: 0,
      wireColor: '#ff8c00',
    });

    // 3. Save to slot
    useSlotStore.getState().saveCurrentToSlot('slot_4', 'Wire Test Slot');
    const slot4 = useSlotStore.getState().slots.find((s) => s.slotId === 'slot_4');
    expect(slot4?.data.edges).toHaveLength(1);

    // 4. Clear state & load slot
    useCanvasStore.getState().resetCanvas();
    useCircuitStore.getState().reset();
    expect(useCircuitStore.getState().graph.getEdges()).toHaveLength(0);

    const loaded = useSlotStore.getState().loadSlot('slot_4');
    expect(loaded).toBe(true);
    expect(useCircuitStore.getState().graph.getEdges()).toHaveLength(1);
    expect(useCircuitStore.getState().graph.getEdges()[0].id).toBe('wire_123');
  });
});
