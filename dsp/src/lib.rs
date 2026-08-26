use wasm_bindgen::prelude::*;

const MAX_STRINGS: usize = 6;
const BUFFER_SIZE: usize = 4096;
const RENDER_QUANTUM: usize = 128;
const STRING_OUTPUT_BUFFER_SIZE: usize = MAX_STRINGS * RENDER_QUANTUM;
const DISPERSION_STAGES: usize = 4;
const MAX_PICK_SAMPLES: usize = 128;
const STRING_OUTPUT_GAIN: f32 = 0.25;

// Standard 10-46 steel set: diameter (m) and tension (N).
const STRING_DIAMETERS_M: [f32; MAX_STRINGS] =
    [0.001168, 0.000914, 0.000635, 0.000432, 0.000330, 0.000254];
const STRING_TENSIONS_N: [f32; MAX_STRINGS] = [77.8, 76.5, 81.8, 73.8, 68.5, 72.1];
const SCALE_LENGTH_M: f32 = 0.648;
const YOUNG_MODULUS_PA: f32 = 2.0e11;

#[inline]
fn compute_inharmonicity(string_idx: usize) -> f32 {
    let idx = string_idx.min(MAX_STRINGS - 1);
    let diameter = STRING_DIAMETERS_M[idx];
    let diameter_fourth = diameter * diameter * diameter * diameter;
    std::f32::consts::PI.powi(2) * YOUNG_MODULUS_PA * diameter_fourth
        / (64.0 * STRING_TENSIONS_N[idx] * SCALE_LENGTH_M.powi(2))
}

/// Natural amplitude T60: about 7 s at low E and 3.5 s at open high E.
#[inline]
fn sustain_t60_seconds(frequency: f32) -> f32 {
    let octaves_above_low_e = (frequency / 82.4069).max(1.0).log2();
    (7.0 - 1.17 * octaves_above_low_e).clamp(2.8, 7.0)
}

/// Gain applied once per round trip. 10^-3 is -60 dB in amplitude.
#[inline]
fn round_trip_gain(t60_seconds: f32, frequency: f32) -> f32 {
    let traversals = (t60_seconds * frequency).max(1.0);
    10.0f32.powf(-3.0 / traversals).clamp(0.0, 0.999_95)
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
        self.x1.fill(0.0);
        self.y1.fill(0.0);
    }

    #[inline(always)]
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

/// One waveguide voice. Each string has a current and pending voice so a
/// retrigger never has to clear the audible delay line.
struct StringVoice {
    delay_line_h: [f32; BUFFER_SIZE],
    delay_line_v: [f32; BUFFER_SIZE],
    write_idx_h: usize,
    write_idx_v: usize,
    prev_sample_h: f32,
    prev_sample_v: f32,
    base_delay_samples: f32,
    target_delay_samples: f32,
    glide_increment: f32,
    is_gliding: bool,
    frequency: f32,
    damping: f32,
    dispersion_coeff: f32,
    loop_gain: f32,
    dispersion_h: DispersionFilter,
    dispersion_v: DispersionFilter,
    tension_envelope: f32,
    tension_decay: f32,
    energy: f32,
    energy_smoothing: f32,
    samples_alive: u64,
    minimum_active_samples: u64,
    active: bool,
}

impl StringVoice {
    fn new() -> Self {
        Self {
            delay_line_h: [0.0; BUFFER_SIZE],
            delay_line_v: [0.0; BUFFER_SIZE],
            write_idx_h: 0,
            write_idx_v: 0,
            prev_sample_h: 0.0,
            prev_sample_v: 0.0,
            base_delay_samples: 0.0,
            target_delay_samples: 0.0,
            glide_increment: 0.0,
            is_gliding: false,
            frequency: 0.0,
            damping: 0.08,
            dispersion_coeff: 0.002,
            loop_gain: 0.99,
            dispersion_h: DispersionFilter::new(),
            dispersion_v: DispersionFilter::new(),
            tension_envelope: 0.0,
            tension_decay: 0.0,
            energy: 0.0,
            energy_smoothing: 0.0,
            samples_alive: 0,
            minimum_active_samples: 0,
            active: false,
        }
    }

