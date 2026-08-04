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

  it('should reset custom slot back to default template', () => {
    useSlotStore.getState().saveCurrentToSlot('slot_1', 'Modified Slot 1');
    expect(useSlotStore.getState().slots[0].isCustom).toBe(true);

    useSlotStore.getState().resetSlotToDefault('slot_1');
    expect(useSlotStore.getState().slots[0].isCustom).toBe(false);
  });
});
