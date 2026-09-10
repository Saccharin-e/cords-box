/**
 * tutorialRegistry.ts — Catalog of Guided Step-by-Step Interactive Wiring Tutorials
 */

import type { TutorialLesson } from './types';

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: 'tutorial_wiring_101',
    title: 'Guitar Wiring 101: Your First Stratocaster Circuit',
    subtitle: 'From Pickups to Jack — Understand Signal Flow & Grounding',
    difficulty: 'Beginner',
    durationMinutes: 8,
    iconName: 'Guitar',
    description:
      'Learn the essentials of passive guitar electronics: placing pickups, wiring a 5-way blade switch, connecting master volume and tone potentiometers, and soldering the output jack.',
    tags: ['stratocaster', 'basics', '5-way switch', 'grounding'],
    templateStarterId: 'guitar_sound_test_template',
    steps: [
      {
        id: 'step_1',
        stepNumber: 1,
        title: 'Understand the Pickup Hot & Ground Wires',
        instruction: 'Identify the 3 pickups on the canvas: Neck, Middle, and Bridge.',
        explanation:
          'Each pickup generates an AC voltage across its coil. The black wire goes to a common ground star (usually the back of the volume pot), while the hot wire carries the guitar signal to the selector switch.',
        tip: 'Single coils typically have ~6.5kΩ DC resistance and 2.4 Henries inductance.',
        targetComponentType: 'pickup_single_coil',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        title: 'Route Hot Leads to the 5-Way Blade Switch',
        instruction:
          'Connect the hot terminal of each pickup to its respective lug on the 5-way switch.',
        explanation:
          'The 5-way blade switch selects which pickup coil feeds into the volume control. In positions 2 and 4, two coils connect in parallel for the iconic "quack" tone.',
        tip: 'Click on a component lug in Wiring Mode (W) to start drawing a wire.',
        targetComponentType: 'switch_5way',
      },
      {
        id: 'step_3',
        stepNumber: 3,
        title: 'Connect the Common Switch Output to Master Volume',
        instruction:
          'Wire the common output lug of the 5-way switch to Lug 3 (Input) of the Volume Pot.',
        explanation:
          'A guitar volume pot acts as a variable voltage divider. Lug 1 is grounded, Lug 3 receives the selector switch signal, and the middle Lug 2 (Wiper) delivers the attenuated signal to the output.',
        targetComponentType: 'pot_volume',
      },
      {
        id: 'step_4',
        stepNumber: 4,
        title: 'Add the Master Tone Circuit & Capacitor',
        instruction:
          'Connect the Tone Pot and its .047µF capacitor across the volume input line to ground.',
        explanation:
          'The Tone Pot and capacitor form a variable low-pass RC filter. Rolling down the tone pot shunts higher harmonic frequencies to ground, darkening the guitar tone.',
        tip: 'Higher capacitor values (e.g. .047µF vs .022µF) create a deeper, warmer roll-off.',
        targetComponentType: 'pot_tone',
      },
      {
        id: 'step_5',
        stepNumber: 5,
        title: 'Solder to the 1/4" Output Jack & Test Audio',
        instruction:
          'Connect Volume Lug 2 (Wiper) to Jack Tip, and bridge all grounds to Jack Sleeve.',
        explanation:
          'Your passive guitar circuit is complete! Press the "Sound Test Bench" button in the toolbar to strum the virtual strings and hear your circuit modeled through the Wave Digital Filter engine.',
        targetComponentType: 'output_jack',
      },
    ],
  },
  {
    id: 'tutorial_series_parallel',
    title: 'Series vs. Parallel Switching with 4-Way Telecaster',
    subtitle: 'Unlock Fat Humbucker Tones from Dual Single Coils',
    difficulty: 'Intermediate',
    durationMinutes: 10,
    iconName: 'Sliders',
    description:
      'Standard Telecaster positions run Neck and Bridge in parallel (bright & chimey). Learn how to wire a 4-way switch to place both coils in series for a massive, boosted humbucker-style midrange punch.',
    tags: ['telecaster', 'series', 'parallel', '4-way switch', 'boost'],
    templateStarterId: 'tele_modern_4way',
    steps: [
      {
        id: 'step_1',
        stepNumber: 1,
        title: 'Parallel vs. Series Impedance Physics',
        instruction: 'Inspect the 4-way switch lugs on the Telecaster canvas.',
        explanation:
          'In parallel, combined inductance drops to L/2 (brighter resonance). In series, inductances add (L1 + L2 = 5H+), doubling output voltage and dramatically lowering the resonant frequency for a thicker, louder tone.',
        targetComponentType: 'switch_4way',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        title: 'Isolating the Neck Pickup Metal Cover',
        instruction:
          'Ensure the neck pickup cover has a dedicated ground wire separate from the coil negative.',
        explanation:
          'When putting pickups in series, the negative lead of the neck pickup is lifted from ground and connected to the bridge hot lead. A separate ground wire keeps the metal cover shielded.',
        targetComponentType: 'pickup_single_coil',
      },
      {
        id: 'step_3',
        stepNumber: 3,
        title: 'Testing Positions 1 through 4',
        instruction: 'Toggle the 4-way switch between Bridge, Parallel, Neck, and Series modes.',
        explanation:
          'Position 4 provides a noticeable +3 dB to +6 dB volume and midrange boost compared to standard Position 2 parallel.',
      },
    ],
  },
  {
    id: 'tutorial_treble_bleed',
    title: 'Mastering Treble Bleed Networks',
    subtitle: 'Keep Your Highs Crisp When Rolling Back Volume',
    difficulty: 'Intermediate',
    durationMinutes: 7,
    iconName: 'Zap',
    description:
      'Guitar cables have ~500pF of capacitance that, when combined with a rolled-back volume pot, creates a low-pass filter that muddies your tone. Learn how to wire a treble bleed network to preserve brilliance.',
    tags: ['treble bleed', 'capacitors', 'tone clarity', 'volume pot'],
    templateStarterId: 'guitar_sound_test_template',
    steps: [
      {
        id: 'step_1',
        stepNumber: 1,
        title: 'Why Guitars Lose Treble at Low Volume',
        instruction: 'Observe the volume potentiometer and cable capacitance in the canvas.',
        explanation:
          'When volume is turned to 5, the top half of the pot (~125kΩ) forms an RC lowpass filter with the instrument cable capacitance, rolling off frequencies above 2.5 kHz.',
        targetComponentType: 'pot_volume',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        title: 'Wiring a High-Pass Bypass Capacitor',
        instruction:
          'Connect a 1000pF (1nF) capacitor across Lug 3 (In) and Lug 2 (Wiper) of the volume pot.',
        explanation:
          'The small capacitor allows high-frequency audio to bypass the resistance divider, retaining glassy highs even at low volume levels.',
        targetComponentType: 'treble_bleed',
      },
      {
        id: 'step_3',
        stepNumber: 3,
        title: 'Comparing Kinman vs. Parallel Bleed Circuits',
        instruction: 'Add a 150kΩ resistor in series or parallel with the treble bleed capacitor.',
        explanation:
          'Adding a resistor prevents the tone from sounding overly bright or thin as the volume approaches 1-2.',
      },
    ],
  },
  {
    id: 'tutorial_phase_inversion',
    title: 'Phase Inversion & The Peter Green Sound',
    subtitle: 'DPDT Switches & Out-of-Phase Acoustic Honk',
    difficulty: 'Advanced',
    durationMinutes: 12,
    iconName: 'Activity',
    description:
      'Discover the famous Peter Green hollow, vocal tone by reversing the electrical phase of one pickup relative to the other using a push-pull DPDT switch.',
    tags: ['phase', 'dpdt', 'peter green', 'push-pull', 'humbucker'],
    templateStarterId: 'tele_modern_4way',
    steps: [
      {
        id: 'step_1',
        stepNumber: 1,
        title: 'The Physics of Out-of-Phase Cancellation',
        instruction: 'Examine the dual pickups and their magnetic/electrical polarities.',
        explanation:
          'When two pickups sensing the same vibrating string are connected out-of-phase (180° inversion), the fundamental bass frequencies cancel out, leaving a distinctive hollow, quacky, vocal midrange.',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        title: 'Wiring an X-Crossover on a DPDT Switch',
        instruction:
          'Cross-wire the outer lugs of the DPDT switch and connect the center poles to the pickup leads.',
        explanation:
          'The DPDT switch acts as a polarity reverser, flipping the hot and ground leads of the neck pickup with one toggle.',
        targetComponentType: 'switch_dpdt',
      },
    ],
  },
];
