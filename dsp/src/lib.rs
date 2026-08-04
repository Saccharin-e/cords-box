use wasm_bindgen::prelude::*;

const MAX_STRINGS: usize = 6;
const BUFFER_SIZE: usize = 4096;

struct GuitarString {
    delay_line: [f32; BUFFER_SIZE],
    pending_delay_line: [f32; BUFFER_SIZE],
    write_idx: usize,
    pending_write_idx: usize,
    prev_sample: f32,
    pending_prev_sample: f32,
    delay_samples: f32,
    pending_delay_samples: f32,
    is_active: bool,
    decay: f32,
    pending_decay: f32,
    damping: f32,
    pending_damping: f32,
    dispersion: f32,
    pending_dispersion: f32,
    dispersion_x1: f32,
    dispersion_y1: f32,
    pending_dispersion_x1: f32,
    pending_dispersion_y1: f32,
    amplitude: f32,
    pending_amplitude: f32,
    amplitude_decay: f32,
    pending_amplitude_decay: f32,
    crossfade_position: usize,
    crossfade_length: usize,
}

impl GuitarString {
    fn new() -> Self {
        Self {
            delay_line: [0.0; BUFFER_SIZE],
            pending_delay_line: [0.0; BUFFER_SIZE],
            write_idx: 0,
            pending_write_idx: 0,
            prev_sample: 0.0,
            pending_prev_sample: 0.0,
            delay_samples: 0.0,
            pending_delay_samples: 0.0,
            is_active: false,
            decay: 0.9999,
            pending_decay: 0.9999,
            damping: 0.28,
            pending_damping: 0.28,
            dispersion: 0.08,
            pending_dispersion: 0.08,
            dispersion_x1: 0.0,
            dispersion_y1: 0.0,
            pending_dispersion_x1: 0.0,
            pending_dispersion_y1: 0.0,
            amplitude: 0.0,
            pending_amplitude: 0.0,
            amplitude_decay: 0.99994,
            pending_amplitude_decay: 0.99994,
            crossfade_position: 0,
            crossfade_length: 128,
        }
    }

    fn fill_excitation(
        delay_line: &mut [f32; BUFFER_SIZE],
        n: usize,
        velocity: f32,
        brightness: f32,
        sample_rate: f32,
    ) {
        for sample in delay_line.iter_mut() {
            *sample = 0.0;
        }

        // A pick is a short, shaped burst rather than noise filling the whole
        // delay line. Its brightness changes with string pitch and velocity,
        // which gives each string a different attack.
        let burst_length = ((sample_rate * (0.0025 + brightness * 0.0035)) as usize)
            .clamp(48, 220)
            .min(n);
        let smoothing = (0.38 + brightness * 0.24).clamp(0.3, 0.72);
        let mut previous_noise = 0.0;
        for i in 0..burst_length {
            let noise = js_sys::Math::random() as f32 * 2.0 - 1.0;
            let pick_envelope = (1.0 - (i as f32 / burst_length as f32)).powf(1.35);
            let smoothed_noise = previous_noise * (1.0 - smoothing) + noise * smoothing;
            previous_noise = smoothed_noise;
            let pick_click = if i == 0 { brightness * 0.3 } else { 0.0 };
            delay_line[i] = (smoothed_noise * 0.82 + pick_click) * pick_envelope * velocity;
        }
    }

