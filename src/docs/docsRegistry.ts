/**
 * docsRegistry.ts — Searchable Documentation Catalog for Cords Box
 *
 * Covers:
 * 1. Hardware & Circuits: Pickup RLC Physics, Pot Tapers & Treble Bleed Networks
 * 2. WDF DSP Physics: Wave Variables, Adaptor Scattering & Tone Stacks
 * 3. Audio & Tab Player: Karplus-Strong Waveguides, Thiran Allpass & Articulations
 * 4. CAD Shortcuts: Workbench Hotkeys & Navigation
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
    title: 'Guitar Pickups: Transducer Physics & RLC Modeling',
    summary:
      'Faraday induction, coil inductance, load resonance formulas, and magnetic saturation.',
    tags: ['pickups', 'inductance', 'rlc', 'resonance', 'faraday', 'saturation'],
    contentMarkdown: `
# Guitar Pickups: Transducer Physics & RLC Modeling

A passive guitar pickup converts mechanical string vibration into an electrical alternating voltage through electromagnetic induction.

### 1. Faraday's Law of Induction
When a ferromagnetic steel string vibrates inside the static magnetic field of the pole pieces, it modulates the magnetic flux through the copper coil:
$$\\mathcal{E}(t) = -N \\cdot \\frac{d\\Phi_B}{dt} \\propto N \\cdot B_0 \\cdot v_{\\text{string}}(t)$$

where:
- **$N$**: Number of coil turns (typically 7,500 to 10,000 turns of 42/43 AWG wire).
- **$B_0$**: Magnetic field strength at the string position.
- **$v_{\\text{string}}(t)$**: Velocity of string displacement.

### 2. Equivalent RLC Circuit Netlist
A passive pickup is modeled as an AC voltage source in series with its internal impedance:
- **$V_s(t)$**: Open-circuit induced signal voltage.
- **$R_{\\text{dc}}$**: Coil DC winding resistance (5.5 kΩ to 16.0 kΩ).
- **$L_{\\text{coil}}$**: Coil self-inductance (2.0 H to 8.5 H).
- **$C_{\\text{winding}}$**: Distributed inter-turn winding capacitance (80 pF to 180 pF).

### 3. System Resonant Peak Frequency Formula
When connected to an instrument cable and amplifier, the system forms a 2nd-order resonant low-pass filter:
$$f_0 = \\frac{1}{2\\pi \\sqrt{L_{\\text{coil}} \\cdot (C_{\\text{winding}} + C_{\\text{cable}} + C_{\\text{amp}})}}$$

**Example Calculation:**
- Single-Coil ($L = 2.4\\text{ H}$, $C_{\\text{winding}} = 100\\text{ pF}$)
- 15ft Instrument Cable ($C_{\\text{cable}} = 450\\text{ pF}$) + Amp Input ($C_{\\text{amp}} = 50\\text{ pF}$)
- Total Capacitance $C_{\\text{total}} = 600\\text{ pF}$
- Loaded Resonant Peak:
$$f_0 = \\frac{1}{2\\pi \\sqrt{2.4 \\times 600 \\times 10^{-12}}} \\approx 4.19\\text{ kHz}$$

### 4. Damping & Quality Factor ($Q$)
The height and sharpness of the resonant peak is controlled by the resistive load ($R_{\\text{load}} = R_{\\text{pot}} \\parallel R_{\\text{amp}}$):
$$Q = \\frac{R_{\\text{load}}}{\\omega_0 L_{\\text{coil}}} = \\frac{R_{\\text{pot}} \\parallel R_{\\text{amp}}}{2\\pi f_0 L_{\\text{coil}}}$$

- Lower pot resistance (250kΩ vs 500kΩ) increases damping (lowers $Q$), smoothing out harsh high-frequency peaks.

### 5. Nonlinear Magnetic Saturation
Strong initial string pluck transients cause soft magnetic pole saturation modeled by a 3rd-order polynomial:
$$v_{\\text{out}}[n] = v_{\\text{in}}[n] - \\alpha \\cdot \\left(v_{\\text{in}}[n]\\right)^3, \\quad \\alpha \\approx 0.15$$

### 6. Common Pickup Types & Specs
| Pickup Type | Typical Inductance ($L$) | Resistance ($R$) | Resonant Peak | Character |
| :--- | :--- | :--- | :--- | :--- |
| **Single Coil (Strat/Tele)** | 2.2 – 2.8 H | 5.8 – 6.8 kΩ | 3.2 – 4.5 kHz | Glassy, chimey, articulate, prone to 60Hz hum |
| **P90 (Soapbar)** | 3.0 – 3.8 H | 7.0 – 8.5 kΩ | 2.6 – 3.4 kHz | Gritty, aggressive midrange, punchy attack |
| **Humbucker (PAF style)** | 4.0 – 5.0 H | 7.5 – 9.0 kΩ | 2.0 – 2.8 kHz | Warm, fat, thick low-mids, hum-cancelling |
| **High-Output Humbucker** | 6.5 – 9.0 H | 12.0 – 16.0 kΩ | 1.5 – 2.0 kHz | Compressed, heavy saturation, focused mids |
`,
  },
  {
    id: 'doc_pots_tapers',
    category: 'Hardware & Circuits',
    title: 'Potentiometers, Taper Curves & Treble Bleed Networks',
    summary:
      'Transfer functions for audio vs linear tapers, volume dividers, and treble bleed networks.',
    tags: ['potentiometer', 'taper', 'treble bleed', 'rc filter', 'voltage divider'],
    contentMarkdown: `
# Potentiometers, Tapers & Treble Bleed Networks

A potentiometer is a 3-terminal variable voltage divider where rotation parameter $p \\in [0, 1]$ sets the wiper position.

### 1. Mathematical Taper Transfer Functions
- **Linear Taper (Type B)**:
  $$R_{\\text{wiper}}(p) = R_{\\text{total}} \\cdot p$$
  Used for linear resistance sweeps (e.g. blend pots and precise Tone stack controls).

- **Audio / Logarithmic Taper (Type A)**:
  $$R_{\\text{wiper}}(p) = R_{\\text{total}} \\cdot p^2$$
  Compensates for the human ear's logarithmic loudness perception (Weber-Fechner law), giving smooth volume decay from 10 down to 0.

- **Reverse Audio Taper (Type C)**:
  $$R_{\\text{wiper}}(p) = R_{\\text{total}} \\cdot \\left(1 - (1 - p)^2\\right)$$

### 2. Master Volume Voltage Divider
For a volume pot connected between input (Lug 3), wiper output (Lug 2), and ground (Lug 1):
$$V_{\\text{out}} = V_{\\text{in}} \\cdot \\frac{R_{\\text{lower}}(p)}{R_{\\text{upper}}(p) + R_{\\text{lower}}(p)}$$
where $R_{\\text{lower}}(p) = R_{\\text{pot}} \\cdot p^2$ and $R_{\\text{upper}}(p) = R_{\\text{pot}} \\cdot (1 - p^2)$.

### 3. Master Tone Low-Pass Cutoff Formula
The Tone pot and capacitor form a variable shunt RC low-pass filter:
$$f_c(p) = \\frac{1}{2\\pi \\cdot R_{\\text{tone}}(p) \\cdot C_{\\text{tone}}}$$

- With a $0.047\\,\\mu\\text{F}$ capacitor and tone pot at 10% ($R \\approx 25\\text{ k}\\Omega$):
$$f_c = \\frac{1}{2\\pi \\cdot 25000 \\cdot 47 \\times 10^{-9}} \\approx 135\\text{ Hz}$$

### 4. Treble Bleed High-Pass Bypass Network
When the volume pot is turned down, the series resistance $R_{\\text{upper}}$ forms a low-pass filter with the cable capacitance ($C_{\\text{cable}} \\approx 500\\text{ pF}$), causing loss of high frequencies. A Treble Bleed capacitor ($C_{\\text{bleed}} \\approx 1000\\text{ pF}$) across Lug 3 and Lug 2 provides a high-frequency bypass:
$$Z_{\\text{bleed}}(s) = \\frac{R_{\\text{bleed}}}{1 + s \\cdot R_{\\text{bleed}} \\cdot C_{\\text{bleed}}}$$
`,
  },
  {
    id: 'doc_wdf_dsp',
    category: 'WDF DSP Physics',
    title: 'Wave Digital Filters: Passive Circuit Modeling in Real Time',
    summary:
      'Fettweis wave variables, bilinear transform, series and parallel adaptor scattering math.',
    tags: ['wdf', 'physics', 'wave variables', 'fettweis', 'scattering', 'tone stack'],
    contentMarkdown: `
# Wave Digital Filter (WDF) Modeling Physics

Cords Box implements Alfred Fettweis's Wave Digital Filter theory to solve arbitrary passive RLC networks without matrix inversions.

### 1. Incident and Reflected Wave Variables
Signals are transformed from voltage ($V$) and current ($I$) into wave variables with reference port resistance $R_0$:
$$a = V + I \\cdot R_0 \\quad (\\text{incident wave}), \\qquad b = V - I \\cdot R_0 \\quad (\\text{reflected wave})$$

### 2. Bilinear Transform for Reactive Components
Using trapezoidal integration ($s \\approx \\frac{2}{T} \\frac{1 - z^{-1}}{1 + z^{-1}}$) with sample period $T = 1 / f_s$:
- **Capacitor**: Port resistance $R_C = \\frac{T}{2C}$, State update $b_C[n] = a_C[n-1]$
- **Inductor**: Port resistance $R_L = \\frac{2L}{T}$, State update $b_L[n] = -a_L[n-1]$
- **Resistor**: Port resistance $R_0 = R$, Immediate reflection $b_R[n] = 0$

### 3. 3-Port Fettweis Adaptor Scattering Equations
To connect 3 circuit ports without delay-free algebraic loops, port 0 is chosen as the unadapted port:

**Series Adaptor ($R_0 = R_1 + R_2$):**
$$\\gamma_1 = \\frac{2 R_1}{R_0 + R_1 + R_2}, \\qquad \\gamma_2 = \\frac{2 R_2}{R_0 + R_1 + R_2}$$
$$b_0 = -(b_1 + b_2)$$
$$a_1 = b_1 - \\gamma_1 \\cdot (b_1 + b_2 + a_0)$$
$$a_2 = b_2 - \\gamma_2 \\cdot (b_1 + b_2 + a_0)$$

**Parallel Adaptor ($G_0 = G_1 + G_2$ where $G_k = 1/R_k$):**
$$\\gamma_1 = \\frac{2 G_1}{G_0 + G_1 + G_2}, \\qquad \\gamma_2 = \\frac{2 G_2}{G_0 + G_1 + G_2}$$
$$b_0 = \\gamma_1 b_1 + \\gamma_2 b_2$$
$$a_1 = b_0 + a_0 - b_1$$
$$a_2 = b_0 + a_0 - b_2$$

### 4. Coupled Tone Stacks
Real 3-band amplifier tone stacks (Fender FMV, Marshall JCM800, Vox Top Boost) feature coupled capacitive ladders. The transfer function interactions are evaluated by real-time tree reflection at $48\\text{ kHz}$.
`,
  },
  {
    id: 'doc_audio_tab_fretboard',
    category: 'Audio & Tab Player',
    title: 'Digital Waveguides, Tab Articulations & Pitch DSP',
    summary:
      'Karplus-Strong string delays, 1st-order Thiran allpass interpolation, and tab syntax.',
    tags: ['karplus strong', 'waveguide', 'thiran', 'allpass', 'tab', 'whammy'],
    contentMarkdown: `
# Digital Waveguide String Physics & Tab Player

Guitar strings are simulated using 6 independent Karplus-Strong physical digital waveguides compiled to WebAssembly.

### 1. Loop Delay & Fundamental Pitch Equation
The total loop delay length $N_{\\text{total}}$ required for a fundamental frequency $f_0$ at sample rate $f_s = 48\\text{ kHz}$ is:
$$N_{\\text{total}} = \\frac{f_s}{f_0} - D_{\\text{loopfilter}}$$

where $D_{\\text{loopfilter}} = 0.5\\text{ samples}$ accounts for the phase delay of the 2-point averaging low-pass loop filter ($H(z) = \\frac{1 + z^{-1}}{2}$).

### 2. 1st-Order Thiran Allpass Fractional Delay Filter
To tune strings with continuous sub-sample precision (eliminating pitch quantization jitter), the fractional remainder $\\Delta = N_{\\text{total}} - \\lfloor N_{\\text{total}} \\rfloor$ is filtered through a 1st-order Thiran allpass filter:
$$H_{\\text{Thiran}}(z) = \\frac{\\eta + z^{-1}}{1 + \\eta z^{-1}}, \\qquad \\eta = \\frac{1 - \\Delta}{1 + \\Delta}, \\quad \\Delta \\in [0, 1)$$

### 3. Continuous Whammy Bar Pitch Modulation
Pitch bend scaling modulates the delay buffer length smoothly in real time:
$$N(t) = N_0 \\cdot 2^{-\\frac{\\Delta s(t)}{12}}$$
where $\\Delta s(t) \\in [-12, +12]$ is the pitch bend shift in semitones.

### 4. Pickup Comb Filtering (Aperture Position)
The harmonic spectrum of a plucked string depends on the pickup distance $d_{\\text{pickup}}$ from the bridge:
$$H_{\\text{pickup}}(f) = \\left| \\sin\\left( \\frac{\\pi f \\cdot d_{\\text{pickup}}}{2 L_{\\text{string}} \\cdot f_0} \\right) \\right|$$

- Bridge pickups ($d_{\\text{pickup}} \\approx 3\\text{ to }5\\text{ cm}$) have wide harmonic response with high treble presence.
- Neck pickups ($d_{\\text{pickup}} \\approx 15\\text{ to }18\\text{ cm}$) have deep harmonic notches producing a warm, round fundamental tone.
`,
  },
  {
    id: 'doc_cad_shortcuts',
    category: 'CAD Shortcuts',
    title: 'CAD Workbench & Keyboard Shortcuts Reference',
    summary:
      'Productivity keybindings for wiring, component placement, slot management, and view controls.',
    tags: ['shortcuts', 'hotkeys', 'cad', 'wiring', 'navigation'],
    contentMarkdown: `
# CAD Workbench Keyboard Shortcuts Reference

| Shortcut | Function | Description |
| :--- | :--- | :--- |
| **W** | **Toggle Wiring Mode** | Enables clicking component terminals/lugs to route wires |
| **Delete / Backspace** | **Delete Item** | Removes the currently selected component or wire |
| **Ctrl + Z / ⌘ + Z** | **Undo** | Reverts the last wiring or placement operation |
| **Ctrl + Y / ⌘ + Shift + Z** | **Redo** | Restores previously undone operations |
| **Ctrl + C / Ctrl + V** | **Copy / Paste** | Duplicates selected canvas components |
| **R** | **Rotate Component** | Rotates selected component 90° clockwise |
| **H / V** | **Flip Component** | Flips component horizontally or vertically |
| **Ctrl + S / ⌘ + S** | **Save Project** | Saves current canvas state to active slot |
| **Ctrl + E / ⌘ + E** | **Export .cdx** | Exports 1:1 portable project file (.cdx) |
| **Space + Drag** | **Pan Canvas** | Moves the viewport across the workbench |
| **Scroll / Pinch** | **Zoom In / Out** | Smoothly scales canvas from 25% to 300% |
| **1 / 2 / 3** | **Canvas Views** | Switches between Physical, Schematic, and Sound System views |
`,
  },
];
