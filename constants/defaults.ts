/**
 * Default Values for FitCopilot Chef
 * Shared constants to ensure consistency across the application
 */

import type { UnitSystem } from '../types';

/**
 * Color tokens for the Chef app
 */
export const COLORS = {
  // Brand colors
  GOLD_PRIMARY: '#f0dc7a',
  GOLD_LIGHT: '#f4e59c',
  GOLD_MEDIUM: '#e6d185',
  GOLD_DARK_1: '#d4c469',
  GOLD_DARK_2: '#b8a85e',
  GOLD_DARK_3: '#9c8c53',
  GOLD_DARK_4: '#807048',
  GOLD_DARK_5: '#6b5d3c',
  GOLD_LIGHT_1: '#faf5e1',
  GOLD_LIGHT_2: '#fdfaf0',
  
  // Functional colors
  ERROR_RED: '#EF4444',
} as const;

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

