import { describe, it, expect } from 'vitest';
import {
  type WdfElement,
  WdfResistor,
  WdfCapacitor,
  WdfPotentiometer,
  WdfSeriesAdaptor,
  WdfSeriesNAdaptor,
  WdfParallelAdaptor,
  WdfVoltageProbe,
} from '@audio/wdf/wdfNodes';

class FixedWaveElement implements WdfElement {
  public reflectCalls = 0;
  public incidentWaves: number[] = [];
  public portResistance: number;
  private reflectedWave: number;

  constructor(portResistance: number, reflectedWave: number) {
    this.portResistance = portResistance;
    this.reflectedWave = reflectedWave;
  }

  waveReflect(): number {
    this.reflectCalls++;
    return this.reflectedWave;
  }

  step(a: number): void {
    this.incidentWaves.push(a);
  }

  reset(): void {
    this.reflectCalls = 0;
    this.incidentWaves = [];
  }
}

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
    const expectedR = 1 / 48000 / (2 * 47e-9);
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

  it('should support audio and reverse audio potentiometer tapers', () => {
    const potLinear = new WdfPotentiometer(500000, 0.5, 'linear');
    expect(potLinear.portResistance).toBeCloseTo(250000, 1);

    const potAudio = new WdfPotentiometer(500000, 0.5, 'audio');
    // 0.5^2.5 ≈ 0.17678 -> 500k * 0.17678 ≈ 88388
    expect(potAudio.portResistance).toBeCloseTo(88388, -1);

    const potRevAudio = new WdfPotentiometer(500000, 0.5, 'reverse_audio');
    // 1 - (1-0.5)^2.5 ≈ 0.82322 -> 500k * 0.82322 ≈ 411612
    expect(potRevAudio.portResistance).toBeCloseTo(411612, -1);

    // Dynamic position change with taper
    potAudio.setPosition(0.8);
    // 0.8^2.5 ≈ 0.57244 -> 500k * 0.57244 ≈ 286217
    expect(potAudio.portResistance).toBeCloseTo(286217, -1);

    potLinear.setTaper('audio');
    expect(potLinear.portResistance).toBeCloseTo(88388, -1);

    potLinear.setPosition(0);
    expect(potLinear.portResistance).toBe(0.001);
  });

  it('caches child reflections for the series down pass and scatters exact waves', () => {
    const child1 = new FixedWaveElement(100, 2);
    const child2 = new FixedWaveElement(300, -1);
    const series = new WdfSeriesAdaptor(child1, child2);

    expect(series.waveReflect(0.5)).toBe(-1);
    series.step(0.5);

    expect(child1.reflectCalls).toBe(1);
    expect(child2.reflectCalls).toBe(1);
    expect(child1.incidentWaves[0]).toBeCloseTo(1.625, 12);
    expect(child2.incidentWaves[0]).toBeCloseTo(-2.125, 12);
  });

  it('caches child reflections for the parallel down pass and scatters exact waves', () => {
    const child1 = new FixedWaveElement(100, 2);
    const child2 = new FixedWaveElement(300, -1);
    const parallel = new WdfParallelAdaptor(child1, child2);

    expect(parallel.waveReflect(0.5)).toBeCloseTo(1.25, 12);
    parallel.step(0.5);

    expect(child1.reflectCalls).toBe(1);
    expect(child2.reflectCalls).toBe(1);
    expect(child1.incidentWaves[0]).toBeCloseTo(-0.25, 12);
    expect(child2.incidentWaves[0]).toBeCloseTo(2.75, 12);
  });

  it('scatters an arbitrary number of heterogeneous series branches exactly', () => {
    const child1 = new FixedWaveElement(100, 2);
    const child2 = new FixedWaveElement(200, -1);
    const child3 = new FixedWaveElement(300, 0.5);
    const series = new WdfSeriesNAdaptor([child1, child2, child3]);

    expect(series.portResistance).toBe(600);
    expect(series.waveReflect(0)).toBe(-1.5);
    series.step(0.75);

    const junctionWave = 2 - 1 + 0.5 + 0.75;
    expect(child1.incidentWaves[0]).toBeCloseTo(2 - (100 / 600) * junctionWave, 12);
    expect(child2.incidentWaves[0]).toBeCloseTo(-1 - (200 / 600) * junctionWave, 12);
    expect(child3.incidentWaves[0]).toBeCloseTo(0.5 - (300 / 600) * junctionWave, 12);
    expect(child1.reflectCalls).toBe(1);
    expect(child2.reflectCalls).toBe(1);
    expect(child3.reflectCalls).toBe(1);
  });

  it('propagates a nested pot resistance change to every ancestor in one reflection', () => {
    const pot = new WdfPotentiometer(100000, 1.0, 'linear');
    const r = new WdfResistor(100000);
    const innerSeries = new WdfSeriesAdaptor(pot, r);
    const outerParallel = new WdfParallelAdaptor(innerSeries, new WdfResistor(100000));

    expect(innerSeries.portResistance).toBe(200000);
    expect(outerParallel.portResistance).toBeCloseTo(200000 / 3, 8);

    pot.setPosition(0.5);
    outerParallel.waveReflect(0);

    expect(innerSeries.portResistance).toBe(150000);
    expect(outerParallel.portResistance).toBeCloseTo(60000, 8);
  });

  it('reports a probed terminal voltage from the cached up/down pass', () => {
    const child = new FixedWaveElement(100, 0.25);
    const probe = new WdfVoltageProbe(child);

    expect(probe.waveReflect(0)).toBe(0.25);
    probe.step(0.75);

    expect(probe.voltage).toBe(0.5);
    expect(child.incidentWaves).toEqual([0.75]);
  });
});
