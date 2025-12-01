
// User Profile Data
export type UnitSystem = 'standard' | 'metric';

export interface UserProfile {
  age: number;
  gender: string;
  weight: number; 
  height: number;
  units: UnitSystem;
  goals: string[];
  medicalConditions: string[]; // Dietary Restrictions
  injuries: string[]; // Allergies
  preferences: string[]; // Dislikes/Equipment
  fitnessLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite'; // Cooking Skill
}

// Daily Context
export interface DailyContext {
  duration: number; // minutes
  sleepQuality: number; // Hunger Level 1-10
  energyLevel: number; // Mood 1-10
  soreness: string[]; // Cravings
  targetMuscleGroups: string[]; // Ingredients on Hand
  equipmentAvailable: string[];
  workoutType: string;
  selectedFocus: string;
}

// Chef Persona
export enum TrainerType {
  FUNCTIONAL = 'The Balanced Nutritionist',
  HYPERTROPHY = 'The High-Protein Chef',
  POWERLIFTING = 'The Hearty Home Cook',
  YOGA = 'The Plant-Forward Alchemist',
  HIIT = 'The 15-Minute Gourmet',
  REHAB = 'The Gut Health Specialist'
}

export const TRAINER_FOCUS_OPTIONS: Record<TrainerType, string[]> = {
  [TrainerType.FUNCTIONAL]: [
    "Mediterranean Diet", "Balanced Macros", "Whole Foods", "Family Favorites"
  ],
  [TrainerType.HYPERTROPHY]: [
    "Post-Workout Anabolic", "Lean Bulk", "High Protein/Low Fat", "Steak & Potatoes"
  ],
  [TrainerType.POWERLIFTING]: [
    "Calorie Dense", "Comfort Food", "Slow Cooker/Stews", "Game Day Snacks"
  ],
  [TrainerType.YOGA]: [
    "Vegan/Vegetarian", "Raw Foods", "Ayurvedic Inspired", "Grain Bowls"
  ],
  [TrainerType.HIIT]: [
    "One-Pan Meals", "5-Ingredient Recipes", "Meal Prep Batches", "Air Fryer"
  ],
  [TrainerType.REHAB]: [
    "Anti-Inflammatory", "Low FODMAP", "Bone Broths", "Gluten-Free"
  ]
};

// --- NEW RECIPE SCHEMA ---

export interface RecipeStepMeta {
    timer?: string;     // e.g. "10 mins"
    technique?: string; // e.g. "Julienne", "High Heat"
    quantity?: string;  // e.g. "2 cups"
}

export interface RecipeSection {
    type: 'Overview' | 'Ingredients' | 'Instructions';
    title: string;      // "Mise en Place", "Step 1: Chop", etc.
    items: string[];    // Ingredient list OR Instruction text
    metadata: RecipeStepMeta; 
}

export interface Recipe {
    id?: string;
    userId?: string;
    title: string;
    description: string;
    difficulty: string;
    chefNote: string;
    totalTime: number;
    calories: number;
    cuisine: string;
    chefPersona: string; // Formerly trainerType
    imageUrl?: string;
    createdAt?: string;
    sections: RecipeSection[];
}
