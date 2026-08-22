use wasm_bindgen::prelude::*;

const MAX_STRINGS: usize = 6;
const BUFFER_SIZE: usize = 4096;
const OUTPUT_RING_SIZE: usize = 4096;
const DISPERSION_STAGES: usize = 4;

// Per-string physical data for dispersion (standard 10-46 set, steel)
// Diameters in meters, tensions in Newtons
const STRING_DIAMETERS_M: [f32; 6] = [
    0.001168, // low E  (0.046")
    0.000914, // A      (0.036")
    0.000635, // D      (0.025")
    0.000432, // G      (0.017")
    0.000330, // B      (0.013")
    0.000254, // high E (0.010")
];
const STRING_TENSIONS_N: [f32; 6] = [
    77.8,  // low E
    76.5,  // A
    81.8,  // D
    73.8,  // G
    68.5,  // B
    72.1,  // high E
];
const SCALE_LENGTH_M: f32 = 0.648; // 25.5" standard Fender scale
const YOUNG_MODULUS_PA: f32 = 2.0e11; // steel

/// Compute the Fletcher inharmonicity coefficient B for a given string
fn compute_inharmonicity(string_idx: usize) -> f32 {
    let idx = if string_idx < 6 { string_idx } else { 0 };
    let d = STRING_DIAMETERS_M[idx];
    let t = STRING_TENSIONS_N[idx];
    let l = SCALE_LENGTH_M;
    // B = π² · E · d⁴ / (64 · T · L²)
    let d4 = d * d * d * d;
    let b = std::f32::consts::PI * std::f32::consts::PI * YOUNG_MODULUS_PA * d4
        / (64.0 * t * l * l);
    b
}

struct DispersionFilter {
    x1: [f32; DISPERSION_STAGES],
    y1: [f32; DISPERSION_STAGES],
}

impl DispersionFilter {
    fn new() -> Self {
        Self {
            x1: [0.0; DISPERSION_STAGES],
            y1: [0.0; DISPERSION_STAGES],
        }
    }

    fn reset(&mut self) {
        self.x1 = [0.0; DISPERSION_STAGES];
        self.y1 = [0.0; DISPERSION_STAGES];
    }

    fn process(&mut self, input: f32, coefficient: f32) -> f32 {
        let mut sample = input;
        for stage in 0..DISPERSION_STAGES {
            let output = -coefficient * sample + self.x1[stage] + coefficient * self.y1[stage];
            self.x1[stage] = sample;
            self.y1[stage] = output;
            sample = output;
        }
        sample
    }
}

/// 1st-order Thiran allpass fractional delay filter.
/// Provides maximally-flat group delay interpolation for waveguide pitch accuracy.
/// Transfer function: H(z) = (a₁ + z⁻¹) / (1 + a₁·z⁻¹)
/// where a₁ = (1 - d) / (1 + d) and d is the fractional delay in [0.1, 0.9].
struct ThiranState {
    y1: f32,
    x1: f32,
}

impl ThiranState {
    fn new() -> Self {
        Self { y1: 0.0, x1: 0.0 }
    }

    fn reset(&mut self) {
        self.y1 = 0.0;
        self.x1 = 0.0;
    }

    /// Process one sample through the Thiran allpass.
    /// `frac` is the fractional delay in (0, 1).
    #[inline(always)]
    fn process(&mut self, input: f32, frac: f32) -> f32 {
        // Clamp fractional delay to stable range [0.1, 0.9]
        let d = frac.clamp(0.1, 0.9);
        let a1 = (1.0 - d) / (1.0 + d);
        let output = a1 * input + self.x1 - a1 * self.y1;
        self.x1 = input;
        self.y1 = output;
        output
    }
}

struct GuitarString {
    delay_line_h: [f32; BUFFER_SIZE],
    delay_line_v: [f32; BUFFER_SIZE],
    write_idx_h: usize,
    write_idx_v: usize,
    
    pending_delay_line_h: [f32; BUFFER_SIZE],
    pending_delay_line_v: [f32; BUFFER_SIZE],
    pending_write_idx_h: usize,
    pending_write_idx_v: usize,

    prev_sample_h: f32,
    prev_sample_v: f32,
    pending_prev_sample_h: f32,
    pending_prev_sample_v: f32,

    base_delay_samples: f32,
    pending_base_delay_samples: f32,

    // Pitch glide state
    target_delay_samples: f32,
    glide_increment: f32, // samples-per-sample ramp rate
    is_gliding: bool,

    is_active: bool,
    decay: f32,
    pending_decay: f32,
    damping: f32,
    pending_damping: f32,
    dispersion_coeff: f32,
    pending_dispersion_coeff: f32,

