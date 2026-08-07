/**
 * wdfNodes.ts — Wave Digital Filter (WDF) Primitives
 *
 * Implements core WDF elements for passive guitar circuit simulation (FR-3/NFR-4):
 * - One-port elements: Resistor, Capacitor, Inductor, Potentiometer, VoltageSource
 * - Three-port adaptors: SeriesAdaptor, ParallelAdaptor
 *
 * Wave variables:
 *   a = incident wave = V + I * R
 *   b = reflected wave = V - I * R
 */

export interface WdfElement {
  /** Port resistance R in ohms */
  portResistance: number;
  /** Compute reflected wave b from incident wave a */
  waveReflect(a: number): number;
  /** Update internal state for next sample step (sample rate T = 1 / fs) */
  step(a: number): void;
  /** Reset internal state variables to zero */
  reset(): void;
}

/**
 * Ideal WDF Resistor
 * b = 0 (no reflection when port resistance equals R)
 */
export class WdfResistor implements WdfElement {
  public portResistance: number;

  constructor(resistance: number) {
    this.portResistance = Math.max(0.001, resistance);
  }

  waveReflect(_a: number): number {
    return 0;
  }

  step(_a: number): void {}

  reset(): void {}
}

/** WDF Voltage Source + Resistor: models a pickup generating voltage Vs */
export class WdfVoltageSourceResistor implements WdfElement {
  public portResistance: number;
  private Vs: number;

  constructor(resistance: number) {
    this.portResistance = Math.max(0.001, resistance);
    this.Vs = 0;
  }
  
  setVoltage(Vs: number) { this.Vs = Vs; }

  waveReflect(_a: number): number {
    return this.Vs;
  }

  step(_a: number): void {}

  reset(): void { this.Vs = 0; }
}

/**
 * WDF Potentiometer
 * Variable resistance R_pot = maxResistance * position
 */
export class WdfPotentiometer implements WdfElement {
  public portResistance: number;
  private maxResistance: number;

  constructor(maxResistance: number, initialPosition = 1.0) {
    this.maxResistance = maxResistance;
    this.portResistance = Math.max(0.001, maxResistance * Math.min(1.0, Math.max(0.0001, initialPosition)));
  }

  setPosition(position: number): void {
    const clampedPos = Math.min(1.0, Math.max(0.0001, position));
    this.portResistance = Math.max(0.001, this.maxResistance * clampedPos);
  }

  waveReflect(_a: number): number {
    return 0;
  }

  step(_a: number): void {}

  reset(): void {}
}

/**
 * WDF Capacitor (Bilinear transform discretization)
 * Port resistance R = T / (2 * C)
 * State equation: b[n] = state, state_next = a[n]
 */
export class WdfCapacitor implements WdfElement {
  public portResistance: number;
  private state = 0;

  constructor(capacitanceFarads: number, sampleRate = 48000) {
    const T = 1 / sampleRate;
    this.portResistance = T / (2 * Math.max(1e-12, capacitanceFarads));
  }

  waveReflect(_a: number): number {
    return this.state;
  }

  step(a: number): void {
    this.state = a;
  }

  reset(): void {
    this.state = 0;
  }
}

/**
 * WDF Inductor (Coil inductance)
 * Port resistance R = (2 * L) / T
 * State equation: b[n] = -state, state_next = a[n]
 */
export class WdfInductor implements WdfElement {
  public portResistance: number;
  private state = 0;

  constructor(inductanceHenries: number, sampleRate = 48000) {
    const T = 1 / sampleRate;
    this.portResistance = (2 * Math.max(1e-6, inductanceHenries)) / T;
  }

  waveReflect(_a: number): number {
    return -this.state;
  }

  step(a: number): void {
    this.state = a;
  }

  reset(): void {
    this.state = 0;
  }
}

/**
 * WDF 3-Port Series Adaptor
 * Connects 2 child elements in series to a parent port.
 */
export class WdfSeriesAdaptor implements WdfElement {
  public portResistance: number;
  private child1: WdfElement;
  private child2: WdfElement;
  private gamma1 = 0;
  private gamma2 = 0;

  constructor(child1: WdfElement, child2: WdfElement) {
    this.child1 = child1;
    this.child2 = child2;
    this.portResistance = child1.portResistance + child2.portResistance;
    this.updateGammas();
  }

  private updateGammas(): void {
    this.portResistance = this.child1.portResistance + this.child2.portResistance;
    this.gamma1 = this.child1.portResistance / this.portResistance;
    this.gamma2 = this.child2.portResistance / this.portResistance;
  }

  waveReflect(a: number): number {
    this.updateGammas();
    const b1 = this.child1.waveReflect(0);
    const b2 = this.child2.waveReflect(0);
    return -(b1 + b2);
  }

  step(a: number): void {
    this.updateGammas();
    const b1 = this.child1.waveReflect(0);
    const b2 = this.child2.waveReflect(0);
    const a1 = b1 - this.gamma1 * (b1 + b2 + a);
    const a2 = b2 - this.gamma2 * (b1 + b2 + a);
    this.child1.step(a1);
    this.child2.step(a2);
  }

  reset(): void {
    this.child1.reset();
    this.child2.reset();
  }
}

/**
 * WDF 3-Port Parallel Adaptor
 * Connects 2 child elements in parallel to a parent port.
 */
export class WdfParallelAdaptor implements WdfElement {
  public portResistance: number;
  private child1: WdfElement;
  private child2: WdfElement;
  private G1 = 0;
  private G2 = 0;

  constructor(child1: WdfElement, child2: WdfElement) {
    this.child1 = child1;
    this.child2 = child2;
    this.portResistance = 1 / (1 / child1.portResistance + 1 / child2.portResistance);
    this.updateGammas();
  }

  private updateGammas(): void {
    this.G1 = 1 / this.child1.portResistance;
    this.G2 = 1 / this.child2.portResistance;
    const G_total = this.G1 + this.G2;
    this.portResistance = 1 / G_total;
  }

  waveReflect(a: number): number {
    this.updateGammas();
    const b1 = this.child1.waveReflect(0);
    const b2 = this.child2.waveReflect(0);
    const G_total = this.G1 + this.G2 + 1 / this.portResistance;
    return (2 * (this.G1 * b1 + this.G2 * b2) / G_total);
  }

  step(a: number): void {
    this.updateGammas();
    const b1 = this.child1.waveReflect(0);
    const b2 = this.child2.waveReflect(0);
    const G_total = this.G1 + this.G2 + 1 / this.portResistance;
    const v = (2 * (this.G1 * b1 + this.G2 * b2 + (1 / this.portResistance) * a)) / G_total;
    this.child1.step(v - b1);
    this.child2.step(v - b2);
  }

  reset(): void {
    this.child1.reset();
    this.child2.reset();
  }
}
