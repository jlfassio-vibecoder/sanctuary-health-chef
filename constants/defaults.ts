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
 * Used when user profile is not found or cannot be loaded
 */
export const DEFAULT_PROFILE_VALUES = {
  age: 30,
  gender: 'Other' as const,
  weight: 170,
  height: 70,
  units: DEFAULT_UNITS,
  goals: [] as string[],
  medicalConditions: [] as string[],
  injuries: [] as string[],
  preferences: [] as string[],
  fitnessLevel: 'Intermediate' as const
};