    // 4-stage dispersion filters (one per polarization plane)
    dispersion_h: DispersionFilter,
    dispersion_v: DispersionFilter,
    pending_dispersion_h: DispersionFilter,
    pending_dispersion_v: DispersionFilter,

    // 1st-order Thiran allpass fractional delay state (one per polarization plane)
    thiran_h: ThiranState,
    thiran_v: ThiranState,
    pending_thiran_h: ThiranState,
    pending_thiran_v: ThiranState,

    // Output ring buffer for subtractive pickup comb
    output_ring: [f32; OUTPUT_RING_SIZE],
    output_ring_idx: usize,
    pickup_position: f32,

    amplitude_env: f32,
    pending_amplitude_env: f32,
    amplitude_decay: f32,
    pending_amplitude_decay: f32,
    release_decay: f32,
    pending_release_decay: f32,

    crossfade_position: usize,
    crossfade_length: usize,

    string_idx: usize,

    // Free-running PRNG state — each string has its own stream so
    // simultaneous plucks get decorrelated noise bursts.
    prng_state: u32,
}

impl GuitarString {
    fn new(prng_seed: u32) -> Self {
        Self {
            delay_line_h: [0.0; BUFFER_SIZE],
            delay_line_v: [0.0; BUFFER_SIZE],
            write_idx_h: 0,
            write_idx_v: 0,
            
            pending_delay_line_h: [0.0; BUFFER_SIZE],
            pending_delay_line_v: [0.0; BUFFER_SIZE],
            pending_write_idx_h: 0,
            pending_write_idx_v: 0,

            prev_sample_h: 0.0,
            prev_sample_v: 0.0,
            pending_prev_sample_h: 0.0,
            pending_prev_sample_v: 0.0,

            base_delay_samples: 0.0,
            pending_base_delay_samples: 0.0,

            target_delay_samples: 0.0,
            glide_increment: 0.0,
            is_gliding: false,

            is_active: false,
            decay: 0.9999,
            pending_decay: 0.9999,
            damping: 0.28,
            pending_damping: 0.28,
            dispersion_coeff: 0.002,
            pending_dispersion_coeff: 0.002,

            dispersion_h: DispersionFilter::new(),
            dispersion_v: DispersionFilter::new(),
            pending_dispersion_h: DispersionFilter::new(),
            pending_dispersion_v: DispersionFilter::new(),

            thiran_h: ThiranState::new(),
            thiran_v: ThiranState::new(),
            pending_thiran_h: ThiranState::new(),
            pending_thiran_v: ThiranState::new(),

            output_ring: [0.0; OUTPUT_RING_SIZE],
            output_ring_idx: 0,
            pickup_position: 0.15,

            amplitude_env: 0.0,
            pending_amplitude_env: 0.0,
            amplitude_decay: 0.99994,
            pending_amplitude_decay: 0.99994,
            release_decay: 1.0,
            pending_release_decay: 1.0,

            crossfade_position: 0,
            crossfade_length: 128,

            string_idx: 0,
            prng_state: prng_seed,
        }
    }

    /// Advance the per-string LCG PRNG and return a value in [0, 1).
    #[inline(always)]
    fn prng_next(&mut self) -> f32 {
        self.prng_state = self.prng_state.wrapping_mul(1664525).wrapping_add(1013904223);
        (self.prng_state as f32) / (std::u32::MAX as f32)
    }

    fn fill_excitation(
        &mut self,
        delay_line_h: &mut [f32; BUFFER_SIZE],
        delay_line_v: &mut [f32; BUFFER_SIZE],
        n: usize,
        velocity: f32,
        brightness: f32,
    ) {
        for i in 0..BUFFER_SIZE {
            delay_line_h[i] = 0.0;
            delay_line_v[i] = 0.0;
        }

        // Improved Pick Attack: Resonant noise burst.
        // The PRNG is the string's own free-running state — never reset per
        // pluck — so every call gets an independent noise sequence and pan.
        let burst_length = n;
        
        let mut filter_state = 0.0;
        let cutoff = (0.25 + brightness * 0.45).clamp(0.15, 0.95); // Lowpass coefficient

        // Pluck angle determines how energy splits between horizontal and vertical planes.
        // Because the PRNG advances continuously, each pluck gets a different angle.
        let pan = self.prng_next() * 0.4 + 0.3; // 0.3 to 0.7

        for i in 0..burst_length {
            let noise = self.prng_next() * 2.0 - 1.0;
            // 1-pole lowpass to simulate fleshy part of pick/finger
            filter_state += cutoff * (noise - filter_state);
            
            let pick_envelope = (1.0 - (i as f32 / burst_length as f32)).powf(1.8); // Snappier attack
            let click = if i < 10 { brightness * 0.5 * (1.0 - i as f32 / 10.0) } else { 0.0 };
            
            let sample = (filter_state * 0.9 + click) * pick_envelope * velocity;
            
            delay_line_h[i] = sample * pan;
            delay_line_v[i] = sample * (1.0 - pan);
        }
    }

