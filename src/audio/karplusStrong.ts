/**
 * karplusStrong.ts — Pure Karplus-Strong physical string renderer
 *
 * Renders a plucked-string buffer with no Web Audio dependency so the string
 * physics can be unit-tested and reused by any audio sink:
 *
 * - Short raised-cosine pick pulse (a real pick is a ~1 ms shaped impulse,
 *   not a full-period noise fill, which is what made the old synth "ping").
 * - Frequency-dependent sustain: low strings ring several seconds, high
 *   strings die sooner, and upper partials decay faster than the fundamental
 *   (the loop lowpass cutoff tracks the pitch and drifts down over time).
 * - Pick-position comb on the excitation plus a pickup-sensing comb whose
 *   delay is a fraction of the string period, cancelling the harmonics that
 *   have a node at the pickup — the physical reason pickups differ by position.
 */

export interface KarplusStrongOptions {
  /** Pick contact point along the string, 0..1 measured from the bridge. Default 0.35. */
  pickPosition?: number;
  /** Pickup sensing position along the string, 0..1 measured from the bridge. Default 0.18 (bridge pickup). */
  pickupPosition?: number;
  /** Rendered buffer length in seconds. Default 8. */
  duration?: number;
  /** Palm-mute style short, dull note. Default false. */
  muted?: boolean;
  /** String index (0–5, low-E to high-E) for per-string dispersion. Default 0. */
  stringIndex?: number;
}

const DEFAULT_PICK_POSITION = 0.35;
const DEFAULT_PICKUP_POSITION = 0.18;
const DEFAULT_DURATION = 8.0;
const DISPERSION_STAGES = 4;

/**
 * Decay time constant in seconds for a given pitch. Low strings ring far
 * longer than high ones, just like a real guitar.
 */
