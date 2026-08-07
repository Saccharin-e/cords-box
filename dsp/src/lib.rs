use wasm_bindgen::prelude::*;

const MAX_STRINGS: usize = 6;
const BUFFER_SIZE: usize = 4096;
const PICKUP_POS: f32 = 0.15; // Bridge pickup position (15% from bridge)

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

    is_active: bool,
    decay: f32,
    pending_decay: f32,
    damping: f32,
    pending_damping: f32,
    dispersion: f32,
    pending_dispersion: f32,
    
    dispersion_x1_h: f32,
    dispersion_y1_h: f32,
    dispersion_x1_v: f32,
    dispersion_y1_v: f32,

    pending_dispersion_x1_h: f32,
    pending_dispersion_y1_h: f32,
    pending_dispersion_x1_v: f32,
    pending_dispersion_y1_v: f32,

    amplitude_env: f32,
    pending_amplitude_env: f32,
    amplitude_decay: f32,
    pending_amplitude_decay: f32,

    crossfade_position: usize,
    crossfade_length: usize,
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

            is_active: false,
            decay: 0.9999,
            pending_decay: 0.9999,
            damping: 0.28,
            pending_damping: 0.28,
            dispersion: 0.08,
            pending_dispersion: 0.08,

            dispersion_x1_h: 0.0,
            dispersion_y1_h: 0.0,
            dispersion_x1_v: 0.0,
            dispersion_y1_v: 0.0,

            pending_dispersion_x1_h: 0.0,
            pending_dispersion_y1_h: 0.0,
            pending_dispersion_x1_v: 0.0,
            pending_dispersion_y1_v: 0.0,

            amplitude_env: 0.0,
            pending_amplitude_env: 0.0,
            amplitude_decay: 0.99994,
            pending_amplitude_decay: 0.99994,

            crossfade_position: 0,
            crossfade_length: 128,
        }
    }

    fn fill_excitation(
        delay_line_h: &mut [f32; BUFFER_SIZE],
        delay_line_v: &mut [f32; BUFFER_SIZE],
        n: usize,
        velocity: f32,
        brightness: f32,
        sample_rate: f32,
    ) {
        for i in 0..BUFFER_SIZE {
            delay_line_h[i] = 0.0;
            delay_line_v[i] = 0.0;
        }

        // Improved Pick Attack: Resonant noise burst
        let burst_length = ((sample_rate * (0.003 + brightness * 0.005)) as usize)
            .clamp(60, 300)
            .min(n);
        
        let mut filter_state = 0.0;
        let cutoff = (0.15 + brightness * 0.4).clamp(0.1, 0.9); // Lowpass coefficient
        
        // Pluck angle determines how energy splits between horizontal and vertical planes
        let pan = js_sys::Math::random() as f32 * 0.4 + 0.3; // 0.3 to 0.7

        for i in 0..burst_length {
            let noise = js_sys::Math::random() as f32 * 2.0 - 1.0;
            // 1-pole lowpass to simulate fleshy part of pick/finger
            filter_state += cutoff * (noise - filter_state);
            
            let pick_envelope = (1.0 - (i as f32 / burst_length as f32)).powf(1.8); // Snappier attack
            let click = if i < 10 { brightness * 0.5 * (1.0 - i as f32 / 10.0) } else { 0.0 };
            
            let sample = (filter_state * 0.9 + click) * pick_envelope * velocity;
            
            delay_line_h[i] = sample * pan;
            delay_line_v[i] = sample * (1.0 - pan);
        }
    }

    fn pluck(&mut self, freq: f32, velocity: f32, sample_rate: f32) {
        let new_delay_samples = (sample_rate / freq).clamp(2.0, (BUFFER_SIZE - 2) as f32);
        let n = new_delay_samples.round() as usize;

        let brightness = (freq / 220.0).sqrt().clamp(0.4, 1.3);

        let frequency_loss = (freq / 1000.0) * 0.00004;
        let new_decay = (0.9999 - frequency_loss).clamp(0.99982, 0.9999);
        let new_damping = (0.22 + brightness * 0.12).clamp(0.22, 0.45);
        let new_dispersion = (0.04 + brightness * 0.08).clamp(0.04, 0.15);
        
        // Natural physical string decay is governed by the waveguide loop filter (self.decay).
        // Set amplitude_decay to 1.0 so notes sustain naturally without being artificially strangled.
        let new_amplitude_decay = 1.0;

        if self.is_active {
            Self::fill_excitation(
                &mut self.pending_delay_line_h,
                &mut self.pending_delay_line_v,
                n,
                velocity,
                brightness,
                sample_rate,
            );
            self.pending_write_idx_h = n % BUFFER_SIZE;
            self.pending_write_idx_v = n % BUFFER_SIZE;
            self.pending_prev_sample_h = 0.0;
            self.pending_prev_sample_v = 0.0;
            self.pending_base_delay_samples = new_delay_samples;
            self.pending_decay = new_decay;
            self.pending_damping = new_damping;
            self.pending_dispersion = new_dispersion;
            self.pending_dispersion_x1_h = 0.0;
            self.pending_dispersion_y1_h = 0.0;
            self.pending_dispersion_x1_v = 0.0;
            self.pending_dispersion_y1_v = 0.0;
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
                sample_rate,
            );
            self.write_idx_h = n % BUFFER_SIZE;
            self.write_idx_v = n % BUFFER_SIZE;
            self.prev_sample_h = 0.0;
            self.prev_sample_v = 0.0;
            self.base_delay_samples = new_delay_samples;
            self.decay = new_decay;
            self.damping = new_damping;
            self.dispersion = new_dispersion;
            self.dispersion_x1_h = 0.0;
            self.dispersion_y1_h = 0.0;
            self.dispersion_x1_v = 0.0;
            self.dispersion_y1_v = 0.0;
            self.amplitude_env = 1.0;
            self.amplitude_decay = new_amplitude_decay;
            self.crossfade_position = self.crossfade_length;
        }

        self.is_active = true;
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

    fn apply_dispersion(input: f32, coefficient: f32, x1: &mut f32, y1: &mut f32) -> f32 {
        let output = -coefficient * input + *x1 + coefficient * *y1;
        *x1 = input;
        *y1 = output;
        output
    }

    #[inline(always)]
    fn compute_plane(
        delay_line: &mut [f32; BUFFER_SIZE],
        write_idx: &mut usize,
        prev_sample: &mut f32,
        delay_samples: f32,
        damping: f32,
        dispersion: f32,
        decay: f32,
        disp_x1: &mut f32,
        disp_y1: &mut f32,
    ) -> f32 {
        let current = Self::read_delay(delay_line, *write_idx, delay_samples);

        // Averaged loop filter models string damping
        let filtered = current * (1.0 - damping) + *prev_sample * damping;
        
        let loop_sample = Self::apply_dispersion(filtered, dispersion, disp_x1, disp_y1);
        let new_sample = loop_sample * decay;
        
        delay_line[*write_idx] = new_sample;
        *prev_sample = filtered;
        *write_idx = (*write_idx + 1) % BUFFER_SIZE;
        
        loop_sample
    }

    fn process_sample(&mut self) -> f32 {
        if !self.is_active {
            return 0.0;
        }

        // 1. Dynamic Pitch Glide (Tension Modulation)
        // Tension is highest when amplitude is highest, reducing delay_samples (higher pitch)
        let tension_mod = self.amplitude_env * self.amplitude_env * 0.003; 
        
        // 2. Dual Polarization (Beating)
        // Vertical plane vibrates slightly faster due to bridge rigidity
        let delay_h = self.base_delay_samples * (1.0 - tension_mod);
        let delay_v = self.base_delay_samples * (1.0 - tension_mod) * 0.9985; // 0.15% pitch offset for beating

        let out_h = Self::compute_plane(
            &mut self.delay_line_h, &mut self.write_idx_h, &mut self.prev_sample_h,
            delay_h, self.damping, self.dispersion, self.decay,
            &mut self.dispersion_x1_h, &mut self.dispersion_y1_h,
        );

        let out_v = Self::compute_plane(
            &mut self.delay_line_v, &mut self.write_idx_v, &mut self.prev_sample_v,
            delay_v, self.damping, self.dispersion, self.decay * 0.999, // Vertical plane decays slightly faster
            &mut self.dispersion_x1_v, &mut self.dispersion_y1_v,
        );

        // 3. Pickup Comb Filtering (Aperture Effect)
        // A pickup at position P (e.g. 0.15) captures the forward wave and subtracts the backward wave.
        // The delay line represents a round-trip (2L), so distance L is N/2. The wave travels 2P distance,
        // which takes P * N samples.
        let pickup_tap_h = delay_h * PICKUP_POS;
        let pickup_tap_v = delay_v * PICKUP_POS;
        
        // Compensate for write_idx having advanced by 1 in compute_plane
        let tap_h = Self::read_delay(&self.delay_line_h, self.write_idx_h.wrapping_sub(1) % BUFFER_SIZE, pickup_tap_h);
        let tap_v = Self::read_delay(&self.delay_line_v, self.write_idx_v.wrapping_sub(1) % BUFFER_SIZE, pickup_tap_v);
        
        // Use 0.85 attenuation on the delayed tap so the fundamental is not completely choked.
        let pickup_signal_h = out_h - 0.85 * tap_h;
        let pickup_signal_v = out_v - 0.85 * tap_v;
        
        // Mix planes asymmetrically (85/15) to prevent massive tremolo dropouts when they slip out of phase
        let pickup_signal = pickup_signal_h * 0.85 + pickup_signal_v * 0.15;
        let output = pickup_signal * self.amplitude_env;
        
        self.amplitude_env *= self.amplitude_decay;

        // Crossfade logic for legato / rapid re-triggering without popping
        if self.crossfade_position < self.crossfade_length {
            let pending_tension_mod = self.pending_amplitude_env * self.pending_amplitude_env * 0.003;
            let pending_delay_h = self.pending_base_delay_samples * (1.0 - pending_tension_mod);
            let pending_delay_v = self.pending_base_delay_samples * (1.0 - pending_tension_mod) * 0.9985;

            let pending_out_h = Self::compute_plane(
                &mut self.pending_delay_line_h, &mut self.pending_write_idx_h, &mut self.pending_prev_sample_h,
                pending_delay_h, self.pending_damping, self.pending_dispersion, self.pending_decay,
                &mut self.pending_dispersion_x1_h, &mut self.pending_dispersion_y1_h,
            );

            let pending_out_v = Self::compute_plane(
                &mut self.pending_delay_line_v, &mut self.pending_write_idx_v, &mut self.pending_prev_sample_v,
                pending_delay_v, self.pending_damping, self.pending_dispersion, self.pending_decay * 0.999,
                &mut self.pending_dispersion_x1_v, &mut self.pending_dispersion_y1_v,
            );

            let pending_pickup_tap_h = pending_delay_h * PICKUP_POS;
            let pending_pickup_tap_v = pending_delay_v * PICKUP_POS;
            
            let p_tap_h = Self::read_delay(&self.pending_delay_line_h, self.pending_write_idx_h.wrapping_sub(1) % BUFFER_SIZE, pending_pickup_tap_h);
            let p_tap_v = Self::read_delay(&self.pending_delay_line_v, self.pending_write_idx_v.wrapping_sub(1) % BUFFER_SIZE, pending_pickup_tap_v);
            
            let pending_pickup_signal_h = pending_out_h - 0.85 * p_tap_h;
            let pending_pickup_signal_v = pending_out_v - 0.85 * p_tap_v;

            let pending_pickup_signal = pending_pickup_signal_h * 0.85 + pending_pickup_signal_v * 0.15;
            let pending_output = pending_pickup_signal * self.pending_amplitude_env;
            
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
                self.decay = self.pending_decay;
                self.damping = self.pending_damping;
                self.dispersion = self.pending_dispersion;
                
                self.dispersion_x1_h = self.pending_dispersion_x1_h;
                self.dispersion_y1_h = self.pending_dispersion_y1_h;
                self.dispersion_x1_v = self.pending_dispersion_x1_v;
                self.dispersion_y1_v = self.pending_dispersion_y1_v;
                
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
            self.strings[string_idx].pluck(freq, velocity, self.sample_rate);
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
