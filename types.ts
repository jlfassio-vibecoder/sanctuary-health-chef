
// User Profile Data (Static)
export type UnitSystem = 'standard' | 'metric';

export interface UserProfile {
  age: number;
  gender: string;
  weight: number; // stored in lbs if standard, kg if metric
  height: number; // stored in inches if standard, cm if metric
  units: UnitSystem;
  goals: string[];
  medicalConditions: string[]; // Used for Dietary Restrictions
  injuries: string[]; // Used for Allergies
  preferences: string[]; // Used for Dislikes/Kitchen Equipment
  fitnessLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite'; // Used for Cooking Skill
}

// Daily Check-in Data (Dynamic)
export interface DailyContext {
  duration: number; // minutes available to cook
  sleepQuality: number; // Used for "Hunger Level" 1-10
  energyLevel: number; // Used for "Mood/Energy" 1-10
  soreness: string[]; // Used for "Cravings"
  targetMuscleGroups: string[]; // Used for "Ingredients on Hand"
  equipmentAvailable: string[];
  workoutType: string; // N/A
  selectedFocus: string; // The specific cuisine/meal type
}

// Chef Persona (formerly TrainerType)
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
    "Mediterranean Diet", "Balanced Macros", "Whole Foods",
    "Stable Energy", "Fiber Rich", "Low Glycemic", "Family Favorites"
  ],
  [TrainerType.HYPERTROPHY]: [
    "Post-Workout Anabolic", "Lean Bulk", "High Protein/Low Fat",
    "Carb Loading", "Chicken & Rice Remix", "Steak & Potatoes", "Egg Variations"
  ],
  [TrainerType.POWERLIFTING]: [
    "Calorie Dense", "Comfort Food", "Slow Cooker/Stews",
    "Cheat Meal Style", "Heavy Carbs", "Game Day Snacks", "Fueling Performance"
  ],
  [TrainerType.YOGA]: [
    "Vegan/Vegetarian", "Raw Foods", "Superfood Smoothies",
    "Ayurvedic Inspired", "Light Salads", "Grain Bowls", "Detox"
  ],
  [TrainerType.HIIT]: [
    "One-Pan Meals", "5-Ingredient Recipes", "Meal Prep Batches",
    "No-Cook Options", "High Energy Snacks", "Breakfast on the Go", "Air Fryer"
  ],
  [TrainerType.REHAB]: [
    "Anti-Inflammatory", "Low FODMAP", "Bone Broths",
    "Easy Digestion", "Gluten-Free", "Probiotic Rich", "Recovery Shakes"
  ]
};

// Structured Recipe Response (Mapped to Workout Interfaces for DB compatibility)
// We are piggybacking on existing names to avoid database migration
export interface ExerciseSet {
  reps?: string; // Used for Quantity (e.g., "2 cups")
  weight?: string; // Used for Notes (e.g., "Chopped")
  actualWeight?: string; // User logged adjustment
  duration?: string; // e.g., "5 mins"
  rest?: string; // Used for "Technique" or "Heat Level"
  notes?: string;
  isUserAdded?: boolean;
}

export interface Exercise {
  name: string; // Ingredient Name or Step Title
  sets: number;
  setDetails: ExerciseSet[];
  tempo?: string; // Used for "Method" (e.g., Bake, Fry)
  cues: string[]; // Used for Tips/Tricks
  muscleTarget: string; // Used for "Category" (e.g., Protein, Veg, Prep)
}

export interface WorkoutSection {
  type: 'Warmup' | 'Main Workout' | 'Cooldown' | 'Finisher'; // Used for "Mise en Place", "Cooking", "Plating"
  exercises: Exercise[];
  durationEstimate: string;
}

export interface WorkoutPlan {
  id?: string; // Database ID
  createdAt?: string; // ISO Date string
  trainerType?: TrainerType; // The Chef Persona
  focus?: string; // Cuisine/Meal Type
  title: string; // Recipe Name
  description: string; // Description
  difficulty: string; // Cooking Skill Level
  trainerNotes: string; // Chef's Intro
  sections: WorkoutSection[];
  totalDuration: number; // Cook Time
  estimatedCalories: number; // Calories
}