    fn pluck(&mut self, freq: f32, velocity: f32, sample_rate: f32, string_idx: usize) {
        let brightness = (freq / 220.0).sqrt().clamp(0.6, 1.8);

        let frequency_loss = (freq / 1000.0) * 0.00004;
        let new_decay = (0.9999 - frequency_loss).clamp(0.99982, 0.9999);
        // Damping set to realistic values to tame upper harmonics (warm string rather than metallic pipe)
        let new_damping = (0.1 + (freq / 2000.0)).clamp(0.1, 0.4);
        
        // Dispersion derived from real string physics (Fletcher inharmonicity B)
        let b_inharm = compute_inharmonicity(string_idx);
        let b_scaled = (b_inharm * 400.0).clamp(0.0005, 0.025);
        let new_dispersion_coeff = b_scaled;

        // Group delay of 4-stage allpass at low frequency + damping filter
        let allpass_group_delay = (DISPERSION_STAGES as f32) * ((1.0 + new_dispersion_coeff) / (1.0 - new_dispersion_coeff));
        let lp_group_delay = new_damping / (1.0 - new_damping);
        let filter_delay = allpass_group_delay + lp_group_delay;

        let raw_delay_samples = sample_rate / freq;
        let new_delay_samples = (raw_delay_samples - filter_delay).clamp(2.0, (BUFFER_SIZE - 2) as f32);
        let n = raw_delay_samples.round() as usize;

        // Natural physical string decay is governed by the waveguide loop filter (self.decay).
        // Set amplitude_decay to 1.0 so notes sustain naturally without being artificially strangled.
        let new_amplitude_decay = 1.0;

        self.string_idx = string_idx;

        if self.is_active && self.amplitude_env > 0.001 {
            // fill_excitation needs &mut self for PRNG, but also writes to
            // pending delay lines.  We borrow the pending lines through raw
            // pointers to satisfy the borrow checker while keeping the PRNG
            // on self advancing.
            let pending_h = &mut self.pending_delay_line_h as *mut [f32; BUFFER_SIZE];
            let pending_v = &mut self.pending_delay_line_v as *mut [f32; BUFFER_SIZE];
            // SAFETY: pending_delay_line_{h,v} do not alias prng_state.
            unsafe {
                self.fill_excitation(
                    &mut *pending_h,
                    &mut *pending_v,
                    n,
                    velocity,
                    brightness,
                );
            }
            self.pending_write_idx_h = n % BUFFER_SIZE;
            self.pending_write_idx_v = n % BUFFER_SIZE;
            self.pending_prev_sample_h = 0.0;
            self.pending_prev_sample_v = 0.0;
            self.pending_base_delay_samples = new_delay_samples;
            self.pending_decay = new_decay;
            self.pending_damping = new_damping;
            self.pending_dispersion_coeff = new_dispersion_coeff;
            self.pending_dispersion_h.reset();
            self.pending_dispersion_v.reset();
            self.pending_thiran_h.reset();
            self.pending_thiran_v.reset();
            self.pending_amplitude_env = 1.0;
            self.pending_amplitude_decay = new_amplitude_decay;
            self.pending_release_decay = 1.0;
            self.crossfade_position = 0;
        } else {
            let main_h = &mut self.delay_line_h as *mut [f32; BUFFER_SIZE];
            let main_v = &mut self.delay_line_v as *mut [f32; BUFFER_SIZE];
            // SAFETY: delay_line_{h,v} do not alias prng_state.
            unsafe {
                self.fill_excitation(
                    &mut *main_h,
                    &mut *main_v,
                    n,
                    velocity,
                    brightness,
                );
            }
            self.write_idx_h = n % BUFFER_SIZE;
            self.write_idx_v = n % BUFFER_SIZE;
            self.prev_sample_h = 0.0;
            self.prev_sample_v = 0.0;
            self.base_delay_samples = new_delay_samples;
            self.decay = new_decay;
            self.damping = new_damping;
            self.dispersion_coeff = new_dispersion_coeff;
            self.dispersion_h.reset();
            self.dispersion_v.reset();
            self.thiran_h.reset();
            self.thiran_v.reset();
            self.amplitude_env = 1.0;
            self.amplitude_decay = new_amplitude_decay;
            self.release_decay = 1.0;
            self.crossfade_position = self.crossfade_length;
        }

        // Reset glide state on new pluck
        self.is_gliding = false;
        self.target_delay_samples = new_delay_samples;

        self.is_active = true;
    }

