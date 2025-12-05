
// User Profile Data
export interface UnitSystem {
  system: 'imperial' | 'metric';
  weight: 'lbs' | 'kg';
  height: 'inches' | 'cm';
  distance: 'miles' | 'km';
}

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

export interface Ingredient {
  item: string;
  quantity: string;
  unit: string;
  prep: string;
}

export interface RecipeStepMeta {
    timer?: string;     // e.g. "10 mins"
    technique?: string; // e.g. "Julienne", "High Heat"
    quantity?: string;  // e.g. "2 cups"
}

export interface RecipeSection {
    type: 'Overview' | 'Ingredients' | 'Instructions';
    title: string;      // "Mise en Place", "Step 1: Chop", etc.
    items: string[];    // Legacy support for plain text display
    ingredients?: Ingredient[]; // Structured data
    metadata: RecipeStepMeta; 
}

export interface Recipe {
    id?: string;
    userId?: string;
    title: string; // Database: name
    description: string; // Database: description
    difficulty: string; // Database: difficulty_level
    chefNote: string; // Not in database
    totalTime: number; // Calculated: prep_time + cook_time
    prepTime?: number; // Database: prep_time_minutes
    cookTime?: number; // Database: cook_time_minutes
    calories: number; // Not in database - calculated from ingredients
    protein?: number; // Not in database - calculated from ingredients
    carbs?: number; // Not in database - calculated from ingredients
    fat?: number; // Not in database - calculated from ingredients
    mealType?: string; // Database: meal_type
    servings?: number; // Database: servings
    cuisine: string; // Database: cuisine_type
    dietaryTags?: string[]; // Database: dietary_tags (JSONB array)
    allergens?: string[]; // Database: allergens (JSONB array)
    chefPersona: string; // Not in database - UI only
    imageUrl?: string; // Database: image_url
    isFavorite?: boolean; // Database: is_favorite
    isPublic?: boolean; // Database: is_public
    createdAt?: string;
    sections: RecipeSection[];
}

// --- INVENTORY & SHOPPING SCHEMA ---

export interface Location {
    id: string;
    name: string;
    icon?: string;
}

export interface InventoryItem {
  id: string; // user_inventory_id
  ingredientId: string; // NOTE: Despite the name, this contains ingredient_name (TEXT), not a UUID
                        // Kept for backward compatibility with existing code
  name: string; // Ingredient name - use this field for display and logic
  quantity?: number; // Database: quantity field
  unit?: string; // Database: unit field
  locationId?: string;
  locationName?: string; // For display
  category?: string; // Produce, Dairy, etc.
  inStock: boolean;
}

export interface ShoppingListItem {
    id: string;
    ingredientId: string; // NOTE: Despite the name, this contains ingredient_name (TEXT), not a UUID
                          // Kept for backward compatibility with existing code
                          // In practice, 'name' field should be used instead
    name: string; // Ingredient name - use this field for display and logic
    isChecked: boolean;
}

export interface AuditItem {
  name: string; // Display name from Recipe
  canonicalId?: string; // Matched ID (if any)
  qty: string;
  unit: string;
  inStock: boolean; // The toggle state
  inventoryId?: string; // If exists in DB
}