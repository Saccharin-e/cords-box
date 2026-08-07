# String Studio — Electric Guitar sample pack (v4)

Real-instrument multisamples derived from **Black And Green Guitars** by
Karoryfer Samples. Licensed CC0-1.0 — the source library is public
domain, and so is this repackage.

**Pack version**: 4 (Karoryfer real-recording pack)
**Source URL**: https://github.com/sfzinstruments/karoryfer.black-and-green-guitars/releases/download/v1.000/Karoryfer_Black_And_Green_Guitars_1000.zip
**Sample rate**: 48000 Hz, mono, 24-bit PCM WAV
**Render duration**: 2.5 s per zone (trimmed from source, peak-normalized to −3 dBFS, 50 ms tail fade)

## Runtime DSP & Pipeline Integration

1. **Sample Bank Loader**: The runtime `SampleBank` (`src/audio/sampleBank.ts`) loads the sample manifest (`manifest.json`) and matches incoming MIDI pitches/velocities to the nearest recorded zone.
2. **Formant Filtering**: `pipeline.ts` applies adaptive highpass/lowpass biquad filtering depending on pitch-shift ratio (`playbackRate`) to preserve body formants and prevent sub-bass mud when shifting across the fretboard.
3. **Polyphony Gain Floor**: Dynamic gain floor scaling (`0.3 / Math.sqrt(chordSize)`) prevents peak bus clipping during multi-string strumming.
4. **WDF Circuit Solver Routing**: Playback routes directly into `wdfWorkletNode` (`guitar-processor`) to apply real-time passive guitar circuit filtering (volume/tone pots, caps, pickup coil loading).

For full original multisample sets (additional pitch zones, velocity layers, round-robins, articulations, fingering noises, release samples), download the source library directly from Karoryfer Samples.
