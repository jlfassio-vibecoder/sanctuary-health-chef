import { createClient } from '@supabase/supabase-js';
import { Recipe, RecipeSection, UserProfile, AuditItem, Ingredient, ShoppingListItem, Location, InventoryItem } from '../types';
import { DEFAULT_UNITS } from '../constants/defaults';

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

// Configuration - Centralized Database Credentials
const SUPABASE_URL = 
    getEnvVar('VITE_SUPABASE_URL') || 
    getEnvVar('SUPABASE_URL');

const SUPABASE_KEY = 
    getEnvVar('VITE_SUPABASE_ANON_KEY') || 
    getEnvVar('VITE_SUPABASE_KEY') || 
    getEnvVar('SUPABASE_KEY');

// Initialize Supabase Client with proper configuration
let supabase: any = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    
    // Log initialization only in development
    if (import.meta.env.DEV) {
      console.log("✅ Supabase initialized (Multi-Schema):", SUPABASE_URL);
      console.log("✅ Using chef schema for all recipe data");
    }
  } catch (error) {
    console.error("❌ Error initializing Supabase client:", error);
  }
} else {
  console.warn("⚠️ Supabase credentials missing.");
}

export { supabase };

/**
 * Helper to extract meaningful error messages from various error object shapes
 */
const extractErrorMessage = (error: any): string => {
    if (!error) return "Unknown error";
    
    // 1. If it's already a string
    if (typeof error === 'string') {
        if (error.includes('[object Object]')) return "An unexpected object error occurred.";
        return error;
    }

    // 2. If it's an Error object
    if (error instanceof Error) return error.message;

    // 3. Supabase/Postgrest Error Object
    if (typeof error === 'object') {
        // PostgrestError often has { message, details, hint, code }
        if (error.message) {
             let msg = error.message;
             if (error.details) msg += ` (${error.details})`;
             if (error.hint) msg += ` Hint: ${error.hint}`;
             return msg;
        }
        
        // Try JSON stringify as last resort, avoiding [object Object] output
        try {
            const json = JSON.stringify(error);
            if (json !== '{}' && !json.includes('[object Object]')) return json;
        } catch (e) {}
    }
    
    return "An unexpected error occurred. Please check console for details.";
};

/**
 * Verifies that the database tables exist.
 */
export const verifyDatabaseSchema = async (): Promise<{ success: boolean; message: string }> => {
    if (!supabase) return { success: false, message: "Client not initialized" };

    try {
        // 1. Check Recipes Table (Basic)
        const { error: recipeError } = await supabase
            .schema('chef')
            .from('recipes')
            .select('id')
            .limit(1);

        if (recipeError) {
            console.error("Recipes Table Verification Error:", recipeError);
            // Check if it's a "table doesn't exist" error
            if (recipeError.code === 'PGRST205' || recipeError.message?.includes("does not exist") || recipeError.code === '42P01') {
                 return { success: false, message: "Missing Tables. Please run the Full Schema SQL." };
            }
            // 406 errors or RLS-related errors are OK - tables exist, just need auth
            if (recipeError.code === 'PGRST301' || recipeError.message?.includes('406') || recipeError.message?.includes('permission')) {
                console.log("✅ Chef schema exists (RLS active, need authentication)");
                return { success: true, message: "Database ready - Sign in to access data" };
            }
            return { success: false, message: `Recipes Table Error: ${extractErrorMessage(recipeError)}` };
        }

        // 2. Check Kitchen Tables (Canonical Ingredients)
        const { error: kitchenError } = await supabase
            .schema('chef')
            .from('canonical_ingredients')
            .select('id')
            .limit(1);

        if (kitchenError) {
            if (kitchenError.code === 'PGRST205' || kitchenError.message?.includes("does not exist") || kitchenError.code === '42P01') {
                 // Return false so the UI prompts to run the SQL, but distinguish the message if needed
                 return { success: false, message: "Missing Kitchen Tables. Please run the Full Schema SQL." };
            }
        }

        // Check User Profiles (in public schema)
        const { error: profilesError } = await supabase
            .schema('public')  // ✅ Use public schema for profiles
            .from('user_profiles')
            .select('id')
            .limit(1);

        if (profilesError && profilesError.code !== 'PGRST116') {
             if (profilesError.code === '42P01' || profilesError.message?.includes("does not exist")) {
                 return { success: false, message: "Missing Profile Table. Please run the Full Schema SQL." };
             }
        }

        return { success: true, message: "Database Verified" };
    } catch (e: any) {
        return { success: false, message: extractErrorMessage(e) };
    }
};

