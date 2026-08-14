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

    // Output ring buffer for subtractive pickup comb
    output_ring: [f32; OUTPUT_RING_SIZE],
    output_ring_idx: usize,
    pickup_position: f32,

    amplitude_env: f32,
    pending_amplitude_env: f32,
    amplitude_decay: f32,
    pending_amplitude_decay: f32,

    crossfade_position: usize,
    crossfade_length: usize,

    string_idx: usize,
}

impl GuitarString {
    fn new() -> Self {
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

            output_ring: [0.0; OUTPUT_RING_SIZE],
            output_ring_idx: 0,
            pickup_position: 0.15,

            amplitude_env: 0.0,
            pending_amplitude_env: 0.0,
            amplitude_decay: 0.99994,
            pending_amplitude_decay: 0.99994,

            crossfade_position: 0,
            crossfade_length: 128,

            string_idx: 0,
        }
    }

    fn fill_excitation(
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

        // Improved Pick Attack: Resonant noise burst
        let burst_length = n;
        
        let mut filter_state = 0.0;
        let cutoff = (0.25 + brightness * 0.45).clamp(0.15, 0.95); // Lowpass coefficient
        
        let mut seed: u32 = 12345;
        let mut rand = || -> f32 {
            seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
            (seed as f32) / (std::u32::MAX as f32)
        };

        // Pluck angle determines how energy splits between horizontal and vertical planes
        let pan = rand() * 0.4 + 0.3; // 0.3 to 0.7

        for i in 0..burst_length {
            let noise = rand() * 2.0 - 1.0;
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

        if self.is_active {
            Self::fill_excitation(
                &mut self.pending_delay_line_h,
                &mut self.pending_delay_line_v,
                n,
                velocity,
                brightness,
            );
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
            self.pending_amplitude_env = 1.0;
            self.pending_amplitude_decay = new_amplitude_decay;
            self.crossfade_position = 0;
        } else {
            Self::fill_excitation(
                &mut self.delay_line_h,
                &mut self.delay_line_v,
                n,
                velocity,
                brightness,
            );
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
            self.amplitude_env = 1.0;
            self.amplitude_decay = new_amplitude_decay;
            self.crossfade_position = self.crossfade_length;
        }

        // Reset glide state on new pluck
        self.is_gliding = false;
        self.target_delay_samples = new_delay_samples;

        self.is_active = true;
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

    fn read_delay(delay_line: &[f32; BUFFER_SIZE], write_idx: usize, delay_samples: f32) -> f32 {
        let mut read_idx_float = (write_idx as f32) - delay_samples;
        while read_idx_float < 0.0 {
            read_idx_float += BUFFER_SIZE as f32;
        }

        let idx1 = read_idx_float.floor() as usize % BUFFER_SIZE;
        let idx2 = (idx1 + 1) % BUFFER_SIZE;
        let fract = read_idx_float.fract();

        delay_line[idx1] * (1.0 - fract) + delay_line[idx2] * fract
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
    ) -> f32 {
        let current = Self::read_delay(delay_line, *write_idx, delay_samples);

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
            &mut self.dispersion_h, comp_h,
        );

        let out_v = Self::compute_plane(
            &mut self.delay_line_v, &mut self.write_idx_v, &mut self.prev_sample_v,
            delay_v, self.damping, self.dispersion_coeff, self.decay * 0.999, // Vertical plane decays slightly faster
            &mut self.dispersion_v, comp_v,
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
        
        self.amplitude_env *= self.amplitude_decay;

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
                &mut self.pending_dispersion_h, pending_comp_h,
            );

            let pending_out_v = Self::compute_plane(
                &mut self.pending_delay_line_v, &mut self.pending_write_idx_v, &mut self.pending_prev_sample_v,
                pending_delay_v, self.pending_damping, self.pending_dispersion_coeff, self.pending_decay * 0.999,
                &mut self.pending_dispersion_v, pending_comp_v,
            );

            let pending_h_blend = 0.7 + self.pickup_position * 0.5;
            let pending_output = (pending_out_h * pending_h_blend + pending_out_v * (1.0 - pending_h_blend)) * self.pending_amplitude_env;
            
            self.pending_amplitude_env *= self.pending_amplitude_decay;

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
                
                self.amplitude_env = self.pending_amplitude_env;
                self.amplitude_decay = self.pending_amplitude_decay;
            }

            return output * (1.0 - blend) + pending_output * blend;
        }

        output
    }
}

#[wasm_bindgen]
pub struct DspEngine {
    strings: Vec<GuitarString>,
    sample_rate: f32,
    drive: f32,
    output_buffer: [f32; 128], // WebAudio render quantum size
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32) -> Self {
        let mut strings = Vec::with_capacity(MAX_STRINGS);
        for _ in 0..MAX_STRINGS {
            strings.push(GuitarString::new());
        }

        Self {
            strings,
            sample_rate,
            drive: 1.0,
            output_buffer: [0.0; 128],
        }
    }

    pub fn pluck(&mut self, string_idx: usize, freq: f32, velocity: f32) {
        if string_idx < self.strings.len() {
            self.strings[string_idx].pluck(freq, velocity, self.sample_rate, string_idx);
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

    pub fn process_chunk(&mut self) {
        // Fast paths for silence
        let mut any_active = false;
        for s in &self.strings {
            if s.is_active && s.amplitude_env > 0.0001 {
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

        for i in 0..128 {
            let mut mix = 0.0;
            for s in &mut self.strings {
                mix += s.process_sample();
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