    /// Damp the string with an exponential decay envelope.
    /// amount in 0.0..=1.0:
    ///   0.0 -> gentle release (~180ms T60)
    ///   0.5 -> palm mute (~60ms T60)
    ///   1.0 -> hard dead-note stop (~15ms T60)
    fn damp(&mut self, amount: f32, sample_rate: f32) {
        if !self.is_active {
            return;
        }
        let clamped = amount.clamp(0.0, 1.0);
        let t60 = 0.015 + 0.165 * (1.0 - clamped).powf(1.2);
        let decay = (-6.907755 / (t60 * sample_rate)).exp();
        self.release_decay = decay;
        self.pending_release_decay = decay;
    }

    /// Start a pitch glide toward target_freq over duration_ms
    fn start_glide(&mut self, target_freq: f32, duration_ms: f32, sample_rate: f32) {
        let allpass_group_delay = (DISPERSION_STAGES as f32) * ((1.0 + self.dispersion_coeff) / (1.0 - self.dispersion_coeff));
        let lp_group_delay = self.damping / (1.0 - self.damping);
        let filter_delay = allpass_group_delay + lp_group_delay;
        let target = ((sample_rate / target_freq) - filter_delay).clamp(2.0, (BUFFER_SIZE - 2) as f32);
        self.target_delay_samples = target;
        let duration_samples = (duration_ms * sample_rate / 1000.0).max(1.0);
        let delta = target - self.base_delay_samples;
        self.glide_increment = delta / duration_samples;
        self.is_gliding = true;
    }

    /// Read from delay line using 1st-order Thiran allpass fractional delay.
    /// The integer part selects the delay line tap; the fractional part is
    /// interpolated by the Thiran allpass for maximally-flat group delay.
    fn read_delay_thiran(
        delay_line: &[f32; BUFFER_SIZE],
        write_idx: usize,
        delay_samples: f32,
        thiran: &mut ThiranState,
    ) -> f32 {
        // Ensure fractional delay stays in Thiran-stable range [0.1, 0.9].
        // If fract < 0.1, increase integer delay by 1 and adjust fract.
        let mut int_delay = delay_samples.floor() as usize;
        let mut fract = delay_samples.fract();
        if fract < 0.1 {
            int_delay = int_delay.saturating_sub(1);
            fract += 1.0;
            // fract is now in [1.0, 1.1] — the allpass will clamp to 0.9
        }

        let mut read_pos = write_idx as isize - int_delay as isize;
        while read_pos < 0 {
            read_pos += BUFFER_SIZE as isize;
        }
        let idx = read_pos as usize % BUFFER_SIZE;
        let tap = delay_line[idx];

        thiran.process(tap, fract)
    }

    /// Read from the output ring buffer at a fractional delay
    fn read_output_ring(&self, delay_samples: f32) -> f32 {
        let mut read_idx_float = (self.output_ring_idx as f32) - delay_samples - 1.0;
        while read_idx_float < 0.0 {
            read_idx_float += OUTPUT_RING_SIZE as f32;
        }
        let idx1 = read_idx_float.floor() as usize % OUTPUT_RING_SIZE;
        let idx2 = (idx1 + 1) % OUTPUT_RING_SIZE;
        let fract = read_idx_float.fract();
        self.output_ring[idx1] * (1.0 - fract) + self.output_ring[idx2] * fract
    }

    /// Compute loop-filter gain compensation at the fundamental frequency.
    /// The one-pole LPF H(z) = (1-d)/(1 - d*z^-1) has |H(w0)|^2 = (1-d)^2 / (1 - 2d*cos(w0) + d^2).
    /// We return 1/|H(w0)| so the fundamental is lossless through the filter.
    fn loop_filter_compensation(damping: f32, delay_samples: f32) -> f32 {
        if damping < 1e-6 || delay_samples < 1.0 {
            return 1.0;
        }
        let w0 = std::f32::consts::TAU / delay_samples;
        let cos_w0 = w0.cos();
        let one_minus_d = 1.0 - damping;
        let numerator = one_minus_d * one_minus_d;
        let denominator = 1.0 - 2.0 * damping * cos_w0 + damping * damping;
        if denominator < 1e-12 {
            return 1.0;
        }
        let mag = (numerator / denominator).sqrt();
        if mag < 0.01 {
            return 1.0; // safety cap
        }
        // Clamp compensation to avoid instability
        (1.0 / mag).clamp(1.0, 1.15)
    }

