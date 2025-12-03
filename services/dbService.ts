import { createClient } from '@supabase/supabase-js';
import { Recipe, RecipeSection, UserProfile, AuditItem, Ingredient, ShoppingListItem, Location, InventoryItem } from '../types';

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
            .from('recipes')
            .select('id')
            .limit(1);

        if (recipeError) {
            console.error("Recipes Table Verification Error:", recipeError);
            if (recipeError.code === 'PGRST205' || recipeError.message?.includes("does not exist") || recipeError.code === '42P01') {
                 return { success: false, message: "Missing Tables. Please run the Full Schema SQL." };
            }
            return { success: false, message: `Recipes Table Error: ${extractErrorMessage(recipeError)}` };
        }

        // 2. Check Kitchen Tables (Canonical Ingredients)
        const { error: kitchenError } = await supabase
            .from('canonical_ingredients')
            .select('id')
            .limit(1);

        if (kitchenError) {
            if (kitchenError.code === 'PGRST205' || kitchenError.message?.includes("does not exist") || kitchenError.code === '42P01') {
                 // Return false so the UI prompts to run the SQL, but distinguish the message if needed
                 return { success: false, message: "Missing Kitchen Tables. Please run the Full Schema SQL." };
            }
        }

        // Check Profile Attributes
        const { error: profilesError } = await supabase
            .from('profile_attributes')
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
            .from('canonical_ingredients')
            .insert(uniqueNew.map(n => ({ name: n, category: 'General' })))
            .select('id, name');
        
        if (!createError && createdIngredients) {
            createdIngredients.forEach((row: any) => existingMap.set(row.name.toLowerCase(), row.id));
        }
    }

    // 4. Create links in recipe_ingredients
    const linksToCreate = allIngredients.map(ing => {
        const cId = existingMap.get(ing.item.trim().toLowerCase());
        if (!cId) return null;
        return {
            recipe_id: recipeId,
            ingredient_id: cId,
            quantity_value: parseFloat(ing.quantity) || 0,
            quantity_unit: ing.unit,
            preparation_note: ing.prep
        };
    }).filter(x => x !== null);

    if (linksToCreate.length > 0) {
        await supabase.from('recipe_ingredients').insert(linksToCreate);
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
    
    // Sanitize and map content
    const contentToInsert = recipe.sections.map((section, index) => ({
      recipe_id: recipeId,
      section_type: section.type,
      title: section.title,
      items: section.items || [], // Ensure array
      ingredients: section.ingredients || [], // Ensure array for JSONB (or [] if undefined)
      metadata: section.metadata || {}, // Ensure object
      order_index: index
    }));

    const { error: contentError } = await supabase.from('recipe_content').insert(contentToInsert);
    if (contentError) throw contentError;

    // 3. Process Relational Ingredients (Phase 1)
    // Wrap in try/catch so missing advanced tables don't block saving the recipe card
    try {
        await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
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
                ingredients: c.ingredients, // Retrieve JSONB
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
            .select('id, title, total_duration, difficulty, trainer_type, created_at, trainer_notes')
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
            .from('canonical_ingredients')
            .select('id, name')
            .in('name', names);
        
        if (matchError) throw matchError;

        const nameToIdMap = new Map<string, string>();
        canonicalMatches?.forEach((r: any) => nameToIdMap.set(r.name.toLowerCase(), r.id));

        // 2. Fetch User's Inventory (What they already have)
        // We fetch everything in stock for simplicity in V1, or we could filter by IDs found above
        const { data: inventoryData, error: invError } = await supabase
            .from('user_inventory')
            .select('ingredient_id, in_stock, id')
            .eq('user_id', userId)
            .eq('in_stock', true);
        
        if (invError) throw invError;
        
        const inventorySet = new Set<string>(); // Set of canonical IDs in stock
        const inventoryIdMap = new Map<string, string>(); // Map canonical ID -> Inventory Row ID

        inventoryData?.forEach((inv: any) => {
            inventorySet.add(inv.ingredient_id);
            inventoryIdMap.set(inv.ingredient_id, inv.id);
        });

        // 3. Build the Audit List
        const auditList: AuditItem[] = ingredients.map(ing => {
            const normalizedName = ing.item.trim().toLowerCase();
            const canonicalId = nameToIdMap.get(normalizedName);
            
            // It is in stock if we found a canonical ID AND that ID is in the inventory set
            const hasInStock = canonicalId ? inventorySet.has(canonicalId) : false;

            return {
                name: ing.item,
                qty: ing.quantity,
                unit: ing.unit,
                canonicalId: canonicalId,
                inventoryId: canonicalId ? inventoryIdMap.get(canonicalId) : undefined,
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
        const { data, error } = await supabase
            .from('shopping_list')
            .select('id, is_checked, ingredient_id, canonical_ingredients(name)')
            .eq('user_id', userId)
            .order('is_checked', { ascending: true }); // Unchecked first

        if (error) throw error;
        
        return data.map((d: any) => ({
            id: d.id,
            ingredientId: d.ingredient_id,
            name: d.canonical_ingredients?.name || 'Unknown Item',
            isChecked: d.is_checked
        }));
    } catch (e) {
        console.error("Error fetching shopping list", e);
        return [];
    }
};

// Phase 3: Toggle Item
export const toggleShoppingItem = async (itemId: string, isChecked: boolean) => {
    if (!supabase) return;
    await supabase.from('shopping_list').update({ is_checked: isChecked }).eq('id', itemId);
};

// Phase 3: Get Locations
export const getUserLocations = async (userId: string): Promise<Location[]> => {
    if (!supabase) return [];
    try {
        let { data } = await supabase.from('locations').select('*').eq('user_id', userId);
        
        if (!data || data.length === 0) {
            // Seed defaults if empty
            const defaults = [
                { user_id: userId, name: 'Pantry', icon: 'Box' },
                { user_id: userId, name: 'Fridge', icon: 'Snowflake' },
                { user_id: userId, name: 'Freezer', icon: 'IceCream' },
                { user_id: userId, name: 'Spice Rack', icon: 'Flame' }
            ];
            const { data: newLocs } = await supabase.from('locations').insert(defaults).select();
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
        const upserts = itemsToMove.map(item => {
            const locId = locationMap[item.name];
            return {
                user_id: userId,
                ingredient_id: item.ingredientId,
                in_stock: true,
                location_id: locId
            };
        });

        // 2. Upsert to Inventory
        // This requires a unique constraint on (user_id, ingredient_id) to work as an upsert.
        const { error: invError } = await supabase
            .from('user_inventory')
            .upsert(upserts, { onConflict: 'user_id, ingredient_id' });
        
        if (invError) throw invError;

        // 3. Delete from Shopping List
        const idsToDelete = itemsToMove.map(i => i.id);
        const { error: delError } = await supabase
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
        const { data, error } = await supabase
            .from('user_inventory')
            .select(`
                id, 
                in_stock, 
                ingredient_id,
                canonical_ingredients ( name, category ),
                locations ( name, id )
            `)
            .eq('user_id', userId);
        
        if (error) throw error;

        return data.map((row: any) => ({
            id: row.id,
            ingredientId: row.ingredient_id,
            name: row.canonical_ingredients?.name || 'Unknown',
            category: row.canonical_ingredients?.category,
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
            .from('user_inventory')
            .update({ in_stock: newInStock })
            .eq('id', inventoryItem.id);
        
        if (invError) throw invError;

        // 2. If Depleted (newInStock === false) -> Add to Shopping List
        if (!newInStock) {
            // Check if already on shopping list (unchecked)
            const { data: existing } = await supabase
                .from('shopping_list')
                .select('id')
                .eq('user_id', userId)
                .eq('ingredient_id', inventoryItem.ingredientId)
                .eq('is_checked', false)
                .single();
            
            if (!existing) {
                await supabase.from('shopping_list').insert({
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