    fn reset_state(&mut self) {
        self.delay_line_h.fill(0.0);
        self.delay_line_v.fill(0.0);
        self.write_idx_h = 0;
        self.write_idx_v = 0;
        self.prev_sample_h = 0.0;
        self.prev_sample_v = 0.0;
        self.dispersion_h.reset();
        self.dispersion_v.reset();
        self.energy = 0.0;
        self.samples_alive = 0;
        self.is_gliding = false;
    }

    #[inline(always)]
    fn read_delay_linear(
        delay_line: &[f32; BUFFER_SIZE],
        write_idx: usize,
        delay_samples: f32,
    ) -> f32 {
        // First-order Lagrange/Farrow interpolation. It is continuous across
        // integer-delay boundaries and its convex coefficients never add gain.
        let mut read_position = write_idx as f32 - delay_samples;
        while read_position < 0.0 {
            read_position += BUFFER_SIZE as f32;
        }
        let index_0 = read_position.floor() as usize % BUFFER_SIZE;
        let index_1 = (index_0 + 1) % BUFFER_SIZE;
        let fraction = read_position - read_position.floor();
        delay_line[index_0] + fraction * (delay_line[index_1] - delay_line[index_0])
    }

    #[inline(always)]
    fn compute_plane(
        delay_line: &mut [f32; BUFFER_SIZE],
        write_idx: &mut usize,
        previous_sample: &mut f32,
        delay_samples: f32,
        damping: f32,
        dispersion_coeff: f32,
        loop_gain: f32,
        dispersion: &mut DispersionFilter,
    ) -> f32 {
        let delayed = Self::read_delay_linear(delay_line, *write_idx, delay_samples);
        // Low-pass max gain = 1; dispersion is all-pass; loop_gain < 1.
        let filtered = delayed * (1.0 - damping) + *previous_sample * damping;
        let dispersed = dispersion.process(filtered, dispersion_coeff);
        delay_line[*write_idx] = dispersed * loop_gain;
        *previous_sample = filtered;
        *write_idx = (*write_idx + 1) % BUFFER_SIZE;
        dispersed
    }

    fn start_glide(&mut self, target_frequency: f32, duration_ms: f32, sample_rate: f32) {
        if !self.active || !target_frequency.is_finite() || target_frequency <= 0.0 {
            return;
        }
        let target_frequency = target_frequency.clamp(20.0, sample_rate / 8.0);
        let allpass_delay = DISPERSION_STAGES as f32
            * ((1.0 + self.dispersion_coeff) / (1.0 - self.dispersion_coeff));
        let lowpass_delay = self.damping / (1.0 - self.damping);
        self.target_delay_samples =
            ((sample_rate / target_frequency) - allpass_delay - lowpass_delay)
                .clamp(8.0, (BUFFER_SIZE - 4) as f32);
        let duration_samples = (duration_ms.clamp(1.0, 10_000.0) * sample_rate / 1000.0).max(1.0);
        self.glide_increment =
            (self.target_delay_samples - self.base_delay_samples) / duration_samples;
        self.frequency = target_frequency;
        self.loop_gain = round_trip_gain(sustain_t60_seconds(target_frequency), target_frequency);
        self.is_gliding = true;
    }

    fn damp(&mut self, amount: f32) {
        if !self.active {
            return;
        }
        let amount = amount.clamp(0.0, 1.0);
        let release_t60 = 0.015 + 0.165 * (1.0 - amount).powf(1.2);
        self.loop_gain = self
            .loop_gain
            .min(round_trip_gain(release_t60, self.frequency.max(20.0)));
    }

