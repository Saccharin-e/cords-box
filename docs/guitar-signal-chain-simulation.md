# Simulating a guitar signal chain: raw pickup to amp sim

A practical guide to building a full digital signal chain — string, pickup, guitar wiring, cable, pedals, amp, and cabinet — split by which modeling technique fits each stage.

## Pipeline overview

```
String excitation
      ↓
Pickup            ─┐  physical circuit modeling
      ↓             │  (Wave Digital Filters)
Guitar wiring       │
      ↓             │
Cable             ─┘
      ↓
Pedals            ─┐
      ↓             │  DSP / nonlinear processing
Preamp              │  (waveshaping, neural, IR convolution)
      ↓             │
Power amp           │
      ↓             │
Cab + mic         ─┘
```

The chain splits into two fundamentally different modeling problems: the guitar's own electronics (source, pickup, wiring, cable) are a passive analog circuit and are best modeled *as a circuit*. Everything downstream (pedals, amp, cab) is a mix of nonlinear processing and convolution, where you have more freedom to choose between physical and black-box approaches.

## 1. String excitation

This is the raw source signal, before any electronics. Two options:

- **Physical string model** — Karplus-Strong or a digital waveguide, if you want fully synthetic input.
- **Captured raw signal** — a recording taken directly off the coil, before any tone/volume shaping, if you want to drive the rest of the chain with real playing.

## 2. Pickup

Electrically, a magnetic pickup is a lossy RLC resonant circuit: coil DC resistance, coil inductance, and parasitic (plus cable) capacitance combine into a resonant peak, typically in the 2–5 kHz range. Important detail: this resonance is **load-dependent** — it shifts with volume pot position, cable capacitance, and amp input impedance. A physically accurate sim treats pickup + wiring + cable + amp input as one loaded network rather than independent cascaded filters (cascading is a common simplification, but less accurate).

## 3. Guitar wiring

This is the passive network of pots, caps, and switches — volume, tone, blend, phase switching, whatever the actual build is. **Wave Digital Filters (WDF)** are the standard technique for real-time-accurate simulation of this kind of network, including switches and variable pots.

- Library: [`chowdsp_wdf`](https://github.com/Chowdhury-DSP/chowdsp_wdf) — header-only C++, by Jatin Chowdhury, with existing guitar-electronics (tone/volume) examples to build from.
- This is the stage worth modeling exactly rather than approximating, since it's specific to a given wiring build (e.g. a push-pull phase switch, a half-blender pot, a shaped tone cap/resistor pair).

## 4. Cable

An instrument cable's capacitance forms a simple RC lowpass with the pickup's resistance/inductance, subtly darkening tone over longer cable runs. Model as a one-pole lowpass, or fold it directly into the loaded pickup+wiring network above for accuracy.

## 5. Pedals

Split into two categories:

- **Linear effects** (EQ, delay, chorus, reverb) — ordinary digital filters and delay lines.
- **Nonlinear effects** (fuzz, overdrive, distortion) — three approaches, in increasing accuracy and effort:
  1. Memoryless waveshaper (tanh/arctan/diode-equation approximation) + oversampling to control aliasing.
  2. Full circuit-accurate solve — WDF or nodal DK-method, solving diode/transistor equations per sample via Newton-Raphson.
  3. Black-box neural modeling — record real input/output pairs from the pedal, train a small WaveNet/LSTM/GRU to learn the transfer function. This is how Neural Amp Modeler and Tonex work, and it sidesteps needing the schematic entirely.

## 6. Preamp

Tube gain stages: cascaded nonlinear waveshapers (asymmetric clipping curves resembling triode grid conduction) with their own frequency response. The **tone stack** (bass/mid/treble network between gain stages, e.g. Fender or Marshall topology) is a passive R/C/pot network with published transfer functions in the DSP literature — a strong second WDF target after the guitar wiring, since it's the same class of problem.

## 7. Power amp

Adds its own saturation curve (often gentler than preamp clipping, with class-dependent character) plus **sag** — power supply voltage drooping under drive, heard as dynamic compression tied to playing intensity. Typically modeled with an envelope follower feeding back into the gain stage's bias point.

## 8. Cabinet + mic

Almost always handled as **convolution with a measured impulse response (IR)** captured from a real speaker + mic combination. This alone gets most of the "amp in the room" character. Multi-mic blending, room IR, or a physically modeled speaker cone are advanced options, rarely worth it over good IRs.

## Implementation recommendations

- **Real-time engine**: C++ with JUCE, or Rust with `nih-plug` / `fundsp`, for anything meant to be played through live. Python (numpy/scipy, PyTorch) is fine for prototyping filter math or training a neural pedal/amp model, then export/port to the real-time engine.
- **WDF stages** (guitar wiring, tone stack, some pedal topologies): `chowdsp_wdf`.
- **Neural black-box stages** (pedals, amps): prototype training in PyTorch, then run inference via ONNX/RTNeural in C++, or build on the open-source Neural Amp Modeler (NAM) core directly.
- **Validation**: simulate the actual schematic in LTspice and compare its frequency response against your WDF implementation's output — a good sanity check before trusting the DSP code, especially for a custom wiring build.

## Suggested build order

1. Crude end-to-end chain: raw signal → simple tone filter → tanh clipper → IR convolution. Get sound out first.
2. Replace the guitar wiring block with a WDF model of the actual circuit (validated against LTspice).
3. Replace the tone stack with a proper WDF-modeled version.
4. Replace waveshaper approximations with circuit-accurate or neural models for specific pedals/amps, one at a time.