/**
 * Retrieves the user profile from public schema.
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!supabase) return null;

    try {
        let { data, error } = await supabase
            .schema('public')  // ✅ Use public schema for profiles
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();

        // Fallback for user_id column
        if (!data && (error?.code === 'PGRST116' || !error)) {
             const { data: data2 } = await supabase
                .schema('public')  // ✅ Use public schema for profiles
                .from('user_profiles')
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

        // Extract fitness_goals and preferred_units from JSONB fields
        const fitnessGoals = data.fitness_goals || {};
        const preferredUnits = (data.preferred_units || {}) as Record<string, string>;

        return {
            age: data.age ?? 30,
            gender: data.gender ?? 'Other',
            weight: Number(data.weight) ?? 170,
            height: Number(data.height) ?? 70,
            units: {
                system: (preferredUnits.system || DEFAULT_UNITS.system) as 'imperial' | 'metric',
                weight: (preferredUnits.weight || DEFAULT_UNITS.weight) as 'lbs' | 'kg',
                height: (preferredUnits.height || DEFAULT_UNITS.height) as 'inches' | 'cm',
                distance: (preferredUnits.distance || DEFAULT_UNITS.distance) as 'miles' | 'km'
            },
            goals: fitnessGoals.goals || [],
            medicalConditions: fitnessGoals.dietary_restrictions || [],
            injuries: fitnessGoals.allergies || [],
            preferences: fitnessGoals.dislikes || [],
            fitnessLevel: (fitnessGoals.cooking_skill || 'Intermediate') as 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite'
        };
    } catch (e) {
        console.error("Unexpected error fetching profile:", e);
        return null;
    }
};

/**
 * Saves/Updates the user profile in public schema.
 */
