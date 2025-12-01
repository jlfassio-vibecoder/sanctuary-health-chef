
import { createClient } from '@supabase/supabase-js';
import { Recipe, RecipeSection, UserProfile } from '../types';

// Robust helper to find environment variables
const getEnvVar = (key: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return undefined;
};

// Configuration
const SUPABASE_URL = 
    getEnvVar('VITE_SUPABASE_URL') || 
    getEnvVar('SUPABASE_URL') || 
    "https://gqnopyppoueycchidehr.supabase.co";

const SUPABASE_KEY = 
    getEnvVar('VITE_SUPABASE_KEY') || 
    getEnvVar('SUPABASE_KEY') || 
    "sb_publishable_X5SIUzQz3_kuEd5Uj7oxQQ_wYgO5BYb";

// Initialize Supabase Client
let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase initialized connected to:", SUPABASE_URL);
  } catch (error) {
    console.error("❌ Error initializing Supabase client:", error);
  }
} else {
  console.warn("⚠️ Supabase credentials missing.");
}

export { supabase };

/**
 * Verifies that the database tables exist.
 */
export const verifyDatabaseSchema = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Client not initialized" };

    try {
        // Check Recipes Table
        const { error: recipeError } = await supabase
            .from('recipes')
            .select('id')
            .limit(1);

        if (recipeError) {
            console.error("Recipes Table Verification Error:", recipeError);
            if (recipeError.code === 'PGRST205' || recipeError.message?.includes("does not exist")) {
                 return { success: false, message: "Missing Table: 'recipes'. Please run the Setup SQL." };
            }
            return { success: false, message: `Recipes Table Error: ${recipeError.message}` };
        }

        // Check Profile Attributes
        const { error: profilesError } = await supabase
            .from('profile_attributes')
            .select('id')
            .limit(1);

        if (profilesError && profilesError.code !== 'PGRST116') {
             if (profilesError.code === '42P01' || profilesError.message?.includes("does not exist")) {
                 return { success: false, message: "Missing Table: 'profile_attributes'. Please run the Setup SQL." };
             }
        }

        return { success: true, message: "Database Verified" };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

/**
 * Retrieves the user profile.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;

    try {
        let { data, error } = await supabase
            .from('profile_attributes')
            .select('*')
            .eq('id', userId)
            .single();

        // Fallback for user_id column
        if (!data && (error?.code === 'PGRST116' || !error)) {
             const { data: data2 } = await supabase
                .from('profile_attributes')
                .select('*')
                .eq('user_id', userId)
                .single();
             if (data2) { data = data2; error = null; }
        }

        if (error) {
            if (error.code === 'PGRST116') {
                console.log(`ℹ️ Creating new profile for ${userId}...`);
            } else {
                console.error("Error fetching profile:", error);
            }
            return null;
        }

        if (!data) return null;

        return {
            age: data.age,
            gender: data.gender,
            weight: data.weight,
            height: data.height,
            units: data.units as 'standard' | 'metric',
            fitnessLevel: data.fitness_level as any,
            goals: data.goals || [],
            injuries: data.injuries || [],
            medicalConditions: data.medical_conditions || [],
            preferences: data.preferences || []
        };
    } catch (e) {
        console.error("Unexpected error fetching profile:", e);
        return null;
    }
};

/**
 * Saves/Updates the user profile.
 */
export const saveUserProfile = async (userId: string, profile: UserProfile): Promise<boolean> => {
    if (!supabase) return false;

    try {
        const payload = {
            id: userId,
            user_id: userId,
            age: profile.age,
            gender: profile.gender,
            weight: profile.weight,
            height: profile.height,
            units: profile.units,
            fitness_level: profile.fitnessLevel,
            goals: profile.goals,
            injuries: profile.injuries,
            medical_conditions: profile.medicalConditions,
            preferences: profile.preferences,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('profile_attributes')
            .upsert(payload, { onConflict: 'id' }); 

        if (error) {
            console.error("Error saving profile:", error);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Unexpected error saving profile:", e);
        return false;
    }
};

/**
 * Saves a Recipe to the dedicated 'recipes' and 'recipe_content' tables.
 */
export const saveRecipeToDb = async (recipe: Recipe, userId: string): Promise<string | null> => {
  if (!supabase) return null;

  console.log("Saving recipe to DB...", recipe.title);

  try {
    let recipeId = recipe.id;

    // 1. Insert/Update Parent Recipe Table
    const recipePayload = {
      user_id: userId,
      title: recipe.title,
      description: recipe.description,
      difficulty: recipe.difficulty,
      chef_note: recipe.chefNote,
      total_time: recipe.totalTime,
      calories: recipe.calories,
      cuisine: recipe.cuisine,
      chef_persona: recipe.chefPersona,
      image_url: recipe.imageUrl,
      created_at: recipe.createdAt || new Date().toISOString()
    };

    let data, error;
    
    if (recipeId) {
        const result = await supabase.from('recipes').update(recipePayload).eq('id', recipeId).select('id').single();
        data = result.data;
        error = result.error;
    } else {
        const result = await supabase.from('recipes').insert([recipePayload]).select('id').single();
        data = result.data;
        error = result.error;
    }

    if (error) throw error;
    if (!data || !data.id) throw new Error("No ID returned from save.");

    recipeId = data.id;

    // 2. Handle Content (Ingredients/Steps)
    // Delete existing content for this recipe to replace with new state
    await supabase.from('recipe_content').delete().eq('recipe_id', recipeId);

    const contentToInsert = recipe.sections.map((section, index) => ({
      recipe_id: recipeId,
      section_type: section.type,
      title: section.title,
      items: section.items,
      metadata: section.metadata,
      order_index: index
    }));

    const { error: contentError } = await supabase.from('recipe_content').insert(contentToInsert);
    if (contentError) throw contentError;

    console.log("✅ Recipe saved. ID:", recipeId);
    return recipeId;

  } catch (error: any) {
    console.error("Critical error saving recipe:", error);
    alert(`Failed to save recipe: ${error.message}`);
    return null;
  }
};

/**
 * Fetches all recipes for a user from 'recipes' table.
 */
export const getSavedRecipes = async (userId: string): Promise<Recipe[]> => {
    if (!supabase) return [];

    try {
        const { data: recipesData, error: recipesError } = await supabase
            .from('recipes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (recipesError) throw recipesError;
        if (!recipesData || recipesData.length === 0) return [];

        const recipeIds = recipesData.map((r: any) => r.id);
        
        const { data: contentData, error: contentError } = await supabase
            .from('recipe_content')
            .select('*')
            .in('recipe_id', recipeIds)
            .order('order_index', { ascending: true });

        if (contentError) throw contentError;

        // Map DB result back to TypeScript Interface
        const fullRecipes: Recipe[] = recipesData.map((r: any) => {
            const thisContent = contentData.filter((c: any) => c.recipe_id === r.id);
            
            const sections: RecipeSection[] = thisContent.map((c: any) => ({
                type: c.section_type,
                title: c.title,
                items: c.items || [],
                metadata: c.metadata || {}
            }));

            return {
                id: r.id,
                title: r.title,
                description: r.description,
                difficulty: r.difficulty,
                chefNote: r.chef_note,
                totalTime: r.total_time,
                calories: r.calories,
                cuisine: r.cuisine,
                chefPersona: r.chef_persona,
                imageUrl: r.image_url,
                createdAt: r.created_at,
                sections: sections
            };
        });

        return fullRecipes;

    } catch (error: any) {
        console.error("Error fetching recipes:", error);
        return [];
    }
};

export const deleteRecipe = async (recipeId: string): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
    if (error) {
        console.error("Error deleting recipe:", error);
        return false;
    }
    return true;
};

/**
 * Fetches recent workouts from the legacy 'workouts' table to use as context
 */
export const getRecentWorkouts = async (userId: string): Promise<any[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .from('workouts')
            .select('id, title, total_duration, difficulty, trainer_type, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            // Ignore error if table doesn't exist yet
            if (error.code === '42P01') return []; 
            throw error;
        }

        return data || [];
    } catch (error) {
        console.warn("Could not fetch recent workouts:", error);
        return [];
    }
}
