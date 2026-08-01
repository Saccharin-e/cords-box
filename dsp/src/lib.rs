use wasm_bindgen::prelude::*;

const MAX_STRINGS: usize = 6;
const BUFFER_SIZE: usize = 4096;

struct GuitarString {
    delay_line: [f32; BUFFER_SIZE],
    write_idx: usize,
    prev_sample: f32,
    delay_samples: f32,
    is_active: bool,
    decay: f32,
    damping: f32,
}

impl GuitarString {
    fn new() -> Self {
        Self {
            delay_line: [0.0; BUFFER_SIZE],
            write_idx: 0,
            prev_sample: 0.0,
            delay_samples: 0.0,
            is_active: false,
            decay: 0.998,
            damping: 0.25,
        }
    }

    fn pluck(&mut self, freq: f32, velocity: f32, sample_rate: f32) {
        self.delay_samples = sample_rate / freq;
        let n = self.delay_samples.round() as usize;
        
        // Clear buffer
        for i in 0..BUFFER_SIZE {
            self.delay_line[i] = 0.0;
        }

        // Fill initial delay line with noise
        for i in 0..n {
            let noise = (js_sys::Math::random() as f32 * 2.0 - 1.0) * velocity;
            self.delay_line[i] = noise;
        }
        
        self.write_idx = n % BUFFER_SIZE;
        self.is_active = true;
        self.prev_sample = 0.0;
    }

    fn process_sample(&mut self) -> f32 {
        if !self.is_active {
            return 0.0;
        }

        // Fractional delay read
        let read_idx_float = (self.write_idx as f32) - self.delay_samples;
        let mut read_idx_float = read_idx_float;
        while read_idx_float < 0.0 {
            read_idx_float += BUFFER_SIZE as f32;
        }

        let idx1 = read_idx_float.floor() as usize % BUFFER_SIZE;
        let idx2 = (idx1 + 1) % BUFFER_SIZE;
        let fract = read_idx_float.fract();

        let current = self.delay_line[idx1] * (1.0 - fract) + self.delay_line[idx2] * fract;
        
        // Lowpass filter
        let filtered = current * (1.0 - self.damping) + self.prev_sample * self.damping;
        let new_sample = filtered * self.decay;
        
        self.delay_line[self.write_idx] = new_sample;
        self.prev_sample = current;
        
        self.write_idx = (self.write_idx + 1) % BUFFER_SIZE;
        
        current
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
            drive: 2.0,
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
            
            // Sum all active strings
            for string in &mut self.strings {
                mix += string.process_sample();
            }

            // Nonlinear Amplifier Stage (Waveshaping)
            // Soft tube-like clipping (Tanh approximation)
            let x = mix * self.drive;
            let clipped = x / (1.0 + x.abs());
            
            self.output_buffer[i] = clipped;
        }
    }
}