    #[inline(always)]
    fn compute_plane(
        delay_line: &mut [f32; BUFFER_SIZE],
        write_idx: &mut usize,
        prev_sample: &mut f32,
        delay_samples: f32,
        damping: f32,
        dispersion_coeff: f32,
        decay: f32,
        dispersion: &mut DispersionFilter,
        compensation: f32,
        thiran: &mut ThiranState,
    ) -> f32 {
        let current = Self::read_delay_thiran(delay_line, *write_idx, delay_samples, thiran);

        // Averaged loop filter models string damping
        let filtered = current * (1.0 - damping) + *prev_sample * damping;
        
        // 4-stage allpass dispersion cascade for stiff-string inharmonicity
        let loop_sample = dispersion.process(filtered, dispersion_coeff);
        
        // Apply gain compensation so fundamental is lossless, then decay
        let new_sample = loop_sample * decay * compensation;
        
        delay_line[*write_idx] = new_sample;
        *prev_sample = filtered;
        *write_idx = (*write_idx + 1) % BUFFER_SIZE;
        
        loop_sample
    }

    fn process_sample(&mut self) -> f32 {
        if !self.is_active {
            return 0.0;
        }

        // Pitch glide: ramp base_delay_samples toward target
        if self.is_gliding {
            let remaining = self.target_delay_samples - self.base_delay_samples;
            if remaining.abs() < self.glide_increment.abs().max(0.01) {
                self.base_delay_samples = self.target_delay_samples;
                self.is_gliding = false;
            } else {
                self.base_delay_samples += self.glide_increment;
            }
        }

        // 1. Dynamic Pitch Glide (Tension Modulation)
        // Tension is highest when amplitude is highest, reducing delay_samples (higher pitch)
        let tension_mod = self.amplitude_env * self.amplitude_env * 0.003; 
        
        // 2. Dual Polarization (Beating)
        // Vertical plane vibrates slightly faster due to bridge rigidity
        let delay_h = self.base_delay_samples * (1.0 - tension_mod);
        let delay_v = self.base_delay_samples * (1.0 - tension_mod) * 0.9985; // 0.15% pitch offset for beating

        // Compute loop-filter gain compensation at the fundamental
        let comp_h = Self::loop_filter_compensation(self.damping, delay_h);
        let comp_v = Self::loop_filter_compensation(self.damping, delay_v);

        let out_h = Self::compute_plane(
            &mut self.delay_line_h, &mut self.write_idx_h, &mut self.prev_sample_h,
            delay_h, self.damping, self.dispersion_coeff, self.decay,
            &mut self.dispersion_h, comp_h, &mut self.thiran_h,
        );

        let out_v = Self::compute_plane(
            &mut self.delay_line_v, &mut self.write_idx_v, &mut self.prev_sample_v,
            delay_v, self.damping, self.dispersion_coeff, self.decay * 0.999, // Vertical plane decays slightly faster
            &mut self.dispersion_v, comp_v, &mut self.thiran_v,
        );

        // 3. Mix dual planes with position-aware blend
        // Bridge pickup: more horizontal plane (0.85/0.15)
        // The pickup_position influences the mix slightly — closer to bridge = more H dominance
        let h_blend = 0.7 + self.pickup_position * 0.5; // 0.775 at pos=0.15, 0.85 at pos=0.30
        let raw_mix = (out_h * h_blend + out_v * (1.0 - h_blend)) * self.amplitude_env * 14.0;
        
        // 4. Subtractive pickup comb: y[n] = 0.5 * (x[n] - k * x[n - d])
        // where d = 2 * pickupPosition * N (period in samples at current pitch)
        let comb_delay = 2.0 * self.pickup_position * self.base_delay_samples;
        let comb_delay_clamped = comb_delay.clamp(1.0, (OUTPUT_RING_SIZE - 2) as f32);
        
        // Write raw mix to output ring buffer
        self.output_ring[self.output_ring_idx] = raw_mix;
        self.output_ring_idx = (self.output_ring_idx + 1) % OUTPUT_RING_SIZE;
        
        // Read delayed sample from output ring
        let delayed_out = self.read_output_ring(comb_delay_clamped);
        let output = 0.5 * (raw_mix - 0.4 * delayed_out);
        
        self.amplitude_env *= self.amplitude_decay * self.release_decay;
        if self.amplitude_env < 0.00005 && self.crossfade_position >= self.crossfade_length {
            self.is_active = false;
            self.amplitude_env = 0.0;
            self.release_decay = 1.0;
        }

        // Crossfade logic for legato / rapid re-triggering without popping
        if self.crossfade_position < self.crossfade_length {
            let pending_tension_mod = self.pending_amplitude_env * self.pending_amplitude_env * 0.003;
            let pending_delay_h = self.pending_base_delay_samples * (1.0 - pending_tension_mod);
            let pending_delay_v = self.pending_base_delay_samples * (1.0 - pending_tension_mod) * 0.9985;

            let pending_comp_h = Self::loop_filter_compensation(self.pending_damping, pending_delay_h);
            let pending_comp_v = Self::loop_filter_compensation(self.pending_damping, pending_delay_v);

            let pending_out_h = Self::compute_plane(
                &mut self.pending_delay_line_h, &mut self.pending_write_idx_h, &mut self.pending_prev_sample_h,
                pending_delay_h, self.pending_damping, self.pending_dispersion_coeff, self.pending_decay,
                &mut self.pending_dispersion_h, pending_comp_h, &mut self.pending_thiran_h,
            );

            let pending_out_v = Self::compute_plane(
                &mut self.pending_delay_line_v, &mut self.pending_write_idx_v, &mut self.pending_prev_sample_v,
                pending_delay_v, self.pending_damping, self.pending_dispersion_coeff, self.pending_decay * 0.999,
                &mut self.pending_dispersion_v, pending_comp_v, &mut self.pending_thiran_v,
            );

            let pending_h_blend = 0.7 + self.pickup_position * 0.5;
            let pending_output = (pending_out_h * pending_h_blend + pending_out_v * (1.0 - pending_h_blend)) * self.pending_amplitude_env;
            
            self.pending_amplitude_env *= self.pending_amplitude_decay * self.pending_release_decay;
            if self.pending_amplitude_env < 0.00005 {
                self.pending_amplitude_env = 0.0;
                self.pending_release_decay = 1.0;
            }

            let blend = (self.crossfade_position as f32 + 1.0) / self.crossfade_length as f32;
            self.crossfade_position += 1;

            if self.crossfade_position >= self.crossfade_length {
                std::mem::swap(&mut self.delay_line_h, &mut self.pending_delay_line_h);
                std::mem::swap(&mut self.delay_line_v, &mut self.pending_delay_line_v);
                
                self.write_idx_h = self.pending_write_idx_h;
                self.write_idx_v = self.pending_write_idx_v;
                self.prev_sample_h = self.pending_prev_sample_h;
                self.prev_sample_v = self.pending_prev_sample_v;
                
                self.base_delay_samples = self.pending_base_delay_samples;
                self.target_delay_samples = self.pending_base_delay_samples;
                self.decay = self.pending_decay;
                self.damping = self.pending_damping;
                self.dispersion_coeff = self.pending_dispersion_coeff;
                
                std::mem::swap(&mut self.dispersion_h, &mut self.pending_dispersion_h);
                std::mem::swap(&mut self.dispersion_v, &mut self.pending_dispersion_v);
                std::mem::swap(&mut self.thiran_h, &mut self.pending_thiran_h);
                std::mem::swap(&mut self.thiran_v, &mut self.pending_thiran_v);
                
                self.amplitude_env = self.pending_amplitude_env;
                self.amplitude_decay = self.pending_amplitude_decay;
                self.release_decay = self.pending_release_decay;
            }

            return output * (1.0 - blend) + pending_output * blend;
        }

        output
    }
}

