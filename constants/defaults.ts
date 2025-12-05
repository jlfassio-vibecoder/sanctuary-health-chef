/**
 * Default Values for FitCopilot Chef
 * Shared constants to ensure consistency across the application
 */

import type { UnitSystem } from '../types';

/**
 * Default unit system (imperial)
 */
export const DEFAULT_UNITS: UnitSystem = {
  system: 'imperial',
  weight: 'lbs',
  height: 'inches',
  distance: 'miles'
};

/**
 * Default profile values
 */
export const DEFAULT_PROFILE_VALUES = {
  age: 30,
  gender: 'Male' as const,
  weight: 175,
  height: 70,
  units: DEFAULT_UNITS
};