export function sustainSeconds(freq: number): number {
  return Math.min(8.0, Math.max(3.0, 3.0 + (110 / freq) * 4.5));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic PRNG (mulberry32) so rendered buffers are reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Per-string physical data for dispersion — standard 10-46 set, steel
const STRING_DIAMETERS_M = [0.001168, 0.000914, 0.000635, 0.000432, 0.000330, 0.000254];
const STRING_TENSIONS_N  = [77.8, 76.5, 81.8, 73.8, 68.5, 72.1];
const SCALE_LENGTH_M = 0.648;
const YOUNG_MODULUS_PA = 2.0e11;

function computeInharmonicity(stringIdx: number): number {
  const idx = Math.min(5, Math.max(0, stringIdx));
  const d = STRING_DIAMETERS_M[idx];
  const t = STRING_TENSIONS_N[idx];
  const l = SCALE_LENGTH_M;
  return (Math.PI * Math.PI * YOUNG_MODULUS_PA * d * d * d * d) / (64 * t * l * l);
}

export function renderKarplusStrong(
  freq: number,
  velocity: number,
  sampleRate: number,
  options: KarplusStrongOptions = {},
): Float32Array {
  const duration = options.duration ?? DEFAULT_DURATION;
  const pickPosition = clamp(options.pickPosition ?? DEFAULT_PICK_POSITION, 0.02, 0.98);
  const pickupPosition = clamp(options.pickupPosition ?? DEFAULT_PICKUP_POSITION, 0.02, 0.98);
  const muted = options.muted ?? false;
  const stringIndex = options.stringIndex ?? 0;

  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);

  const N = Math.max(8, Math.round(sampleRate / freq));
  const sustain = muted ? 0.15 : sustainSeconds(freq);
  // Amplitude keeps 1/e of its energy every `sustain` seconds regardless of pitch.
  const decay = Math.exp(-1 / (sustain * sampleRate));

  // Thin strings snap brighter; hard picks snap brighter than soft ones.
  const brightness = clamp(Math.sqrt(freq / 220) * (0.75 + 0.5 * velocity), 0.55, 1.35);

  // ── 1. Pick excitation: a short raised-cosine pulse (0.35–1.05 ms), not a
  // full-period noise fill. The pulse width carries the "pick" character.
  const pickLen = clamp(Math.round(sampleRate * (0.35e-3 + 0.7e-3 * velocity)), 24, 120);
  const rand = mulberry32(Math.floor(freq * 1000));
  const pickDelay = Math.max(1, Math.round(N * pickPosition));

  const excitation = new Float32Array(N);
  let prevNoise = 0;
  for (let i = 0; i < Math.min(pickLen, N); i++) {
    // Slightly skewed envelope: the pick bites fast and releases slowly.
    const u = i / (pickLen - 1);
    const window = (0.5 - 0.5 * Math.cos(2 * Math.PI * u)) * (1 - 0.35 * u);
    const noise = rand() * 2 - 1;
    const smoothed = prevNoise * 0.2 + noise * 0.8;
    prevNoise = smoothed;
    const click = i === 0 ? 0.12 * velocity * brightness : 0;
    excitation[i] = (smoothed * 0.72 + click) * window * velocity * brightness;
  }

  // Plectrum release differential: the initial string shape has a kink at the
  // pick position, suppressing the harmonics that have a node there.
  for (let i = 0; i < N; i++) {
    const delayed = i >= pickDelay ? excitation[i - pickDelay] : 0;
    data[i] = (excitation[i] - 0.72 * delayed) * 0.95;
  }

  // ── 2. Waveguide loop: fractional delay, 4-stage dispersion all-pass cascade,
  // damping LPF with gain compensation.
  //
  // Dispersion: derived from per-string Fletcher inharmonicity coefficient B.
  // Low E (wound, thick) gets more dispersion than high E (plain, thin).
  const bInharm = computeInharmonicity(stringIndex);
  const bScaled = clamp(bInharm * 400, 0.0005, 0.025);
  const dispersionCoeff = muted ? 0.05 : bScaled;

  let currentTension = 0.015 * velocity;
  const tensionDecay = 0.99995;

  // 4-stage allpass dispersion state
  const apX1 = new Float64Array(DISPERSION_STAGES);
  const apY1 = new Float64Array(DISPERSION_STAGES);
  let lp1 = 0;

  // Group delay of 4-stage allpass at low frequency + damping filter
  const damping = muted ? 0.65 : clamp(0.08 + (freq / 3000) * 0.1, 0.05, 0.25);
  const allpassGroupDelay = DISPERSION_STAGES * ((1 + dispersionCoeff) / (1 - dispersionCoeff));
  const lpGroupDelay = damping / (1 - damping);
  const filterDelay = allpassGroupDelay + lpGroupDelay;

  for (let i = N + 1; i < length; i++) {
    const rawTargetN = sampleRate / (freq * (1 + currentTension));
    const targetN = Math.max(2, rawTargetN - filterDelay);
    const intN = Math.floor(targetN);
    const frac = targetN - intN;

    let delayedSample = 0;
    if (i - intN - 1 >= 0) {
      const s1 = data[i - intN];
      const s2 = data[i - intN - 1];
      delayedSample = s1 * (1 - frac) + s2 * frac;
    }

    // 4-stage first-order all-pass cascade: inharmonicity from string stiffness
    let apOut = delayedSample;
    for (let stage = 0; stage < DISPERSION_STAGES; stage++) {
      const output = -dispersionCoeff * apOut + apX1[stage] + dispersionCoeff * apY1[stage];
      apX1[stage] = apOut;
      apY1[stage] = output;
      apOut = output;
    }

    // Classic 1-pole Karplus-Strong loop filter
    lp1 = apOut * (1 - damping) + lp1 * damping;
    if (muted) lp1 *= 0.997;

    // Loop-filter gain compensation: compute |H(ω₀)| for the one-pole and
    // scale by 1/|H(ω₀)| so the fundamental is lossless through the filter.
    const w0 = 2 * Math.PI / targetN;
    const oneMinusD = 1 - damping;
    const magSq = (oneMinusD * oneMinusD) / (1 - 2 * damping * Math.cos(w0) + damping * damping);
    const compensation = Math.min(1.15, 1 / Math.sqrt(magSq));

    data[i] = lp1 * decay * compensation;

    currentTension *= tensionDecay;
  }

  // ── 3. Pickup-sensing comb: a pickup at position p cancels the harmonics
  // whose node falls exactly on it — y = x(t) − x(t − p·T) gives
  // |H| ∝ 2|sin(k·π·p)|, the true pickup position response.
  const combDelay = Math.max(1, Math.round(pickupPosition * N));
  for (let i = combDelay; i < length; i++) {
    data[i] = 0.5 * (data[i] - 0.4 * data[i - combDelay]);
  }

  return data;
}