export const saveUserProfile = async (userId: string, profile: UserProfile): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // Map Chef app profile to user_profiles table structure
        const payload = {
            id: userId,
            age: profile.age,
            gender: profile.gender,
            weight: profile.weight,
            height: profile.height,
            preferred_units: {
                system: profile.units?.system || DEFAULT_UNITS.system,
                weight: profile.units?.weight || DEFAULT_UNITS.weight,
                height: profile.units?.height || DEFAULT_UNITS.height,
                distance: profile.units?.distance || DEFAULT_UNITS.distance
            },
            fitness_goals: {
                goals: profile.goals || [],
                dietary_restrictions: profile.medicalConditions || [],
                allergies: profile.injuries || [],
                dislikes: profile.preferences || [],
                cooking_skill: profile.fitnessLevel || 'Intermediate'
            },
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .schema('public')  // ✅ Use public schema for profiles
            .from('user_profiles')
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
 * Helper: Processes ingredient list to Match/Create Canonical Ingredients and Link them.
 */
const processRecipeIngredients = async (recipeId: string, sections: RecipeSection[]) => {
    // Extract all structured ingredients from all sections
    const allIngredients: Ingredient[] = [];
    sections.forEach(s => {
        if (s.ingredients) allIngredients.push(...s.ingredients);
    });

    if (allIngredients.length === 0) return;

    // 1. Get all names
    const names = allIngredients.map(i => i.item.trim());
    
    // 2. Fetch existing canonical ingredients
    const { data: existingCanonical, error: fetchError } = await supabase
        .schema('chef')
        .from('canonical_ingredients')
        .select('id, name')
        .in('name', names); 

    // If table doesn't exist, this will error. We should gracefully exit.
    if (fetchError) {
        console.warn("Skipping ingredient processing (Table 'canonical_ingredients' issue):", fetchError.message);
        return;
    }

    const existingMap = new Map<string, string>();
    existingCanonical?.forEach((row: any) => existingMap.set(row.name.toLowerCase(), row.id));

    // 3. Identify new ingredients to create
    const newIngredients = names.filter(n => !existingMap.has(n.toLowerCase()));
    
    // Dedupe
    const uniqueNew = Array.from(new Set(newIngredients));
    
    if (uniqueNew.length > 0) {
        const { data: createdIngredients, error: createError } = await supabase
            .schema('chef')
            .from('canonical_ingredients')
            .insert(uniqueNew.map(n => ({ name: n, category: 'General' })))
            .select('id, name');
        
        if (!createError && createdIngredients) {
            createdIngredients.forEach((row: any) => existingMap.set(row.name.toLowerCase(), row.id));
        }
    }

    // 4. Create links in recipe_ingredients
    // Database schema: recipe_id, ingredient_name (TEXT, not ID!), quantity, unit, notes
    const linksToCreate = allIngredients.map(ing => {
        return {
            recipe_id: recipeId,
            ingredient_name: ing.item.trim(), // Database uses ingredient_name (TEXT), not ingredient_id
            quantity: parseFloat(ing.quantity) || null, // Database: 'quantity' not 'quantity_value'
            unit: ing.unit || null, // Database: 'unit' not 'quantity_unit'
            notes: ing.prep || null // Database: 'notes' not 'preparation_note'
        };
    });

    if (linksToCreate.length > 0) {
        await supabase.schema('chef').from('recipe_ingredients').insert(linksToCreate);
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
    // Map Recipe object fields to actual database columns
    
    // Normalize difficulty to match database constraint (easy, medium, hard)
    const normalizeDifficulty = (diff: string): string | null => {
      if (!diff) return null;
      const lower = diff.toLowerCase();
      if (lower.includes('easy') || lower.includes('beginner')) return 'easy';
      if (lower.includes('medium') || lower.includes('intermediate')) return 'medium';
      if (lower.includes('hard') || lower.includes('advanced') || lower.includes('difficult')) return 'hard';
      return null; // Invalid value - set to null
    };
    
    // Normalize meal_type to match database constraint
    const normalizeMealType = (mealType: string | undefined): string | null => {
      if (!mealType) return null;
      const lower = mealType.toLowerCase().replace(/\s+/g, '_');
      const validTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];
      // Check if it matches one of the valid types
      for (const validType of validTypes) {
        if (lower.includes(validType.replace('_', ''))) return validType;
      }
      return null; // Invalid value - set to null
    };
    
    const recipePayload = {
      user_id: userId,
      name: recipe.title, // Database: 'name'
      description: recipe.description || null, // Database: 'description'
      meal_type: normalizeMealType(recipe.mealType), // Database: 'meal_type' (breakfast|lunch|dinner|snack|pre_workout|post_workout)
      cuisine_type: recipe.cuisine || null, // Database: 'cuisine_type' not 'cuisine'
      servings: recipe.servings || 1, // Database: 'servings'
      prep_time_minutes: recipe.prepTime || null, // Database: 'prep_time_minutes'
      cook_time_minutes: recipe.cookTime || null, // Database: 'cook_time_minutes'
      difficulty_level: normalizeDifficulty(recipe.difficulty), // Database: 'difficulty_level' (easy|medium|hard only)
      dietary_tags: recipe.dietaryTags || [], // Database: 'dietary_tags' (JSONB)
      allergens: recipe.allergens || [], // Database: 'allergens' (JSONB)
      image_url: recipe.imageUrl || null, // Database: 'image_url'
      is_favorite: recipe.isFavorite || false, // Database: 'is_favorite'
      is_public: recipe.isPublic || false, // Database: 'is_public'
      created_at: recipe.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
      // Note: Nutrition data (calories, protein, carbs, fat) and chef_persona are NOT in database
      // These are calculated/displayed in the UI only
    };

    let data, error;
    
    if (recipeId) {
        const result = await supabase.schema('chef').from('recipes').update(recipePayload).eq('id', recipeId).select('id').single();
        data = result.data;
        error = result.error;
    } else {
        const result = await supabase.schema('chef').from('recipes').insert([recipePayload]).select('id').single();
        data = result.data;
        error = result.error;
    }

    if (error) throw error;
    if (!data || !data.id) throw new Error("No ID returned from save.");

    recipeId = data.id;

    // 2. Handle Content (Ingredients/Steps)
    // Delete existing content for this recipe to replace with new state
    await supabase.schema('chef').from('recipe_content').delete().eq('recipe_id', recipeId);
    
    // Map sections to database schema
    // Database schema: recipe_id, section_type, content, order_index
    // section_type constraint: 'instructions' | 'notes' | 'tips' | 'nutrition'
    const contentToInsert = recipe.sections.map((section, index) => {
      // Normalize section type to match database constraint
      let sectionType = 'notes'; // Default fallback
      const typeLower = section.type.toLowerCase();
      if (typeLower.includes('instruction') || typeLower.includes('step')) sectionType = 'instructions';
      else if (typeLower.includes('ingredient')) sectionType = 'notes'; // Store ingredients as notes
      else if (typeLower.includes('tip')) sectionType = 'tips';
      else if (typeLower.includes('nutrition')) sectionType = 'nutrition';
      
      // Serialize all section data as JSON in the content field
      const contentData = {
        title: section.title,
        items: section.items || [],
        ingredients: section.ingredients || [],
        metadata: section.metadata || {}
      };
      
      return {
        recipe_id: recipeId,
        section_type: sectionType,
        content: JSON.stringify(contentData), // Store structured data as JSON text
        order_index: index
      };
    });

    const { error: contentError } = await supabase.schema('chef').from('recipe_content').insert(contentToInsert);
    if (contentError) throw contentError;

    // 3. Process Relational Ingredients (Phase 1)
    // Wrap in try/catch so missing advanced tables don't block saving the recipe card
    try {
        await supabase.schema('chef').from('recipe_ingredients').delete().eq('recipe_id', recipeId);
        await processRecipeIngredients(recipeId, recipe.sections);
    } catch (ingError) {
        console.warn("Secondary ingredient processing failed (non-critical):", ingError);
    }

    console.log("✅ Recipe saved. ID:", recipeId);
    return recipeId;

  } catch (error: any) {
    console.error("Critical error saving recipe:", error);
    
    // Detailed Error Reporting
    const msg = extractErrorMessage(error);
    
    if (msg && (msg.includes('column "ingredients"') || msg.includes("ingredients") || msg.includes('does not exist'))) {
        alert("Database Schema Mismatch: The 'ingredients' column is missing in 'recipe_content' or a table is missing.\n\nPlease go to Settings > 'Copy Full Database Schema' and run it in the Supabase SQL Editor to fix this.");
    } else {
        alert(`Failed to save recipe: ${msg}`);
    }
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
            .schema('chef')
            .from('recipes')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (recipesError) throw recipesError;
        if (!recipesData || recipesData.length === 0) return [];

        const recipeIds = recipesData.map((r: any) => r.id);
        
        const { data: contentData, error: contentError } = await supabase
            .schema('chef')
            .from('recipe_content')
            .select('*')
            .in('recipe_id', recipeIds)
            .order('order_index', { ascending: true });

        if (contentError) throw contentError;

        // Map DB result back to TypeScript Interface
        const fullRecipes: Recipe[] = recipesData.map((r: any) => {
            const thisContent = contentData.filter((c: any) => c.recipe_id === r.id);
            
            const sections: RecipeSection[] = thisContent.map((c: any) => {
                // Parse JSON content back into structured data
                let parsedContent: any = {};
                try {
                    parsedContent = JSON.parse(c.content || '{}');
                } catch (e) {
                    console.warn('Failed to parse recipe content JSON:', e);
                }
                
                // Map section_type back to original type naming
                let type: 'Overview' | 'Ingredients' | 'Instructions' = 'Instructions';
                if (c.section_type === 'instructions') type = 'Instructions';
                else if (c.section_type === 'notes') type = 'Ingredients'; // We stored ingredients as notes
                else if (c.section_type === 'tips') type = 'Overview';
                
                return {
                    type: type,
                    title: parsedContent.title || '',
                    items: parsedContent.items || [],
                    ingredients: parsedContent.ingredients || [],
                    metadata: parsedContent.metadata || {}
                };
            });

            // Map database columns to Recipe interface fields
            return {
                id: r.id,
                title: r.name || '', // Database: 'name'
                description: r.description || '', // Database: 'description'
                difficulty: r.difficulty_level || '', // Database: 'difficulty_level'
                chefNote: '', // Not stored in database
                totalTime: (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0),
                prepTime: r.prep_time_minutes || 0,
                cookTime: r.cook_time_minutes || 0,
                calories: 0, // Not in database - calculated from ingredients
                protein: 0, // Not in database - calculated from ingredients
                carbs: 0, // Not in database - calculated from ingredients
                fat: 0, // Not in database - calculated from ingredients
                mealType: r.meal_type || '',
                cuisine: r.cuisine_type || '', // Database: 'cuisine_type'
                servings: r.servings || 1,
                dietaryTags: r.dietary_tags || [], // Database: JSONB array
                allergens: r.allergens || [], // Database: JSONB array
                chefPersona: '', // Not in database
                imageUrl: r.image_url || '',
                isFavorite: r.is_favorite || false,
                isPublic: r.is_public || false,
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
    const { error } = await supabase.schema('chef').from('recipes').delete().eq('id', recipeId);
    if (error) {
        console.error("Error deleting recipe:", error);
        return false;
    }
    return true;
};

/**
 * Fetches recent workouts using the cross-schema function
 * This queries from the trainer schema safely via RPC
 */
export const getRecentWorkouts = async (userId: string): Promise<any[]> => {
    if (!supabase) return [];

    try {
        // Use the cross-schema RPC function instead of direct query
        const { data, error} = await supabase
            .rpc('get_workout_context_for_recipe', {
                p_user_id: userId,
                p_hours_back: 168 // Last 7 days
            });

        if (error) {
            console.warn("Could not fetch recent workouts:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.warn("Could not fetch recent workouts:", error);
        return [];
    }
};

/**
 * Get workout context for meal planning
 * Returns recent workout data to inform recipe recommendations
 */
export const getWorkoutContextForMealPlanning = async (userId: string, hoursBack: number = 24): Promise<any[]> => {
    if (!supabase) return [];

    try {
        const { data, error } = await supabase
            .rpc('get_workout_context_for_recipe', {
                p_user_id: userId,
                p_hours_back: hoursBack
            });

        if (error) {
            console.warn("Could not fetch workout context:", error);
            return [];
        }

        console.log(`✅ Fetched ${data?.length || 0} recent workouts for meal planning`);
        return data || [];
    } catch (error) {
        console.warn("Error fetching workout context:", error);
        return [];
    }
};

/**
 * Phase 2: Audit Logic
 * Matches recipe ingredients to user inventory to determine what needs to be bought.
 */
export const auditRecipeIngredients = async (userId: string, ingredients: Ingredient[]): Promise<AuditItem[]> => {
    if (!supabase) return [];

    try {
        // 1. Resolve Canonical IDs for incoming ingredients (Names -> IDs)
        // We attempt to match names from the recipe to the canonical table
        const names = ingredients.map(i => i.item.trim());
        const { data: canonicalMatches, error: matchError } = await supabase
            .schema('chef')
            .from('canonical_ingredients')
            .select('id, name')
            .in('name', names);
        
        if (matchError) throw matchError;

        const nameToIdMap = new Map<string, string>();
        canonicalMatches?.forEach((r: any) => nameToIdMap.set(r.name.toLowerCase(), r.id));

        // 2. Fetch User's Inventory (What they already have)
        // Database schema: user_inventory has ingredient_name (TEXT), not ingredient_id
        const { data: inventoryData, error: invError } = await supabase
            .schema('chef')
            .from('user_inventory')
            .select('ingredient_name, in_stock, id') // Database uses ingredient_name, not ingredient_id
            .eq('user_id', userId)
            .eq('in_stock', true);
        
        if (invError) throw invError;
        
        const inventorySet = new Set<string>(); // Set of ingredient names in stock
        const inventoryIdMap = new Map<string, string>(); // Map ingredient name -> Inventory Row ID

        inventoryData?.forEach((inv: any) => {
            const normalizedName = inv.ingredient_name?.toLowerCase();
            if (normalizedName) {
                inventorySet.add(normalizedName); // Store names, not IDs
                inventoryIdMap.set(normalizedName, inv.id); // Map name -> inventory row ID
            }
        });

        // 3. Build the Audit List
        const auditList: AuditItem[] = ingredients.map(ing => {
            const normalizedName = ing.item.trim().toLowerCase();
            const canonicalId = nameToIdMap.get(normalizedName);
            
            // Check if ingredient name is in inventory
            const hasInStock = inventorySet.has(normalizedName);

            return {
                name: ing.item,
                qty: ing.quantity,
                unit: ing.unit,
                canonicalId: canonicalId,
                inventoryId: inventoryIdMap.get(normalizedName), // Get inventory ID by name
                inStock: hasInStock
            };
        });

        return auditList;

    } catch (error) {
        console.error("Error auditing ingredients:", extractErrorMessage(error));
        // Fallback: return as if user has nothing
        return ingredients.map(ing => ({
            name: ing.item,
            qty: ing.quantity,
            unit: ing.unit,
            inStock: false
        }));
    }
};

/**
 * Phase 2: Commit Audit
 * 1. Checked items -> Update user_inventory (Set in_stock = true)
 * 2. Unchecked items -> Add to shopping_list
 */
export const commitShoppingAudit = async (userId: string, auditItems: AuditItem[], recipeId?: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // A. Separate Checked (In Inventory) vs Unchecked (Need to Buy)
        const inStockItems = auditItems.filter(i => i.inStock && i.canonicalId);
        const toBuyItems = auditItems.filter(i => !i.inStock);

        // B. Update Inventory (Upsert)
        if (inStockItems.length > 0) {
            // We need to ensure these exist in inventory. 
            // If they have an existing inventoryId, update. If not, insert.
            const inventoryUpserts = inStockItems.map(item => ({
                user_id: userId,
                ingredient_id: item.canonicalId,
                in_stock: true,
                // If we know the ID, we could use it, but upserting on (user_id, ingredient_id) is safer if constraint exists
                // Assuming we added a unique constraint on user_id + ingredient_id in the setup script
            }));
            
            // Note: If you didn't add a unique constraint on user_id+ingredient_id, upsert might duplicate.
            // Phase 2 setup script should have: create unique index ... on user_inventory(user_id, ingredient_id);
            const { error: invError } = await supabase
                .schema('chef')
                .from('user_inventory')
                .upsert(inventoryUpserts, { onConflict: 'user_id, ingredient_id' });
            
            if (invError) console.error("Inventory update error:", invError);
        }

        // C. Add to Shopping List
        if (toBuyItems.length > 0) {
            // We need canonical IDs for shopping list. 
            // If an item doesn't have a canonical ID (because it's new/unmatched), we technically should create it first.
            // For V1 speed, we will skip items without canonical ID or create them on the fly?
            // Let's create them on the fly for robustness.
            
            const missingCanonical = toBuyItems.filter(i => !i.canonicalId);
            if (missingCanonical.length > 0) {
                // Bulk insert new canonicals
                const { data: newCanonicals } = await supabase
                    .schema('chef')
                    .from('canonical_ingredients')
                    .insert(missingCanonical.map(i => ({ name: i.name, category: 'General' })))
                    .select('id, name');
                
                // Map back
                newCanonicals?.forEach((nc: any) => {
                    const match = toBuyItems.find(i => i.name === nc.name);
                    if (match) match.canonicalId = nc.id;
                });
            }

            // Now insert to shopping list
            const shoppingListPayload = toBuyItems
                .filter(i => i.canonicalId) // Only those with valid IDs
                .map(item => ({
                    user_id: userId,
                    ingredient_id: item.canonicalId,
                    recipe_id: recipeId || null,
                    is_checked: false
                }));

            if (shoppingListPayload.length > 0) {
                const { error: shopError } = await supabase
                    .schema('chef')
                    .from('shopping_list')
                    .insert(shoppingListPayload);
                if (shopError) throw shopError;
            }
        }

        return true;
    } catch (error) {
        console.error("Error committing audit:", error);
        return false;
    }
};

// Phase 3: Get Shopping List
export const getShoppingList = async (userId: string): Promise<ShoppingListItem[]> => {
    if (!supabase) return [];
    try {
        // Database schema: shopping_list has ingredient_name (TEXT), not ingredient_id
        const { data, error } = await supabase
            .schema('chef')
            .from('shopping_list')
            .select(`
                id, 
                ingredient_name,
                is_purchased
            `)
            .eq('user_id', userId)
            .order('is_purchased', { ascending: true }); // Unpurchased first

        if (error) throw error;

        // Map ingredient_name to the expected format
        return data.map((d: any) => ({
            id: d.id,
            ingredientId: d.ingredient_name || '', // Store name in ingredientId for compatibility
            name: d.ingredient_name || 'Unknown Item',
            isChecked: d.is_purchased || false
        }));
    } catch (e) {
        console.error("Error fetching shopping list", e);
        return [];
    }
};

// Phase 3: Toggle Item
export const toggleShoppingItem = async (itemId: string, isChecked: boolean) => {
    if (!supabase) return;
    // Database uses is_purchased, not is_checked
    await supabase.schema('chef').from('shopping_list').update({ is_purchased: isChecked }).eq('id', itemId);
};

// Phase 3: Get Locations
export const getUserLocations = async (userId: string): Promise<Location[]> => {
    if (!supabase) return [];
    try {
        let { data } = await supabase.schema('chef').from('locations').select('*').eq('user_id', userId);
        
        if (!data || data.length === 0) {
            // Seed defaults if empty
            const defaults = [
                { user_id: userId, name: 'Pantry', icon: 'Box' },
                { user_id: userId, name: 'Fridge', icon: 'Snowflake' },
                { user_id: userId, name: 'Freezer', icon: 'IceCream' },
                { user_id: userId, name: 'Spice Rack', icon: 'Flame' }
            ];
            const { data: newLocs } = await supabase.schema('chef').from('locations').insert(defaults).select();
            return newLocs || [];
        }
        return data;
    } catch (e) {
        return [];
    }
};

// Phase 3: Move Shopping to Inventory
export const moveShoppingToInventory = async (
    userId: string, 
    itemsToMove: ShoppingListItem[], 
    locationMap: Record<string, string> // ItemName -> LocationId
): Promise<{ success: boolean; message?: string }> => {
    if (!supabase) return { success: false, message: "DB not initialized" };
    
    try {
        // 1. Prepare Inventory Upserts
        // Database schema: user_inventory uses ingredient_name (TEXT), not ingredient_id
        const upserts = itemsToMove.map(item => {
            const locId = locationMap[item.name];
            return {
                user_id: userId,
                ingredient_name: item.name, // Database uses ingredient_name
                in_stock: true,
                location_id: locId
            };
        });

        // 2. Upsert to Inventory
        // Database has unique constraint on (user_id, ingredient_name)
        const { error: invError } = await supabase
            .schema('chef')
            .from('user_inventory')
            .upsert(upserts, { onConflict: 'user_id,ingredient_name' });
        
        if (invError) throw invError;

        // 3. Delete from Shopping List
        const idsToDelete = itemsToMove.map(i => i.id);
        const { error: delError } = await supabase
            .schema('chef')
            .from('shopping_list')
            .delete()
            .in('id', idsToDelete);
            
        if (delError) throw delError;

        return { success: true };
    } catch (e: any) {
        console.error("Error moving to inventory", e);
        let msg = extractErrorMessage(e);

        // User-friendly hint for the common "missing constraint" error
        if (msg.includes("ON CONFLICT") || msg.includes("unique constraint") || msg.includes("PGRST204")) {
            msg = "Database Schema Issue: The system cannot update existing inventory items because a unique constraint is missing. Please go to Settings > 'Copy Full Database Schema' and run it in the Supabase SQL Editor.";
        }
        
        return { success: false, message: msg };
    }
};

/**
 * Phase 4: Kitchen Manager Logic
 */

// Get full inventory with location data
export const getUserInventory = async (userId: string): Promise<InventoryItem[]> => {
    if (!supabase) return [];

    try {
        // Database schema: user_inventory uses ingredient_name (TEXT), not ingredient_id
        const { data, error } = await supabase
            .schema('chef')
            .from('user_inventory')
            .select(`
                id, 
                in_stock, 
                ingredient_name,
                quantity,
                unit,
                locations ( name, id )
            `)
            .eq('user_id', userId);
        
        if (error) throw error;

        return data.map((row: any) => ({
            id: row.id,
            ingredientId: row.ingredient_name || '', // Use name for compatibility
            ingredientName: row.ingredient_name || 'Unknown',
            name: row.ingredient_name || 'Unknown',
            quantity: row.quantity,
            unit: row.unit,
            locationId: row.locations?.id,
            locationName: row.locations?.name || 'Unsorted',
            inStock: row.in_stock
        }));
    } catch (e) {
        console.error("Error fetching inventory:", e);
        return [];
    }
};

// Toggle Status (Deplete -> Auto Add to Shopping List)
export const updateInventoryStatus = async (
    userId: string, 
    inventoryItem: InventoryItem, 
    newInStock: boolean
): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // 1. Update Inventory Table
        const { error: invError } = await supabase
            .schema('chef')
            .from('user_inventory')
            .update({ in_stock: newInStock })
            .eq('id', inventoryItem.id);
        
        if (invError) throw invError;

        // 2. If Depleted (newInStock === false) -> Add to Shopping List
        if (!newInStock) {
            // Check if already on shopping list (unchecked)
            const { data: existing } = await supabase
                .schema('chef')
                .from('shopping_list')
                .select('id')
                .eq('user_id', userId)
                .eq('ingredient_id', inventoryItem.ingredientId)
                .eq('is_checked', false)
                .single();
            
            if (!existing) {
                await supabase.schema('chef').from('shopping_list').insert({
                    user_id: userId,
                    ingredient_id: inventoryItem.ingredientId,
                    is_checked: false
                });
            }
        }

        return true;
    } catch (e) {
        console.error("Error updating inventory status:", e);
        return false;
    }
};