# Simulating electric guitar sound with DSP

A practical guide to the two main problems: **processing** a real guitar signal to sound like it went through an amp (amp simulation), and **synthesizing** a guitar-like sound entirely digitally, with no real guitar involved (physical modeling / synthesis).

---

## 1. The two problems

| | Input | Goal |
|---|---|---|
| **Amp simulation** | A clean "DI" (direct input) signal from a real guitar | Make it sound like it passed through a real amp + cabinet + mic |
| **Digital synthesis** | MIDI notes, or nothing at all | Generate a guitar-like waveform from scratch |

They share a lot of the back half of the signal chain (tone stack, nonlinear saturation, cabinet simulation) but differ completely in how the raw waveform is produced in the first place.

---

## 2. Part one — amp simulation (processing a real signal)

This is what products like Kemper, Line 6 Helix, Neural DSP, Fractal Audio Axe-Fx, and the open-source Neural Amp Modeler (NAM) do. A guitarist plays through a clean DI signal, and DSP reshapes it to sound like a specific amp and cabinet.

### Signal chain

```
Guitar input (DI)  →  Nonlinear stage  →  Tone stack  →  Cabinet IR
   raw signal          tube distortion     EQ shaping     cab + mic sim
```

### Core techniques

**Nonlinear waveshaping**
Most of a tube amp's character comes from nonlinear clipping in the preamp and power-amp stages. A cheap approximation runs the signal through a shaping curve — `tanh`, a polynomial, or diode-clipper equations. Fast to compute, but only roughly accurate, since it ignores how the circuit's behavior changes with signal level and history.

**Circuit-accurate modeling**
More rigorous methods (wave digital filters, nodal analysis) discretize the actual analog circuit — every resistor, capacitor, and tube stage — and solve it sample-by-sample in real time. This is what high-end hardware modelers lean on. Much more CPU-intensive, but very faithful, including dynamic behavior like sag and bias shift.

**Neural network modeling**
The newer approach: record paired input/output audio from a real amp (DI in, mic'd amp out), then train a small RNN or WaveNet-style network to reproduce that transfer function directly — including time-varying, dynamic behavior. Once trained, inference is often cheaper than full circuit simulation. This is what NAM, Neural DSP, and Tonex are built on.

**Tone stack modeling**
EQ curves built to match the actual passive tone-stack topology of the amp being modeled (the classic Fender/Marshall-style bass/mid/treble network behaves differently from a simple 3-band EQ — the controls interact with each other).

**Cabinet + mic simulation (convolution)**
A speaker cabinet and a microphone both color the sound heavily. Instead of modeling the physical speaker cone, most systems capture a short "impulse response" (IR) from a real cab + mic + mic position, then convolve the guitar signal with that IR. This reproduces the frequency coloration and resonances without simulating the physics directly.

---

## 3. Part two — entirely digital synthesis (no real guitar)

This covers guitar synths, virtual instrument plugins, and game audio — anywhere the sound is generated from MIDI notes or algorithmically, with no real string ever vibrating.

### Approach A: Sample-based / wavetable playback

The most common approach in commercial "virtual guitar" plugins (Ample Sound, MusicLab RealGuitar and similar). It isn't synthesis in a strict sense — it's multisampled recordings of a real guitar, with round-robin variation and legato/slide detection to stitch notes together. Sounds authentic because it *is* real guitar audio, but it's limited to whatever was originally recorded, and articulations outside that set have to be faked or blended.

### Approach B: Physical modeling (digital waveguide synthesis)

This builds a virtual string from first principles using the **Karplus-Strong algorithm** and its extensions.

**Core algorithm:**
1. A delay line whose length sets the pitch (longer delay = lower pitch)
2. A damping filter inside the feedback loop
3. An excitation — a short burst of filtered noise standing in for the pick attack

The noise burst circulates through the delay loop. Each pass through the filter removes a bit of high-frequency energy — which is exactly how a real string's harmonics decay at different rates (highs die out faster than the fundamental). The result is a naturally decaying, harmonically rich pluck.

**Common extensions:**
- **Dispersion filter** — real strings are stiff, not ideal, so higher harmonics run slightly sharp (inharmonicity). An all-pass filter in the loop reproduces this.
- **Pick position / hardness filtering** — where and how hard the string is excited changes which harmonics are emphasized; this is modeled by shaping the excitation noise burst.
- **Commuted synthesis** — moving the (expensive) body/instrument resonance model from the string itself into the excitation signal, since linear systems commute — cheaper to compute.
- **Dual-polarization** — a real string vibrates in two perpendicular planes with very slightly different periods, producing a subtle beating/chorus effect during sustain. Modeling both polarizations and summing them reproduces this.

### Approach C: Pickup modeling (electric-guitar specific)

An electric guitar's tone isn't just the string — it's what the pickup senses. A magnetic pickup measures string velocity at one fixed point along the string, which has two consequences worth modeling:

- **Position comb-filtering** — harmonics with a vibration node at the pickup's exact position get cancelled out. This is the real physical reason a bridge pickup sounds brighter and a neck pickup sounds darker — and it can be reproduced digitally with a comb filter tuned to pickup position.
- **Coil resonance** — a pickup's coil inductance and capacitance (plus cable capacitance) form a resonant low-pass filter, giving each pickup its own characteristic frequency peak and rolloff.

### Approach D: Neural / generative synthesis

Newer hybrid methods, like Google Magenta's **DDSP** (Differentiable DSP), combine a physical-model-like structure (oscillators, filters) with parameters learned from real recordings — a neural network learns to control those parameters from pitch and loudness input rather than having them hand-designed. This sits between hand-built physical models and fully end-to-end neural audio generation: more controllable and less compute-hungry than raw audio generation, more flexible than a fixed physical model.

### Full digital electric guitar signal chain

```
Excitation      String model       Pickup model       Amp sim chain
noise burst  →  delay-line loop →  position comb   →  (same as Part 1:
(pick attack)   + damping filter   + coil resonance    nonlinear stage →
                                                         tone stack → cab IR)
```

Driven by MIDI note events instead of a real string, this is a complete synthetic electric guitar: **string model → pickup model → amp simulation**.

---

## 4. Practical implementation notes

If you wanted to actually build one of these:

- **JUCE** (C++) is the standard framework for audio plugins — handles VST/AU/AAX boilerplate, has DSP utility classes for filters, convolution, and delay lines.
- **RTNeural** — a lightweight C++ library for running trained neural network models (like NAM-style amp models) efficiently inside a real-time audio plugin.
- **Neural Amp Modeler (NAM)** — fully open source, includes both the training pipeline (Python/PyTorch) and the real-time inference plugin code. A good reference implementation for the neural amp-modeling approach.
- **Rust audio ecosystem** — smaller but growing: `nih-plug` for plugin development, `dasp` for DSP primitives, if you'd rather build in Rust than C++.
- **Convolution** for cabinet IRs can be done directly (fine for short IRs) or via FFT-based partitioned convolution for longer IRs, to keep CPU cost reasonable in real time.

---

## 5. Summary

- **Have a real guitar signal, want it to sound like an amp?** → waveshaping / circuit modeling / neural modeling for the amp, convolution with an IR for the cabinet.
- **Have no real guitar, want to generate the sound?** → physical modeling (Karplus-Strong and extensions) for the string, a comb + resonant filter for the pickup, then the same amp-sim chain as above.
- **Want realism with the least effort?** → sample-based playback, at the cost of flexibility.
- **Want a middle ground?** → neural/differentiable DSP approaches like DDSP.