    #[inline(always)]
    fn process_sample(&mut self, whammy_pitch_factor: f32) -> f32 {
        if !self.active {
            return 0.0;
        }
        if self.is_gliding {
            let remaining = self.target_delay_samples - self.base_delay_samples;
            if remaining.abs() <= self.glide_increment.abs().max(0.000_01) {
                self.base_delay_samples = self.target_delay_samples;
                self.is_gliding = false;
            } else {
                self.base_delay_samples += self.glide_increment;
            }
        }

        // Pick tension settles independently with a 160 ms time constant.
        let tension_ratio = 1.0 + 0.003 * self.tension_envelope.powi(2);
        let delay_h = (self.base_delay_samples / (whammy_pitch_factor * tension_ratio))
            .clamp(2.0, (BUFFER_SIZE - 2) as f32);
        let delay_v = (delay_h * 0.9985).clamp(2.0, (BUFFER_SIZE - 2) as f32);

        let output_h = Self::compute_plane(
            &mut self.delay_line_h,
            &mut self.write_idx_h,
            &mut self.prev_sample_h,
            delay_h,
            self.damping,
            self.dispersion_coeff,
            self.loop_gain,
            &mut self.dispersion_h,
        );
        let output_v = Self::compute_plane(
            &mut self.delay_line_v,
            &mut self.write_idx_v,
            &mut self.prev_sample_v,
            delay_v,
            self.damping,
            self.dispersion_coeff,
            (self.loop_gain * 0.9995).min(0.999_95),
            &mut self.dispersion_v,
        );

        self.tension_envelope *= self.tension_decay;
        self.samples_alive += 1;
        let output = output_h * 0.78 + output_v * 0.22;
        self.energy =
            self.energy_smoothing * self.energy + (1.0 - self.energy_smoothing) * output * output;

        // Retire from measured signal energy, never a frozen amplitude envelope.
        if self.samples_alive >= self.minimum_active_samples && self.energy < 4.0e-12 {
            self.active = false;
            self.energy = 0.0;
            return 0.0;
        }
        output
    }
}

struct GuitarString {
    current: StringVoice,
    pending: StringVoice,
    crossfade_position: usize,
    crossfade_length: usize,
    string_idx: usize,
    pick_position: f32,
    pick_hardness: f32,
    prng_state: u32,
}

impl GuitarString {
    fn new(prng_seed: u32, string_idx: usize) -> Self {
        Self {
            current: StringVoice::new(),
            pending: StringVoice::new(),
            crossfade_position: RENDER_QUANTUM,
            crossfade_length: RENDER_QUANTUM,
            string_idx,
            pick_position: 0.35,
            pick_hardness: 0.65,
            prng_state: prng_seed,
        }
    }

    #[inline(always)]
    fn prng_next(state: &mut u32) -> f32 {
        *state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        (*state as f32) / (u32::MAX as f32)
    }

