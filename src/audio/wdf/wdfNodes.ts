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
  /**
   * Complete the downward pass and update state. Call immediately after one
   * waveReflect() pass, without mutating element parameters in between.
   */
  step(a: number): void;
  /** Reset internal state variables to zero */
  reset(): void;
}

const MIN_PORT_RESISTANCE = 0.001;

export type PotTaper = 'linear' | 'audio' | 'reverse_audio';

/** Map a logical knob position to its normalized resistive position. */
export function applyPotTaper(position: number, taper: PotTaper): number {
  const clamped = Math.min(1, Math.max(0, position));
  switch (taper) {
    case 'audio':
      return Math.pow(clamped, 2.5);
    case 'reverse_audio':
      return 1 - Math.pow(1 - clamped, 2.5);
    default:
      return clamped;
  }
}

/**
 * Ideal WDF Resistor
 * b = 0 (no reflection when port resistance equals R)
 */
export class WdfResistor implements WdfElement {
  public portResistance: number;

  constructor(resistance: number) {
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistance);
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
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistance);
    this.Vs = 0;
  }

  setVoltage(Vs: number) {
    this.Vs = Vs;
  }

  waveReflect(_a: number): number {
    return this.Vs;
  }

  step(_a: number): void {}

  reset(): void {
    this.Vs = 0;
  }
}

/**
 * WDF Potentiometer
 * Variable resistance R_pot = maxResistance * taperFn(position)
 *
 * Taper types:
 *   'linear'        — R = maxR × pos          (B-taper, typical tone pots)
 *   'audio'         — R = maxR × pos^2.5        (A-taper, typical volume pots)
 *   'reverse_audio' — R = maxR × (1-(1-pos)^2.5)  (C-taper, some treble pots)
 */
export class WdfPotentiometer implements WdfElement {
  public portResistance: number;
  private maxResistance: number;
  private position: number;
  private taper: PotTaper;

  constructor(maxResistance: number, initialPosition = 1.0, taper: PotTaper = 'linear') {
    this.maxResistance = Math.max(MIN_PORT_RESISTANCE, maxResistance);
    this.position = Math.min(1, Math.max(0, initialPosition));
    this.taper = taper;
    this.portResistance = this.resistanceAtCurrentPosition();
  }

  setPosition(position: number): void {
    this.position = Math.min(1, Math.max(0, position));
    this.portResistance = this.resistanceAtCurrentPosition();
  }

  setTaper(taper: PotTaper): void {
    this.taper = taper;
    this.portResistance = this.resistanceAtCurrentPosition();
  }

  private resistanceAtCurrentPosition(): number {
    return Math.max(
      MIN_PORT_RESISTANCE,
      this.maxResistance * applyPotTaper(this.position, this.taper),
    );
  }

  waveReflect(_a: number): number {
    return 0;
  }

  step(_a: number): void {}

  reset(): void {}
}

/**
 * Transparent one-port wrapper that exposes the child's terminal voltage.
 * The value is updated on the downward (incident-wave) pass.
 */
export class WdfVoltageProbe implements WdfElement {
  public portResistance: number;
  public voltage = 0;
  private child: WdfElement;
  private reflectedWave = 0;

  constructor(child: WdfElement) {
    this.child = child;
    this.portResistance = child.portResistance;
  }

  waveReflect(a: number): number {
    this.reflectedWave = this.child.waveReflect(a);
    this.portResistance = this.child.portResistance;
    return this.reflectedWave;
  }

  step(a: number): void {
    this.voltage = (a + this.reflectedWave) * 0.5;
    this.child.step(a);
  }

  reset(): void {
    this.child.reset();
    this.reflectedWave = 0;
    this.voltage = 0;
  }
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
 *
 * Optimizations over naive implementation:
 *   - Cached reflected waves: waveReflect() stores b1/b2, step() reuses them.
 *   - Dirty-flag gammas: port resistances are only recomputed when children change.
 */
export class WdfSeriesAdaptor implements WdfElement {
  public portResistance: number;
  private child1: WdfElement;
  private child2: WdfElement;
  private gamma1 = 0;
  private gamma2 = 0;
  /** Cached child reflected waves from last waveReflect() call */
  private _b1 = 0;
  private _b2 = 0;
  /** Last-seen child port resistances for dirty detection */
  private _lastR1 = 0;
  private _lastR2 = 0;

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
    this._lastR1 = this.child1.portResistance;
    this._lastR2 = this.child2.portResistance;
  }

  private ensureGammas(): void {
    if (
      this.child1.portResistance !== this._lastR1 ||
      this.child2.portResistance !== this._lastR2
    ) {
      this.updateGammas();
    }
  }

  waveReflect(_a: number): number {
    this._b1 = this.child1.waveReflect(0);
    this._b2 = this.child2.waveReflect(0);
    // Child-first traversal propagates nested resistance changes to the root
    // in this same upward pass.
    this.ensureGammas();
    return -(this._b1 + this._b2);
  }

  step(a: number): void {
    // Reuse cached b1, b2 from waveReflect() — no redundant child traversal
    const a1 = this._b1 - this.gamma1 * (this._b1 + this._b2 + a);
    const a2 = this._b2 - this.gamma2 * (this._b1 + this._b2 + a);
    this.child1.step(a1);
    this.child2.step(a2);
  }

