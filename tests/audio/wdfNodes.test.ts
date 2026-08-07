import { describe, it, expect } from 'vitest';
import {
  WdfResistor,
  WdfCapacitor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfParallelAdaptor,
} from '@audio/wdf/wdfNodes';

describe('WDF Engine Primitives', () => {
  it('should calculate resistor port resistance and zero reflection', () => {
    const r = new WdfResistor(250000);
    expect(r.portResistance).toBe(250000);
    expect(r.waveReflect(1.0)).toBe(0);
  });

  it('should calculate potentiometer port resistance dynamically', () => {
    const pot = new WdfPotentiometer(500000, 0.5);
    expect(pot.portResistance).toBe(250000);

    pot.setPosition(0.2);
    expect(pot.portResistance).toBe(100000);
  });

  it('should calculate capacitor port resistance for bilinear transform', () => {
    const cap = new WdfCapacitor(47e-9, 48000); // 0.047 uF tone cap
    const expectedR = (1 / 48000) / (2 * 47e-9);
    expect(cap.portResistance).toBeCloseTo(expectedR, 1);
  });

  it('should calculate series adaptor port resistance as sum of children', () => {
    const r1 = new WdfResistor(100);
    const r2 = new WdfResistor(200);
    const series = new WdfSeriesAdaptor(r1, r2);

    expect(series.portResistance).toBe(300);
  });

  it('should calculate parallel adaptor port resistance as parallel combination', () => {
    const r1 = new WdfResistor(100);
    const r2 = new WdfResistor(100);
    const parallel = new WdfParallelAdaptor(r1, r2);

    expect(parallel.portResistance).toBe(50);
  });
});
