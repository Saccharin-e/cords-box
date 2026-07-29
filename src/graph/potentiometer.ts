/**
 * Potentiometer Model
 *
 * Calculates effective resistance based on wiper position and taper (FR-6).
 */

import type { PotTaper } from './types';

/** Calculate effective resistance for a pot given position and taper */
export function calculatePotResistance(
  totalResistanceKohms: number,
  position: number,
  taper: PotTaper,
): number {
  const clamped = Math.max(0, Math.min(1, position));
  switch (taper) {
    case 'linear':
      return totalResistanceKohms * clamped;
    case 'audio':
      // Approximate audio taper: logarithmic curve
      return totalResistanceKohms * Math.pow(clamped, 2.5);
    case 'reverse_audio':
      return totalResistanceKohms * (1 - Math.pow(1 - clamped, 2.5));
    default:
      return totalResistanceKohms * clamped;
  }
}

/** Calculate the voltage divider ratio for a tone pot + cap */
export function calculateToneRolloff(
  potResistanceKohms: number,
  capPf: number,
  frequencyHz: number,
): number {
  const rOhms = potResistanceKohms * 1000;
  const cFarads = capPf * 1e-12;
  const xc = 1 / (2 * Math.PI * frequencyHz * cFarads);
  return xc / Math.sqrt(rOhms * rOhms + xc * xc);
}