    #[allow(clippy::too_many_arguments)]
    fn prepare_voice(
        voice: &mut StringVoice,
        prng_state: &mut u32,
        frequency: f32,
        velocity: f32,
        sample_rate: f32,
        string_idx: usize,
        pick_position: f32,
        pick_hardness: f32,
    ) {
        voice.reset_state();
        let frequency = frequency.clamp(20.0, sample_rate / 8.0);
        let velocity = velocity.clamp(0.0, 1.0);
        let hardness = pick_hardness.clamp(0.0, 1.0);
        let dispersion_coeff = (compute_inharmonicity(string_idx) * 400.0).clamp(0.0005, 0.025);
        let damping = (0.045 + 0.035 * (frequency / 1000.0).sqrt()).clamp(0.045, 0.12);
        let allpass_delay =
            DISPERSION_STAGES as f32 * ((1.0 + dispersion_coeff) / (1.0 - dispersion_coeff));
        let lowpass_delay = damping / (1.0 - damping);
        let raw_period = sample_rate / frequency;
        let delay_samples =
            (raw_period - allpass_delay - lowpass_delay).clamp(8.0, (BUFFER_SIZE - 4) as f32);
        let cycle_length = (delay_samples.round() as usize).clamp(8, BUFFER_SIZE - 4);

        voice.frequency = frequency;
        voice.base_delay_samples = delay_samples;
        voice.target_delay_samples = delay_samples;
        voice.damping = damping;
        voice.dispersion_coeff = dispersion_coeff;
        voice.loop_gain = round_trip_gain(sustain_t60_seconds(frequency), frequency);
        voice.tension_envelope = velocity;
        voice.tension_decay = (-1.0 / (0.160 * sample_rate)).exp();
        voice.energy_smoothing = (-1.0 / (0.050 * sample_rate)).exp();
        voice.minimum_active_samples = (0.250 * sample_rate) as u64;
        voice.active = true;

        // Short raised-cosine pick pulse. Velocity/hardness change both width
        // and low-pass cutoff, so velocity affects attack spectrum, not just gain.
        let duration_ms = (1.10 - 0.45 * hardness - 0.25 * velocity).clamp(0.35, 1.10);
        let pick_length = ((sample_rate * duration_ms * 0.001).round() as usize)
            .clamp(16, MAX_PICK_SAMPLES)
            .min(cycle_length);
        let pick_delay = ((cycle_length as f32 * pick_position.clamp(0.02, 0.98)).round() as usize)
            .clamp(1, cycle_length - 1);
        let lowpass_coefficient =
            (0.28 + 0.42 * velocity + 0.25 * hardness + 0.04 * (frequency / 220.0).log2())
                .clamp(0.18, 0.96);
        let target_peak = 0.70 * velocity.powf(0.72) * (0.82 + 0.18 * hardness);
        let polarization = 0.35 + 0.30 * Self::prng_next(prng_state);
        let horizontal_gain = polarization.sqrt();
        let vertical_gain = (1.0 - polarization).sqrt();
        let mut pulse = [0.0f32; MAX_PICK_SAMPLES];
        let mut filter_state = 0.0;
        let mut pulse_peak = 0.0f32;

        for (i, sample) in pulse.iter_mut().take(pick_length).enumerate() {
            let phase = i as f32 / pick_length.saturating_sub(1).max(1) as f32;
            let window = (0.5 - 0.5 * (std::f32::consts::TAU * phase).cos()) * (1.0 - 0.35 * phase);
            let noise = Self::prng_next(prng_state) * 2.0 - 1.0;
            filter_state += lowpass_coefficient * (noise - filter_state);
            *sample = filter_state * window;
            pulse_peak = pulse_peak.max(sample.abs());
        }
        let pulse_scale = if pulse_peak > 1.0e-9 {
            target_peak / pulse_peak
        } else {
            0.0
        };

        for (i, sample) in pulse.iter().take(pick_length).enumerate() {
            let excitation = *sample * pulse_scale;
            let direct_index = i % cycle_length;
            let reflected_index = (i + pick_delay) % cycle_length;
            voice.delay_line_h[direct_index] += excitation * horizontal_gain;
            voice.delay_line_v[direct_index] += excitation * vertical_gain;
            // Initial string kink at the plectrum point; this is not pickup sensing.
            voice.delay_line_h[reflected_index] -= excitation * horizontal_gain * 0.72;
            voice.delay_line_v[reflected_index] -= excitation * vertical_gain * 0.72;
        }

        // Eliminate a residual DC mode from the initial displacement.
        let mean_h = voice.delay_line_h[..cycle_length].iter().sum::<f32>() / cycle_length as f32;
        let mean_v = voice.delay_line_v[..cycle_length].iter().sum::<f32>() / cycle_length as f32;
        for index in 0..cycle_length {
            voice.delay_line_h[index] -= mean_h;
            voice.delay_line_v[index] -= mean_v;
        }
        voice.write_idx_h = cycle_length % BUFFER_SIZE;
        voice.write_idx_v = cycle_length % BUFFER_SIZE;
    }

