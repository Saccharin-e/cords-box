/**
 * docsRegistry.ts — Searchable Documentation Catalog for Cords Box
 *
 * Covers:
 * 1. Hardware & Passive Circuit Components (Pickups, Pots & Tapers, Caps, Switches, Jacks)
 * 2. Wave Digital Filter (WDF) DSP Engine Physics
 * 3. Playable Fretboard, Tab Notation & MIDI Synthesizer
 * 4. CAD Canvas & Keyboard Shortcuts
 */

export interface DocArticle {
  id: string;
  category: 'Hardware & Circuits' | 'WDF DSP Physics' | 'Audio & Tab Player' | 'CAD Shortcuts';
  title: string;
  summary: string;
  contentMarkdown: string;
  tags: string[];
}

export const DOC_ARTICLES: DocArticle[] = [
  {
    id: 'doc_pickups',
    category: 'Hardware & Circuits',
    title: 'Guitar Pickups: Single Coil, Humbucker & P90 Physics',
    summary: 'DC Resistance, Coil Inductance, Resonant Frequency, and Magnetic Pole Pieces.',
    tags: ['pickups', 'inductance', 'humbucker', 'single coil', 'p90'],
    contentMarkdown: `
# Guitar Pickups: Magnetic Transducers

A guitar pickup consists of permanent magnets wrapped with thousands of turns of fine copper wire (typically 42 or 43 AWG). When steel guitar strings vibrate within the magnetic field, they induce a minute AC voltage across the coil via Faraday's law of induction.

### 1. Equivalent Electrical Model
A passive guitar pickup is modeled as:
- **AC Voltage Source ($V_s$)**: Proportional to string displacement velocity.
- **Series DC Resistance ($R_{dc}$)**: 5.5kΩ to 16kΩ depending on turns and wire gauge.
- **Series Inductance ($L$)**: 2.0 to 8.0 Henries.
- **Parallel Distributed Capacitance ($C_p$)**: 80pF to 200pF across coil turns.

### 2. Pickup Characteristics
| Pickup Type | Typical Inductance ($L$) | Resistance ($R$) | Resonant Peak | Character |
| :--- | :--- | :--- | :--- | :--- |
| **Single Coil (Strat/Tele)** | 2.2 – 2.8 H | 5.8 – 6.8 kΩ | 3.2 – 4.5 kHz | Glassy, chimey, articulate, prone to 60Hz hum |
| **P90 (Soapbar)** | 3.0 – 3.8 H | 7.0 – 8.5 kΩ | 2.6 – 3.4 kHz | Gritty, aggressive midrange, punchy attack |
| **Humbucker (PAF style)** | 4.0 – 5.0 H | 7.5 – 9.0 kΩ | 2.0 – 2.8 kHz | Warm, fat, thick low-mids, hum-cancelling |
| **High-Output Humbucker** | 6.5 – 9.0 H | 12 – 16 kΩ | 1.5 – 2.0 kHz | Compressed, heavy saturation, focused mids |
`,
  },
  {
    id: 'doc_pots_tapers',
    category: 'Hardware & Circuits',
    title: 'Potentiometers & Tapers: Audio (Log) vs. Linear',
    summary: 'Why pot tapers matter for natural volume roll-off and tone sweeps.',
    tags: ['potentiometer', 'taper', 'audio taper', 'linear', 'volume', 'tone'],
    contentMarkdown: `
# Potentiometers & Taper Curves

A potentiometer is a three-terminal variable resistor. Lug 1 is grounded, Lug 3 receives input, and Lug 2 (the wiper) slides across the resistive track.

### 1. Taper Curves
- **Linear Taper (Type B)**: Resistance increases linearly ($R = R_{\\text{max}} \\times p$). Ideal for tone controls where uniform capacitance shunting is desired across the knob rotation.
- **Audio / Logarithmic Taper (Type A)**: Resistance follows an exponential curve approximated by $R = R_{\\text{max}} \\times p^2$. Matches the human ear's logarithmic perception of sound pressure levels ($dB$), giving smooth, uniform volume attenuation from 0 to 10.
- **Reverse Audio Taper (Type C)**: $R = R_{\\text{max}} \\times (1 - (1-p)^2)$. Used in specialized balance/blend and active filter circuits.

### 2. Resistance Values: 250kΩ vs 500kΩ vs 1MΩ
- **250kΩ**: Standard for Single-Coil guitars (Fender). Damps high-frequency resonance slightly to smooth out piercing treble.
- **500kΩ**: Standard for Humbuckers (Gibson). Higher resistance loads the pickup less, keeping darker humbuckers bright and clear.
- **1MΩ**: Used in Telecaster Deluxe and Jazzmasters for ultra-bright, glassy highs.
`,
  },
  {
    id: 'doc_wdf_dsp',
    category: 'WDF DSP Physics',
    title: 'Wave Digital Filters: Passive Circuit Modeling in Real Time',
    summary: 'How Cords Box models circuit netlists using wave variables and adaptor trees.',
    tags: ['wdf', 'dsp', 'physics', 'wave digital filter', 'bilinear transform'],
    contentMarkdown: `
# Wave Digital Filter (WDF) Modeling

Unlike traditional black-box equalizers or generic biquads, Cords Box uses **Wave Digital Filters (WDF)** based on Alfred Fettweis's classic physical modeling framework.

### 1. Wave Variables
Signals in WDF are transformed from voltage ($V$) and current ($I$) into incident ($a$) and reflected ($b$) waves:
$$a = V + I \\cdot R_0, \\quad b = V - I \\cdot R_0$$
where $R_0$ is the port resistance chosen to eliminate instantaneous reflection ($b = 0$).

### 2. Physical Components in the WDF Domain
- **Resistor**: $R_0 = R$, reflection $b = 0$.
- **Capacitor (Bilinear Transform)**: $R_0 = \\frac{T}{2C}$, state update $b[n] = a[n-1]$.
- **Inductor**: $R_0 = \\frac{2L}{T}$, state update $b[n] = -a[n-1]$.
- **Series Adaptor**: Connects branches in series ($R_{\\text{series}} = R_1 + R_2$).
- **Parallel Adaptor**: Connects branches in parallel ($G_{\\text{parallel}} = G_1 + G_2$).

### 3. Coupled Tone Stacks
Real amplifier tone stacks (Fender Blackface, Marshall JCM800, Mesa Rectifier, Vox Top Boost) share a coupled resistive ladder. In Cords Box, adjusting the Mid pot physically pulls down Bass and Treble levels just like a real amplifier circuit!
`,
  },
  {
    id: 'doc_audio_tab_fretboard',
    category: 'Audio & Tab Player',
    title: 'Tab Player, MIDI Synthesizer & Articulations',
    summary: 'Digital waveguide string physics, tab notation, whammy bar, and MIDI mapping.',
    tags: ['tab', 'midi', 'whammy', 'karplus strong', 'articulation', 'harmonics'],
    contentMarkdown: `
# Audio Engine & Interactive Tab Player

Cords Box includes a sample-accurate Digital Waveguide / Karplus-Strong string synthesis engine running compiled Rust WebAssembly on a dedicated real-time AudioWorklet thread.

### 1. Tab Notation Syntax
The built-in ASCII tab editor supports standard guitar articulations:
- \`5h7\`: **Hammer-On**
- \`7p5\`: **Pull-Off** (including pull-off to open string: \`5p0\`)
- \`5/7\` or \`7\\5\`: **Slide**
- \`7b9\`: **Pitch Bend** (up 2 semitones)
- \`7~\`: **Vibrato**
- \`<12>\`: **Natural Harmonic**
- \`[7]\`: **Pinch Harmonic** (squeal attack + velocity 0.9)
- \`x\`: **Muted / Dead note**
- \`(5)\`: **Ghost note**

### 2. Whammy Bar & Global Pitch Shift
Use the Whammy Bar slider in the sound test panel or MIDI Pitch Bend Wheel ($\pm 12$ semitones). The DSP scales delay line lengths across all 6 active waveguides simultaneously with 1st-order Thiran allpass fractional interpolation for zero pitch jitter.
`,
  },
  {
    id: 'doc_cad_shortcuts',
    category: 'CAD Shortcuts',
    title: 'CAD Workbench & Keyboard Shortcuts Cheat Sheet',
    summary: 'Productivity hotkeys for fast wiring, component placement, and canvas navigation.',
    tags: ['shortcuts', 'hotkeys', 'cad', 'wiring', 'canvas'],
    contentMarkdown: `
# Keyboard Shortcuts & Navigation

| Key | Action |
| :--- | :--- |
| **W** | Toggle **Wiring Mode** on/off |
| **Delete / Backspace** | Delete selected component or wire |
| **Ctrl + Z / ⌘ + Z** | **Undo** last action |
| **Ctrl + Y / ⌘ + Shift + Z** | **Redo** action |
| **Ctrl + C / Ctrl + V** | Copy / Paste selected components |
| **R** | **Rotate** selected component 90° clockwise |
| **H** | **Flip Horizontally** |
| **V** | **Flip Vertically** |
| **G** | **Group / Ungroup** selected components |
| **Ctrl + S / ⌘ + S** | **Save Project** to current slot |
| **Ctrl + E / ⌘ + E** | **Export .cordsbox** file |
| **Spacebar + Drag** | **Pan** the canvas workspace |
| **Scroll Wheel / Pinch** | **Zoom** in / out |
| **1 / 2 / 3** | Switch **Physical / Schematic / Split** canvas views |
`,
  },
];