// Sympathetic coupling parameters
const SYMPATHETIC_COUPLING_GAIN: f32 = 0.003;
const SYMPATHETIC_THRESHOLD: f32 = 0.05;

#[wasm_bindgen]
pub struct DspEngine {
    strings: Vec<GuitarString>,
    sample_rate: f32,
    drive: f32,
    /// Global pitch offset in semitones, applied to all strings simultaneously.
    /// Models a whammy/tremolo bar that alters bridge tension uniformly.
    whammy_semitones: f32,
    output_buffer: [f32; 128], // WebAudio render quantum size
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, seed: u32) -> Self {
        let mut strings = Vec::with_capacity(MAX_STRINGS);
        for i in 0..MAX_STRINGS {
            // Each string gets a unique PRNG seed derived from the master
            // seed via Knuth's multiplicative hash, so simultaneous plucks
            // produce decorrelated noise bursts.
            let string_seed = seed ^ ((i as u32).wrapping_mul(2654435761));
            strings.push(GuitarString::new(string_seed));
        }

        Self {
            strings,
            sample_rate,
            drive: 1.0,
            whammy_semitones: 0.0,
            output_buffer: [0.0; 128],
        }
    }

    pub fn pluck(&mut self, string_idx: usize, freq: f32, velocity: f32) {
        if string_idx < self.strings.len() {
            self.strings[string_idx].pluck(freq, velocity, self.sample_rate, string_idx);
        }
    }

    /// Damp a ringing string early with a smooth exponential fade.
    /// amount in 0.0..=1.0: 0.0 (gentle release) to 1.0 (hard dead-note mute).
    pub fn damp(&mut self, string_idx: usize, amount: f32) {
        if string_idx < self.strings.len() {
            self.strings[string_idx].damp(amount, self.sample_rate);
        }
    }

    /// Start a pitch glide on a string toward target_freq over duration_ms
    pub fn bend(&mut self, string_idx: usize, target_freq: f32, duration_ms: f32) {
        if string_idx < self.strings.len() {
            self.strings[string_idx].start_glide(target_freq, duration_ms, self.sample_rate);
        }
    }

    /// Set the pickup position for a string (0..1, fraction from bridge)
    pub fn set_pickup_position(&mut self, string_idx: usize, position: f32) {
        if string_idx < self.strings.len() {
            self.strings[string_idx].pickup_position = position.clamp(0.02, 0.98);
        }
    }

    /// Set the pickup position for all strings at once
    pub fn set_all_pickup_positions(&mut self, position: f32) {
        let pos = position.clamp(0.02, 0.98);
        for s in &mut self.strings {
            s.pickup_position = pos;
        }
    }

    pub fn set_drive(&mut self, drive: f32) {
        self.drive = drive;
    }

    /// Set whammy bar pitch offset in semitones.
    /// Positive = pitch up (bar pull), negative = pitch down (bar dive).
    /// Clamped to [-12, +12] (one octave each direction).
    pub fn set_whammy(&mut self, semitones: f32) {
        self.whammy_semitones = semitones.clamp(-12.0, 12.0);
    }

    pub fn process_chunk(&mut self) {
        // Fast paths for silence
        let mut any_active = false;
        for s in &self.strings {
            if s.is_active && (s.amplitude_env > 0.0001 || (s.crossfade_position < s.crossfade_length && s.pending_amplitude_env > 0.0001)) {
                any_active = true;
                break;
            }
        }

        if !any_active {
            for s in self.output_buffer.iter_mut() {
                *s = 0.0;
            }
            return;
        }

        // Pre-compute whammy bar delay scaling factor (applied uniformly to all strings).
        // Pitch up = shorter delay = divide by factor > 1.
        let whammy_factor = if self.whammy_semitones.abs() > 0.001 {
            2.0f32.powf(self.whammy_semitones / 12.0)
        } else {
            1.0
        };

        // Per-sample buffer for individual string outputs (sympathetic coupling)
        let mut string_outputs = [0.0f32; MAX_STRINGS];

        for i in 0..128 {
            let mut mix = 0.0;
            for (si, s) in self.strings.iter_mut().enumerate() {
                // Apply whammy bar: temporarily scale delay length for this sample.
                // We modify base_delay_samples in-place and restore after process_sample()
                // to avoid allocating new state. This is correct because process_sample()
                // uses base_delay_samples only for the current sample's read position.
                let original_delay = s.base_delay_samples;
                if whammy_factor != 1.0 && s.is_active {
                    s.base_delay_samples = (original_delay / whammy_factor).clamp(2.0, (BUFFER_SIZE - 2) as f32);
                }
                let out = s.process_sample();
                if whammy_factor != 1.0 && s.is_active {
                    s.base_delay_samples = original_delay;
                }
                string_outputs[si] = out;
                mix += out;
            }

            // Sympathetic string coupling: feed a tiny fraction of the summed
            // output back into each near-silent string's delay line. This
            // models the shared bridge transmitting vibration between strings.
            // Gated by amplitude_env so it only excites quiet strings —
            // prevents feedback runaway on sustained chords.
            let coupling_input = mix * SYMPATHETIC_COUPLING_GAIN;
            for s in &mut self.strings {
                if s.is_active && s.amplitude_env < SYMPATHETIC_THRESHOLD {
                    let idx = if s.write_idx_h > 0 { s.write_idx_h - 1 } else { BUFFER_SIZE - 1 };
                    s.delay_line_h[idx] += coupling_input * 0.7;
                    s.delay_line_v[idx] += coupling_input * 0.3;
                }
            }

            // Tube waveshaping is applied upstream in processor.js now;
            // WASM engine just outputs the physical raw string models
            self.output_buffer[i] = mix;
        }
    }

    pub fn output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn calc_rms(engine: &mut DspEngine, chunks: usize) -> f32 {
        let mut sum_sq = 0.0;
        let mut total_samples = 0;
        for _ in 0..chunks {
            engine.process_chunk();
            let ptr = engine.output_ptr();
            unsafe {
                let slice = std::slice::from_raw_parts(ptr, 128);
                for &s in slice {
                    sum_sq += s * s;
                }
            }
            total_samples += 128;
        }
        (sum_sq / total_samples as f32).sqrt()
    }

    #[test]
    fn test_damp_attenuates_faster_than_natural_decay() {
        let sample_rate = 48000.0;
        let mut engine_natural = DspEngine::new(sample_rate, 42);
        let mut engine_damped = DspEngine::new(sample_rate, 42);

        // Pluck both at 330 Hz
        engine_natural.pluck(0, 330.0, 0.8);
        engine_damped.pluck(0, 330.0, 0.8);

        // Let both ring for 200ms (75 chunks of 128 samples = 9600 samples)
        calc_rms(&mut engine_natural, 75);
        calc_rms(&mut engine_damped, 75);

        // Damp engine_damped with full amount
        engine_damped.damp(0, 1.0);

        // Allow 50ms (20 chunks) for damping ramp
        calc_rms(&mut engine_natural, 20);
        calc_rms(&mut engine_damped, 20);

        // Process another 150ms (55 chunks) and compare
        let rms_natural = calc_rms(&mut engine_natural, 55);
        let rms_damped = calc_rms(&mut engine_damped, 55);

        // Damped RMS should be essentially silent (< 1% of natural decay RMS)
        assert!(
            rms_damped < rms_natural * 0.01,
            "Damped RMS ({}) should be < 1% of natural decay RMS ({})",
            rms_damped,
            rms_natural
        );
    }

    #[test]
    fn test_damp_inactive_string_is_noop() {
        let sample_rate = 48000.0;
        let mut engine = DspEngine::new(sample_rate, 123);

        // Damp string that was never plucked
        engine.damp(0, 1.0);
        engine.damp(5, 0.5);

        let rms = calc_rms(&mut engine, 20);
        assert_eq!(rms, 0.0, "Inactive damped string should produce silence");
    }

    #[test]
    fn test_repluck_clears_damping() {
        let sample_rate = 48000.0;
        let mut engine = DspEngine::new(sample_rate, 999);

        // Pluck and damp
        engine.pluck(0, 220.0, 0.8);
        calc_rms(&mut engine, 30); // 80ms
        engine.damp(0, 1.0);
        calc_rms(&mut engine, 20); // mid-damp

        // Repluck same string at full velocity
        engine.pluck(0, 220.0, 0.8);
        let rms_after_repluck = calc_rms(&mut engine, 20);

        assert!(
            rms_after_repluck > 0.05,
            "Replucked string should ring with high amplitude, got RMS: {}",
            rms_after_repluck
        );
    }

    #[test]
    fn test_damp_amount_sweep_controls_rate() {
        let sample_rate = 48000.0;

        let mut engine_soft = DspEngine::new(sample_rate, 555);
        let mut engine_med = DspEngine::new(sample_rate, 555);
        let mut engine_hard = DspEngine::new(sample_rate, 555);

        engine_soft.pluck(0, 220.0, 0.8);
        engine_med.pluck(0, 220.0, 0.8);
        engine_hard.pluck(0, 220.0, 0.8);

        // Ring for 50ms
        calc_rms(&mut engine_soft, 20);
        calc_rms(&mut engine_med, 20);
        calc_rms(&mut engine_hard, 20);

        // Apply different damping amounts
        engine_soft.damp(0, 0.0);
        engine_med.damp(0, 0.5);
        engine_hard.damp(0, 1.0);

        // Measure RMS in the next 60ms (25 chunks)
        let rms_soft = calc_rms(&mut engine_soft, 25);
        let rms_med = calc_rms(&mut engine_med, 25);
        let rms_hard = calc_rms(&mut engine_hard, 25);

        assert!(
            rms_hard < rms_med,
            "Hard damping RMS ({}) should be < medium damping RMS ({})",
            rms_hard,
            rms_med
        );
        assert!(
            rms_med < rms_soft,
            "Medium damping RMS ({}) should be < soft damping RMS ({})",
            rms_med,
            rms_soft
        );
    }
}