    fn pluck(&mut self, frequency: f32, velocity: f32, sample_rate: f32) {
        if !frequency.is_finite() || frequency <= 0.0 || !velocity.is_finite() {
            return;
        }
        if self.crossfade_position < self.crossfade_length
            && self.crossfade_position * 2 >= self.crossfade_length
        {
            std::mem::swap(&mut self.current, &mut self.pending);
        }
        if self.current.active {
            Self::prepare_voice(
                &mut self.pending,
                &mut self.prng_state,
                frequency,
                velocity,
                sample_rate,
                self.string_idx,
                self.pick_position,
                self.pick_hardness,
            );
            self.crossfade_position = 0;
        } else {
            Self::prepare_voice(
                &mut self.current,
                &mut self.prng_state,
                frequency,
                velocity,
                sample_rate,
                self.string_idx,
                self.pick_position,
                self.pick_hardness,
            );
            self.pending.active = false;
            self.crossfade_position = self.crossfade_length;
        }
    }

    fn damp(&mut self, amount: f32) {
        self.current.damp(amount);
        self.pending.damp(amount);
    }

    fn start_glide(&mut self, target_frequency: f32, duration_ms: f32, sample_rate: f32) {
        self.current
            .start_glide(target_frequency, duration_ms, sample_rate);
        if self.crossfade_position < self.crossfade_length {
            self.pending
                .start_glide(target_frequency, duration_ms, sample_rate);
        }
    }

    #[inline(always)]
    fn process_sample(&mut self, whammy_pitch_factor: f32) -> f32 {
        let current_output = self.current.process_sample(whammy_pitch_factor);
        let mixed = if self.crossfade_position < self.crossfade_length {
            let pending_output = self.pending.process_sample(whammy_pitch_factor);
            let blend = (self.crossfade_position + 1) as f32 / self.crossfade_length as f32;
            self.crossfade_position += 1;
            // Equal-power interpolation avoids the old decorrelated-voice level hole.
            let output = current_output * (1.0 - blend).sqrt() + pending_output * blend.sqrt();
            if self.crossfade_position >= self.crossfade_length {
                std::mem::swap(&mut self.current, &mut self.pending);
                self.pending.active = false;
            }
            output
        } else {
            current_output
        };
        // The same headroom-calibrated output stage is shared by both voices.
        mixed * STRING_OUTPUT_GAIN
    }

    fn is_active(&self) -> bool {
        self.current.active
            || (self.crossfade_position < self.crossfade_length && self.pending.active)
    }

    fn energy(&self) -> f32 {
        self.current.energy.sqrt() * STRING_OUTPUT_GAIN
    }
}

#[wasm_bindgen]
pub struct DspEngine {
    strings: Vec<GuitarString>,
    sample_rate: f32,
    // Compatibility field; nonlinear drive belongs to the amplifier stage.
    drive: f32,
    whammy_semitones: f32,
    output_buffer: [f32; RENDER_QUANTUM],
    // String-major layout: string_outputs[string * 128 + frame].
    string_output_buffer: [f32; STRING_OUTPUT_BUFFER_SIZE],
    frame_cursor: usize,
}

