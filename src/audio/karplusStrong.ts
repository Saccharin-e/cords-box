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
}

const DEFAULT_PICK_POSITION = 0.35;
const DEFAULT_PICKUP_POSITION = 0.18;
const DEFAULT_DURATION = 8.0;

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

  const length = Math.floor(sampleRate * duration);
  const data = new Float32Array(length);

  const N = Math.max(8, Math.round(sampleRate / freq));
  const sustain = muted ? 0.5 : sustainSeconds(freq);
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

  // ── 2. Waveguide loop: fractional delay, dispersion all-pass, damping LPF.
  // The loop filter's cutoff tracks the fundamental (≈14·f0) so every string
  // gets a guitar-like harmonic-loss profile: the 2nd–3rd partials ring for
  // seconds, partials 4–6 thin out over ~1 s, and everything above is attack
  // transient only. Guitar strings are nearly harmonic (unlike bells), so the
  // stiffness all-pass stays tiny.
  const stiffness = muted ? 0.05 : freq < 200 ? 0.012 : 0.006;
  const fc0 = clamp((muted ? 5 : 14) * freq + 300, muted ? 400 : 1500, muted ? 2000 : 5500);

  // The loop filter's skirt would shave ~0.5–1.5% per cycle off the
  // fundamental (a two-stage lowpass a few hundred Hz above f0 is not flat
  // there), silently shortening bass sustain. Measure the cascade gain at the
  // loop frequency and compensate so the fundamental is lossless in the
  // filter; upper partials still roll off as designed.

  let currentTension = 0.015 * velocity;
  const tensionDecay = 0.99995;

  let allpassX1 = 0;
  let allpassY1 = 0;
  let lp1 = 0;
  let lp2 = 0;

  for (let i = N + 1; i < length; i++) {
    const targetN = sampleRate / (freq * (1 + currentTension));
    const intN = Math.floor(targetN);
    const frac = targetN - intN;

    let delayedSample = 0;
    if (i - intN - 1 >= 0) {
      const s1 = data[i - intN];
      const s2 = data[i - intN - 1];
      delayedSample = s1 * (1 - frac) + s2 * frac;
    }

    // First-order all-pass: slight inharmonicity from string stiffness.
    const allpassOut = -stiffness * delayedSample + allpassX1 + stiffness * allpassY1;
    allpassX1 = delayedSample;
    allpassY1 = allpassOut;

    // Two-stage one-pole lowpass with a cutoff that darkens as the note
    // settles: the attack stays bright, then the body warms over the first
    // third of the sustain instead of ringing like a bell.
    const elapsed = i - N;
    const darken = 1 - 0.55 * Math.min(1, elapsed / (0.35 * sustain * sampleRate));
    const fc = Math.max(freq * 8, fc0 * darken); // Never choke the fundamental
    const a = Math.exp((-2 * Math.PI * fc) / sampleRate);
    const oneMinusA = 1 - a;

    lp1 = allpassOut * oneMinusA + lp1 * a;
    lp2 = lp1 * oneMinusA + lp2 * a;

    data[i] = lp2 * decay;

    currentTension *= tensionDecay;
  }

  // ── 3. Pickup-sensing comb: a pickup at position p cancels the harmonics
  // whose node falls exactly on it — y = x(t) − x(t − 2·p·T) gives
  // |H| ∝ 2|sin(k·π·p)|, the true pickup position response.
  const combDelay = Math.max(1, Math.round(2 * pickupPosition * N));
  for (let i = combDelay; i < length; i++) {
    data[i] = 0.5 * (data[i] - 0.9 * data[i - combDelay]);
  }

  return data;
}