    fn pluck(&mut self, freq: f32, velocity: f32, sample_rate: f32) {
        let new_delay_samples = (sample_rate / freq).clamp(2.0, (BUFFER_SIZE - 2) as f32);
        let n = new_delay_samples.round() as usize;

        let brightness = (freq / 220.0).sqrt().clamp(0.45, 1.25);

        // Low strings keep more body while thin strings lose their high
        // harmonics faster. Keep these values with each active note so a
        // retrigger does not change the tone of the note already ringing.
        let frequency_loss = (freq / 1000.0) * 0.00004;
        let new_decay = (0.9999 - frequency_loss).clamp(0.99982, 0.9999);
        let new_damping = (0.22 + brightness * 0.12).clamp(0.22, 0.38);
        let new_dispersion = (0.035 + brightness * 0.075).clamp(0.035, 0.13);
        let new_amplitude_decay = (0.99994 - (freq / 1000.0) * 0.00008).clamp(0.99986, 0.99994);

        if self.is_active {
            // Keep the old string alive while the new pick enters. Replacing
            // a ringing delay line in one sample is the source of crackles.
            Self::fill_excitation(
                &mut self.pending_delay_line,
                n,
                velocity,
                brightness,
                sample_rate,
            );
            self.pending_write_idx = n % BUFFER_SIZE;
            self.pending_prev_sample = 0.0;
            self.pending_delay_samples = new_delay_samples;
            self.pending_decay = new_decay;
            self.pending_damping = new_damping;
            self.pending_dispersion = new_dispersion;
            self.pending_dispersion_x1 = 0.0;
            self.pending_dispersion_y1 = 0.0;
            self.pending_amplitude = 1.0;
            self.pending_amplitude_decay = new_amplitude_decay;
            self.crossfade_position = 0;
        } else {
            Self::fill_excitation(&mut self.delay_line, n, velocity, brightness, sample_rate);
            self.write_idx = n % BUFFER_SIZE;
            self.prev_sample = 0.0;
            self.delay_samples = new_delay_samples;
            self.decay = new_decay;
            self.damping = new_damping;
            self.dispersion = new_dispersion;
            self.dispersion_x1 = 0.0;
            self.dispersion_y1 = 0.0;
            self.amplitude = 1.0;
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
        // A first-order all-pass gives the stiff string's upper partials a
        // tiny frequency-dependent phase delay instead of perfectly harmonic
        // oscillator behavior.
        let output = -coefficient * input + *x1 + coefficient * *y1;
        *x1 = input;
        *y1 = output;
        output
    }

    fn process_sample(&mut self) -> f32 {
        if !self.is_active {
            return 0.0;
        }

        let current = Self::read_delay(&self.delay_line, self.write_idx, self.delay_samples);

        // The averaged loop filter models string damping and removes the
        // brittle, synthetic edge from the raw noise excitation.
        let filtered = current * (1.0 - self.damping) + self.prev_sample * self.damping;
        let loop_sample = Self::apply_dispersion(
            filtered,
            self.dispersion,
            &mut self.dispersion_x1,
            &mut self.dispersion_y1,
        );
        let new_sample = loop_sample * self.decay;
        self.delay_line[self.write_idx] = new_sample;
        self.prev_sample = filtered;
        self.write_idx = (self.write_idx + 1) % BUFFER_SIZE;
        let output = loop_sample * self.amplitude;
        self.amplitude *= self.amplitude_decay;

        if self.crossfade_position >= self.crossfade_length {
            return output;
        }

        let pending_current = Self::read_delay(
            &self.pending_delay_line,
            self.pending_write_idx,
            self.pending_delay_samples,
        );
        let pending_filtered = pending_current * (1.0 - self.pending_damping)
            + self.pending_prev_sample * self.pending_damping;
        let pending_loop_sample = Self::apply_dispersion(
            pending_filtered,
            self.pending_dispersion,
            &mut self.pending_dispersion_x1,
            &mut self.pending_dispersion_y1,
        );
        self.pending_delay_line[self.pending_write_idx] = pending_loop_sample * self.pending_decay;
        self.pending_prev_sample = pending_filtered;
        self.pending_write_idx = (self.pending_write_idx + 1) % BUFFER_SIZE;
        let pending_output = pending_loop_sample * self.pending_amplitude;
        self.pending_amplitude *= self.pending_amplitude_decay;

        let blend = (self.crossfade_position as f32 + 1.0) / self.crossfade_length as f32;
        self.crossfade_position += 1;

        if self.crossfade_position >= self.crossfade_length {
            std::mem::swap(&mut self.delay_line, &mut self.pending_delay_line);
            self.write_idx = self.pending_write_idx;
            self.prev_sample = self.pending_prev_sample;
            self.delay_samples = self.pending_delay_samples;
            self.decay = self.pending_decay;
            self.damping = self.pending_damping;
            self.dispersion = self.pending_dispersion;
            self.dispersion_x1 = self.pending_dispersion_x1;
            self.dispersion_y1 = self.pending_dispersion_y1;
            self.amplitude = self.pending_amplitude;
            self.amplitude_decay = self.pending_amplitude_decay;
        }

        output * (1.0 - blend) + pending_output * blend
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
            // The string model should feed the amp a clean DI signal. Amp
            // distortion belongs in the Web Audio tube/pedal stages.
            drive: 0.0,
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

    // Get pointer to the output buffer for JS to read from
    pub fn output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }

    // Process exactly 128 samples
    pub fn process_chunk(&mut self) {
        for i in 0..128 {
            let mut mix = 0.0;

            // Sum all active strings.
            for string in &mut self.strings {
                mix += string.process_sample();
            }

            // Keep the physical model clean. Applying saturation here as well
            // as in the amp chain was making every note sound like a synth.
            let source_gain = 0.8 + self.drive.clamp(0.0, 0.25) * 0.1;
            self.output_buffer[i] = mix * source_gain;
        }
    }
}