#[wasm_bindgen]
impl DspEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(sample_rate: f32, seed: u32) -> Self {
        let sample_rate = if sample_rate.is_finite() {
            sample_rate.clamp(8_000.0, 192_000.0)
        } else {
            48_000.0
        };
        let mut strings = Vec::with_capacity(MAX_STRINGS);
        for string_idx in 0..MAX_STRINGS {
            let string_seed = seed ^ (string_idx as u32).wrapping_mul(2_654_435_761);
            strings.push(GuitarString::new(string_seed, string_idx));
        }
        Self {
            strings,
            sample_rate,
            drive: 1.0,
            whammy_semitones: 0.0,
            output_buffer: [0.0; RENDER_QUANTUM],
            string_output_buffer: [0.0; STRING_OUTPUT_BUFFER_SIZE],
            frame_cursor: RENDER_QUANTUM,
        }
    }

    pub fn pluck(&mut self, string_idx: usize, frequency: f32, velocity: f32) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.pluck(frequency, velocity, self.sample_rate);
        }
    }

    /// Pluck with explicit articulation without changing the legacy API.
    pub fn pluck_articulated(
        &mut self,
        string_idx: usize,
        frequency: f32,
        velocity: f32,
        pick_position: f32,
        pick_hardness: f32,
    ) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.pick_position = pick_position.clamp(0.02, 0.98);
            string.pick_hardness = pick_hardness.clamp(0.0, 1.0);
            string.pluck(frequency, velocity, self.sample_rate);
        }
    }

    pub fn set_pick_position(&mut self, string_idx: usize, position: f32) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.pick_position = position.clamp(0.02, 0.98);
        }
    }

    pub fn set_pick_hardness(&mut self, string_idx: usize, hardness: f32) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.pick_hardness = hardness.clamp(0.0, 1.0);
        }
    }

    pub fn damp(&mut self, string_idx: usize, amount: f32) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.damp(amount);
        }
    }

    pub fn bend(&mut self, string_idx: usize, target_frequency: f32, duration_ms: f32) {
        if let Some(string) = self.strings.get_mut(string_idx) {
            string.start_glide(target_frequency, duration_ms, self.sample_rate);
        }
    }

    /// Deprecated compatibility no-op. Pickup sensing is owned by the worklet.
    pub fn set_pickup_position(&mut self, _string_idx: usize, _position: f32) {}

    /// Deprecated compatibility no-op. Pickup sensing is owned by the worklet.
    pub fn set_all_pickup_positions(&mut self, _position: f32) {}

    /// Retained for compatibility. Drive is applied in the amplifier path.
    pub fn set_drive(&mut self, drive: f32) {
        self.drive = drive.clamp(0.0, 10.0);
    }

    pub fn set_whammy(&mut self, semitones: f32) {
        self.whammy_semitones = semitones.clamp(-12.0, 12.0);
    }

    /// Reset the append cursor for one Web Audio render quantum.
    pub fn begin_chunk(&mut self) {
        self.frame_cursor = 0;
        self.output_buffer.fill(0.0);
        self.string_output_buffer.fill(0.0);
    }

    /// Append up to `frame_count` frames. The worklet may alternate this with
    /// control events to execute them at exact frame offsets.
    pub fn process_frames(&mut self, frame_count: usize) {
        if self.frame_cursor >= RENDER_QUANTUM {
            self.begin_chunk();
        }
        let end_frame = (self.frame_cursor + frame_count).min(RENDER_QUANTUM);
        if end_frame <= self.frame_cursor {
            return;
        }
        if !self.strings.iter().any(GuitarString::is_active) {
            self.frame_cursor = end_frame;
            return;
        }
        let whammy_pitch_factor = if self.whammy_semitones.abs() > 0.001 {
            2.0f32.powf(self.whammy_semitones / 12.0)
        } else {
            1.0
        };
        for frame in self.frame_cursor..end_frame {
            let mut mix = 0.0;
            for (string_idx, string) in self.strings.iter_mut().enumerate() {
                let output = string.process_sample(whammy_pitch_factor);
                self.string_output_buffer[string_idx * RENDER_QUANTUM + frame] = output;
                mix += output;
            }
            self.output_buffer[frame] = mix;
        }
        self.frame_cursor = end_frame;
    }

    pub fn process_chunk(&mut self) {
        self.begin_chunk();
        self.process_frames(RENDER_QUANTUM);
    }

    pub fn output_ptr(&self) -> *const f32 {
        self.output_buffer.as_ptr()
    }

    /// Pointer to 6x128 f32 values at `[string_idx * 128 + frame]`.
    pub fn string_output_ptr(&self) -> *const f32 {
        self.string_output_buffer.as_ptr()
    }

    pub fn active_voice_count(&self) -> usize {
        self.strings
            .iter()
            .filter(|string| string.is_active())
            .count()
    }

    pub fn string_energy(&self, string_idx: usize) -> f32 {
        self.strings
            .get(string_idx)
            .map(GuitarString::energy)
            .unwrap_or(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn render_samples(engine: &mut DspEngine, sample_count: usize) -> Vec<f32> {
        let mut output = Vec::with_capacity(sample_count);
        while output.len() < sample_count {
            engine.process_chunk();
            let remaining = sample_count - output.len();
            output.extend_from_slice(&engine.output_buffer[..remaining.min(RENDER_QUANTUM)]);
        }
        output
    }

    fn rms(samples: &[f32]) -> f32 {
        if samples.is_empty() {
            return 0.0;
        }
        (samples.iter().map(|sample| sample * sample).sum::<f32>() / samples.len() as f32).sqrt()
    }

    fn peak(samples: &[f32]) -> f32 {
        samples
            .iter()
            .fold(0.0f32, |maximum, sample| maximum.max(sample.abs()))
    }

    #[test]
    fn round_trip_t60_gain_is_strictly_stable() {
        for frequency in [20.0, 82.4069, 440.0, 659.255, 2_000.0, 12_000.0] {
            let gain = round_trip_gain(sustain_t60_seconds(frequency), frequency);
            assert!(gain > 0.0 && gain < 1.0, "gain={gain} at {frequency} Hz");
        }
    }

    #[test]
    fn thirty_second_high_e_render_is_finite_and_does_not_grow() {
        let sample_rate = 48_000.0;
        let mut engine = DspEngine::new(sample_rate, 42);
        engine.pluck(5, 659.255, 1.0);
        let rendered = render_samples(&mut engine, (sample_rate * 30.0) as usize);
        assert!(rendered.iter().all(|sample| sample.is_finite()));
        assert!(peak(&rendered) < 1.0, "peak was {}", peak(&rendered));
        let early = rms(&rendered[48_000..96_000]);
        let late = rms(&rendered[192_000..240_000]);
        assert!(
            late <= early * 1.122,
            "post-attack RMS growth: early={early}, late={late}"
        );
    }

    #[test]
    fn stability_matrix_covers_common_sample_rates_and_registers() {
        for sample_rate in [44_100.0, 48_000.0, 96_000.0] {
            for (string_idx, frequency) in [(0, 82.4069), (5, 659.255)] {
                let mut engine = DspEngine::new(sample_rate, 1234);
                engine.pluck(string_idx, frequency, 0.9);
                let rendered = render_samples(&mut engine, (sample_rate * 5.0) as usize);
                let rate = sample_rate as usize;
                let first = rms(&rendered[rate..rate * 2]);
                let last = rms(&rendered[rate * 4..rate * 5]);
                assert!(rendered.iter().all(|sample| sample.is_finite()));
                assert!(peak(&rendered) < 1.0);
                assert!(
                    last <= first * 1.122,
                    "RMS growth at {sample_rate}/{frequency}: first={first}, last={last}"
                );
            }
        }
    }

    #[test]
    fn hard_pick_has_brighter_attack_than_soft_pick() {
        let mut soft = DspEngine::new(48_000.0, 7);
        let mut hard = DspEngine::new(48_000.0, 7);
        soft.pluck_articulated(2, 220.0, 0.35, 0.35, 0.0);
        hard.pluck_articulated(2, 220.0, 1.0, 0.35, 1.0);
        let soft_attack = render_samples(&mut soft, 4096);
        let hard_attack = render_samples(&mut hard, 4096);
        fn difference_ratio(samples: &[f32]) -> f32 {
            let mut difference_energy = 0.0;
            for pair in samples.windows(2) {
                difference_energy += (pair[1] - pair[0]).powi(2);
            }
            (difference_energy / (samples.len() - 1) as f32).sqrt() / rms(samples).max(1.0e-12)
        }
        let soft_brightness = difference_ratio(&soft_attack);
        let hard_brightness = difference_ratio(&hard_attack);
        assert!(
            hard_brightness > soft_brightness * 1.20,
            "hard={hard_brightness}, soft={soft_brightness}"
        );
    }

    #[test]
    fn retrigger_uses_consistent_gain_and_has_no_level_hole() {
        let mut engine = DspEngine::new(48_000.0, 99);
        engine.pluck(0, 110.0, 0.8);
        render_samples(&mut engine, 12_000);
        let before = render_samples(&mut engine, 1024);
        engine.pluck(0, 110.0, 0.8);
        let transition = render_samples(&mut engine, 1024);
        let after = render_samples(&mut engine, 1024);
        let reference = rms(&before).max(rms(&after));
        assert!(peak(&transition) < 1.0);
        assert!(
            rms(&transition) >= reference * 0.50,
            "retrigger hole: before={}, transition={}, after={}",
            rms(&before),
            rms(&transition),
            rms(&after)
        );
    }

    #[test]
    fn damp_amount_controls_release_rate() {
        let mut soft = DspEngine::new(48_000.0, 555);
        let mut medium = DspEngine::new(48_000.0, 555);
        let mut hard = DspEngine::new(48_000.0, 555);
        soft.pluck(0, 220.0, 0.8);
        medium.pluck(0, 220.0, 0.8);
        hard.pluck(0, 220.0, 0.8);
        render_samples(&mut soft, 2400);
        render_samples(&mut medium, 2400);
        render_samples(&mut hard, 2400);
        soft.damp(0, 0.0);
        medium.damp(0, 0.5);
        hard.damp(0, 1.0);
        let soft_rms = rms(&render_samples(&mut soft, 4800));
        let medium_rms = rms(&render_samples(&mut medium, 4800));
        let hard_rms = rms(&render_samples(&mut hard, 4800));
        assert!(
            hard_rms < medium_rms,
            "hard={hard_rms}, medium={medium_rms}"
        );
        assert!(
            medium_rms < soft_rms,
            "medium={medium_rms}, soft={soft_rms}"
        );
    }

    #[test]
    fn per_string_buffer_is_string_major_and_sums_to_output() {
        let mut engine = DspEngine::new(48_000.0, 321);
        engine.pluck(0, 82.4069, 0.8);
        engine.pluck(5, 659.255, 0.6);
        engine.process_chunk();
        for frame in 0..RENDER_QUANTUM {
            let sum = (0..MAX_STRINGS)
                .map(|string| engine.string_output_buffer[string * RENDER_QUANTUM + frame])
                .sum::<f32>();
            assert!((sum - engine.output_buffer[frame]).abs() < 1.0e-7);
        }
    }

    #[test]
    fn process_frames_appends_for_sample_accurate_events() {
        let mut engine = DspEngine::new(48_000.0, 11);
        engine.begin_chunk();
        engine.process_frames(32);
        engine.pluck(1, 110.0, 0.8);
        engine.process_frames(96);
        assert!(engine.output_buffer[..32]
            .iter()
            .all(|sample| *sample == 0.0));
        assert!(engine.output_buffer[32..]
            .iter()
            .any(|sample| *sample != 0.0));
        assert_eq!(engine.frame_cursor, RENDER_QUANTUM);
    }

    #[test]
    fn inactive_string_damp_is_a_noop() {
        let mut engine = DspEngine::new(48_000.0, 123);
        engine.damp(0, 1.0);
        let rendered = render_samples(&mut engine, 2048);
        assert_eq!(peak(&rendered), 0.0);
        assert_eq!(engine.active_voice_count(), 0);
    }
}