  reset(): void {
    this.child1.reset();
    this.child2.reset();
    this._b1 = 0;
    this._b2 = 0;
  }
}

/**
 * Adapted N-port series junction used when several complete pickup branches
 * are wired in series. Keeping each branch intact preserves heterogeneous
 * winding capacitance and resonance instead of collapsing them into a single
 * approximate R/L/C equivalent.
 */
export class WdfSeriesNAdaptor implements WdfElement {
  public portResistance = MIN_PORT_RESISTANCE;
  private readonly children: WdfElement[];
  private readonly gammas: Float64Array;
  private readonly reflectedWaves: Float64Array;
  private readonly lastResistances: Float64Array;
  private reflectedSum = 0;

  constructor(children: WdfElement[]) {
    if (children.length === 0) {
      throw new Error('WdfSeriesNAdaptor requires at least one child');
    }
    this.children = children.slice();
    this.gammas = new Float64Array(children.length);
    this.reflectedWaves = new Float64Array(children.length);
    this.lastResistances = new Float64Array(children.length);
    this.updateGammas();
  }

  private updateGammas(): void {
    let resistanceSum = 0;
    for (let i = 0; i < this.children.length; i++) {
      resistanceSum += this.children[i].portResistance;
    }
    this.portResistance = Math.max(MIN_PORT_RESISTANCE, resistanceSum);
    for (let i = 0; i < this.children.length; i++) {
      const resistance = this.children[i].portResistance;
      this.gammas[i] = resistance / this.portResistance;
      this.lastResistances[i] = resistance;
    }
  }

  private ensureGammas(): void {
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i].portResistance !== this.lastResistances[i]) {
        this.updateGammas();
        return;
      }
    }
  }

  waveReflect(_a: number): number {
    let sum = 0;
    for (let i = 0; i < this.children.length; i++) {
      const reflected = this.children[i].waveReflect(0);
      this.reflectedWaves[i] = reflected;
      sum += reflected;
    }
    this.ensureGammas();
    this.reflectedSum = sum;
    return -sum;
  }

  step(a: number): void {
    const junctionWave = this.reflectedSum + a;
    for (let i = 0; i < this.children.length; i++) {
      const incident = this.reflectedWaves[i] - this.gammas[i] * junctionWave;
      this.children[i].step(incident);
    }
  }

  reset(): void {
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].reset();
      this.reflectedWaves[i] = 0;
    }
    this.reflectedSum = 0;
  }
}

/**
 * WDF 3-Port Parallel Adaptor
 * Connects 2 child elements in parallel to a parent port.
 *
 * Uses the adapted WDF parallel-junction scattering equations:
 *   γi = Gi / (G1 + G2)
 *   b0 = γ1·b1 + γ2·b2
 *   ai = a0 + b0 − bi
 */
export class WdfParallelAdaptor implements WdfElement {
  public portResistance: number;
  private child1: WdfElement;
  private child2: WdfElement;
  private gamma1 = 0;
  private gamma2 = 0;
  /** Cached child reflected waves from last waveReflect() call */
  private _b1 = 0;
  private _b2 = 0;
  /** Cached parent reflected wave */
  private _b0 = 0;
  /** Last-seen child port resistances for dirty detection */
  private _lastR1 = 0;
  private _lastR2 = 0;

  constructor(child1: WdfElement, child2: WdfElement) {
    this.child1 = child1;
    this.child2 = child2;
    this.portResistance = 1 / (1 / child1.portResistance + 1 / child2.portResistance);
    this.updateGammas();
  }

  private updateGammas(): void {
    const G1 = 1 / this.child1.portResistance;
    const G2 = 1 / this.child2.portResistance;
    const Gsum = G1 + G2;
    this.portResistance = 1 / Gsum;
    this.gamma1 = G1 / Gsum;
    this.gamma2 = G2 / Gsum;
    this._lastR1 = this.child1.portResistance;
    this._lastR2 = this.child2.portResistance;
  }

  private ensureGammas(): void {
    if (
      this.child1.portResistance !== this._lastR1 ||
      this.child2.portResistance !== this._lastR2
    ) {
      this.updateGammas();
    }
  }

  waveReflect(_a: number): number {
    this._b1 = this.child1.waveReflect(0);
    this._b2 = this.child2.waveReflect(0);
    // Child-first traversal propagates nested resistance changes to the root
    // in this same upward pass.
    this.ensureGammas();
    // Standard Fettweis parallel adaptor: b0 = gamma1 * b1 + gamma2 * b2
    this._b0 = this.gamma1 * this._b1 + this.gamma2 * this._b2;
    return this._b0;
  }

  step(a: number): void {
    // a1 = b0 + a - b1, a2 = b0 + a - b2
    const v = this._b0 + a;
    this.child1.step(v - this._b1);
    this.child2.step(v - this._b2);
  }

  reset(): void {
    this.child1.reset();
    this.child2.reset();
    this._b1 = 0;
    this._b2 = 0;
    this._b0 = 0;
  }
}
