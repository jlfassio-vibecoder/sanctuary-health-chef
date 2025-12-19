/**
 * Firestore Database Service
 * Migrated from Supabase to Firestore
 * Maintains same function signatures for backward compatibility
 */

import { db } from '../src/lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  writeBatch,
  addDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Recipe, RecipeSection, UserProfile, AuditItem, Ingredient, ShoppingListItem, Location, InventoryItem } from '../types';
import { DEFAULT_UNITS, DEFAULT_PROFILE_VALUES } from '../constants/defaults';

/**
 * Helper to extract meaningful error messages
 */
const extractErrorMessage = (error: any): string => {
  if (!error) return "Unknown error";
  if (typeof error === 'string') {
    if (error.includes('[object Object]')) return "An unexpected object error occurred.";
    return error;
  }
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error.message) {
    let msg = error.message;
    if (error.details) msg += ` (${error.details})`;
    if (error.hint) msg += ` Hint: ${error.hint}`;
    return msg;
  }
  return "An unexpected error occurred. Please check console for details.";
};

/**
 * Helper to convert Firestore Timestamp to ISO string
 */
const timestampToISO = (timestamp: any): string => {
  if (!timestamp) return new Date().toISOString();
  if (timestamp.toDate) return timestamp.toDate().toISOString();
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'string') return timestamp;
  return new Date().toISOString();
};

/**
 * Helper to convert ISO string to Firestore Timestamp
 */
const isoToTimestamp = (iso: string | undefined): Timestamp | null => {
  if (!iso) return null;
  try {
    return Timestamp.fromDate(new Date(iso));
  } catch {
    return null;
  }
};

/**
 * Verifies that Firestore collections are accessible
 */
export const verifyDatabaseSchema = async (): Promise<{ success: boolean; message: string }> => {
  try {
    // Try to access recipes collection
    const recipesRef = collection(db, 'recipes');
    const q = query(recipesRef, limit(1));
    await getDocs(q);
    
    return { success: true, message: "Database Verified" };
  } catch (e: any) {
    const errorMsg = extractErrorMessage(e);
    if (errorMsg.includes('permission') || errorMsg.includes('Permission')) {
      return { success: true, message: "Database ready - Sign in to access data" };
    }
    return { success: false, message: `Database Error: ${errorMsg}` };
  }
};

/**
 * Retrieves the user profile from Firestore
 */
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    const profileRef = doc(db, 'profiles', userId);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      console.log(`ℹ️ No profile found for user ${userId}, using defaults`);
      return DEFAULT_PROFILE_VALUES;
    }

    const data = profileSnap.data();
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
    console.error("Error fetching profile:", e);
    return DEFAULT_PROFILE_VALUES;
  }
};

/**
 * Saves/Updates the user profile in Firestore
 */
export const saveUserProfile = async (userId: string, profile: UserProfile): Promise<boolean> => {
  try {
    const profileRef = doc(db, 'profiles', userId);
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
      updated_at: serverTimestamp()
    };

    await setDoc(profileRef, payload, { merge: true });
    return true;
  } catch (e) {
    console.error("Error saving profile:", e);
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

  try {
    // 1. Get all names
    const names = allIngredients.map(i => i.item.trim());
    
    // 2. Fetch existing canonical ingredients
    // Firestore 'in' queries are limited to 10 items, so batch if needed
    const canonicalRef = collection(db, 'canonical_ingredients');
    const existingMap = new Map<string, string>();
    
    if (names.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < names.length; i += batchSize) {
        const batch = names.slice(i, i + batchSize);
        const canonicalQuery = query(canonicalRef, where('name', 'in', batch));
        const canonicalSnapshot = await getDocs(canonicalQuery);
        
        canonicalSnapshot.docs.forEach(doc => {
          const data = doc.data();
          existingMap.set(data.name.toLowerCase(), doc.id);
        });
      }
    }

    // 3. Identify new ingredients to create
    const newIngredients = names.filter(n => !existingMap.has(n.toLowerCase()));
    const uniqueNew = Array.from(new Set(newIngredients));
    
    // 4. Create new canonical ingredients
    if (uniqueNew.length > 0) {
      const batch = writeBatch(db);
      uniqueNew.forEach(name => {
        const newIngredientRef = doc(collection(db, 'canonical_ingredients'));
        batch.set(newIngredientRef, { name, category: 'General' });
        existingMap.set(name.toLowerCase(), newIngredientRef.id);
      });
      await batch.commit();
    }

    // 5. Create links in recipe_ingredients
    const linksToCreate = allIngredients.map(ing => ({
      recipe_id: recipeId,
      ingredient_name: ing.item.trim(),
      quantity: parseFloat(ing.quantity) || null,
      unit: ing.unit || null,
      notes: ing.prep || null
    }));

    if (linksToCreate.length > 0) {
      const batch = writeBatch(db);
      linksToCreate.forEach(link => {
        const linkRef = doc(collection(db, 'recipe_ingredients'));
        batch.set(linkRef, link);
      });
      await batch.commit();
    }
  } catch (error) {
    console.warn("Skipping ingredient processing:", error);
  }
};

/**
 * Saves a Recipe to Firestore
 */
export const saveRecipeToDb = async (recipe: Recipe, userId: string): Promise<string | null> => {
  console.log("Saving recipe to DB...", recipe.title);

  try {
    let recipeId = recipe.id;

    // Normalize difficulty
    const normalizeDifficulty = (diff: string): string | null => {
      if (!diff) return null;
      const lower = diff.toLowerCase();
      if (lower.includes('easy') || lower.includes('beginner')) return 'easy';
      if (lower.includes('medium') || lower.includes('intermediate')) return 'medium';
      if (lower.includes('hard') || lower.includes('advanced') || lower.includes('difficult')) return 'hard';
      return null;
    };
    
    // Normalize meal_type
    const normalizeMealType = (mealType: string | undefined): string | null => {
      if (!mealType) return null;
      const lower = mealType.toLowerCase().replace(/\s+/g, '_');
      const validTypes = ['breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'];
      for (const validType of validTypes) {
        if (lower === validType || lower.includes(validType)) return validType;
      }
      return null;
    };
    
    const recipePayload: any = {
      user_id: userId,
      name: recipe.title,
      description: recipe.description || null,
      meal_type: normalizeMealType(recipe.mealType),
      cuisine_type: recipe.cuisine || null,
      servings: recipe.servings || 1,
      prep_time_minutes: recipe.prepTime || null,
      cook_time_minutes: recipe.cookTime || null,
      difficulty_level: normalizeDifficulty(recipe.difficulty),
      dietary_tags: recipe.dietaryTags || [],
      allergens: recipe.allergens || [],
      chef_note: recipe.chefNote || null,
      chef_persona: recipe.chefPersona || null,
      image_url: recipe.imageUrl || null,
      is_favorite: recipe.isFavorite || false,
      is_public: recipe.isPublic || false,
      updated_at: serverTimestamp()
    };

    // Handle created_at
    if (recipe.createdAt) {
      recipePayload.created_at = isoToTimestamp(recipe.createdAt);
    } else if (!recipeId) {
      recipePayload.created_at = serverTimestamp();
    }

    // 1. Save/Update Recipe
    if (recipeId) {
      const recipeRef = doc(db, 'recipes', recipeId);
      await updateDoc(recipeRef, recipePayload);
    } else {
      const recipeRef = doc(collection(db, 'recipes'));
      recipeId = recipeRef.id;
      await setDoc(recipeRef, recipePayload);
    }

    // 2. Delete existing content
    const contentRef = collection(db, 'recipe_content');
    const contentQuery = query(contentRef, where('recipe_id', '==', recipeId));
    const contentSnapshot = await getDocs(contentQuery);
    
    const batch = writeBatch(db);
    contentSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // 3. Insert new content
    const contentToInsert = recipe.sections.map((section, index) => {
      let sectionType = 'notes';
      const typeLower = section.type.toLowerCase();
      if (typeLower.includes('instruction') || typeLower.includes('step')) sectionType = 'instructions';
      else if (typeLower.includes('ingredient')) sectionType = 'notes';
      else if (typeLower.includes('overview') || typeLower.includes('info')) sectionType = 'tips';
      else if (typeLower.includes('tip')) sectionType = 'tips';
      else if (typeLower.includes('nutrition')) sectionType = 'nutrition';
      
      const contentData = {
        title: section.title,
        items: section.items || [],
        ingredients: section.ingredients || [],
        metadata: section.metadata || {}
      };
      
      return {
        recipe_id: recipeId,
        section_type: sectionType,
        content: JSON.stringify(contentData),
        order_index: index
      };
    });

    if (contentToInsert.length > 0) {
      const contentBatch = writeBatch(db);
      contentToInsert.forEach(content => {
        const contentRef = doc(collection(db, 'recipe_content'));
        contentBatch.set(contentRef, content);
      });
      await contentBatch.commit();
    }

    // 4. Process ingredients (non-critical)
    try {
      // Delete existing recipe_ingredients
      const recipeIngredientsRef = collection(db, 'recipe_ingredients');
      const recipeIngredientsQuery = query(recipeIngredientsRef, where('recipe_id', '==', recipeId));
      const recipeIngredientsSnapshot = await getDocs(recipeIngredientsQuery);
      const deleteBatch = writeBatch(db);
      recipeIngredientsSnapshot.docs.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();

      await processRecipeIngredients(recipeId, recipe.sections);
    } catch (ingError) {
      console.warn("Secondary ingredient processing failed (non-critical):", ingError);
    }

    console.log("✅ Recipe saved. ID:", recipeId);
    return recipeId;

  } catch (error: any) {
    console.error("Critical error saving recipe:", error);
    const msg = extractErrorMessage(error);
    alert(`Failed to save recipe: ${msg}`);
    return null;
  }
};

/**
 * Fetches all recipes for a user
 */
export const getSavedRecipes = async (userId: string, includeImages: boolean = false): Promise<Recipe[]> => {
  try {
    const recipesRef = collection(db, 'recipes');
    const q = query(
      recipesRef,
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    const recipesSnapshot = await getDocs(q);

    if (recipesSnapshot.empty) return [];

    const recipeIds = recipesSnapshot.docs.map(doc => doc.id);
    
    // Fetch content for all recipes
    // Firestore 'in' queries are limited to 10 items, so batch if needed
    const contentRef = collection(db, 'recipe_content');
    const contentMap = new Map<string, any[]>();
    
    if (recipeIds.length > 0) {
      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < recipeIds.length; i += batchSize) {
        const batch = recipeIds.slice(i, i + batchSize);
        const contentQuery = query(contentRef, where('recipe_id', 'in', batch));
        const contentSnapshot = await getDocs(contentQuery);
        
        contentSnapshot.docs.forEach(doc => {
          const data = doc.data();
          const recipeId = data.recipe_id;
          if (!contentMap.has(recipeId)) {
            contentMap.set(recipeId, []);
          }
          contentMap.get(recipeId)!.push({ ...data, id: doc.id });
        });
      }
    }

    // Map to Recipe interface
    const fullRecipes: Recipe[] = recipesSnapshot.docs.map(doc => {
      const r = doc.data();
      const thisContent = (contentMap.get(doc.id) || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      
      const sections: RecipeSection[] = thisContent.map((c: any) => {
        let parsedContent: any = {};
        try {
          parsedContent = JSON.parse(c.content || '{}');
        } catch (e) {
          console.warn('Failed to parse recipe content JSON:', e);
        }
        
        let type: 'Overview' | 'Ingredients' | 'Instructions' = 'Instructions';
        if (c.section_type === 'instructions') type = 'Instructions';
        else if (c.section_type === 'notes') type = 'Ingredients';
        else if (c.section_type === 'tips') type = 'Overview';
        
        return {
          type: type,
          title: parsedContent.title || '',
          items: parsedContent.items || [],
          ingredients: parsedContent.ingredients || [],
          metadata: parsedContent.metadata || {}
        };
      });

      return {
        id: doc.id,
        title: r.name || '',
        description: r.description || '',
        difficulty: r.difficulty_level || '',
        chefNote: r.chef_note || '',
        totalTime: (r.prep_time_minutes || 0) + (r.cook_time_minutes || 0),
        prepTime: r.prep_time_minutes || 0,
        cookTime: r.cook_time_minutes || 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        mealType: r.meal_type || '',
        cuisine: r.cuisine_type || '',
        servings: r.servings || 1,
        dietaryTags: r.dietary_tags || [],
        allergens: r.allergens || [],
        chefPersona: r.chef_persona || '',
        imageUrl: includeImages ? (r.image_url || '') : '',
        isFavorite: r.is_favorite || false,
        isPublic: r.is_public || false,
        createdAt: timestampToISO(r.created_at),
        sections: sections
      };
    });

    return fullRecipes;

  } catch (error: any) {
    console.error("Error fetching recipes:", error);
    return [];
  }
};

/**
 * Fetch a single recipe by ID
 */
export const getRecipeById = async (recipeId: string, includeImages: boolean = true): Promise<Recipe | null> => {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeSnap = await getDoc(recipeRef);

    if (!recipeSnap.exists()) return null;

    const recipeRow = recipeSnap.data();

    // Fetch content
    const contentRef = collection(db, 'recipe_content');
    const contentQuery = query(
      contentRef,
      where('recipe_id', '==', recipeId),
      orderBy('order_index', 'asc')
    );
    const contentSnapshot = await getDocs(contentQuery);

    const sections: RecipeSection[] = contentSnapshot.docs.map(doc => {
      const c = doc.data();
      let parsedContent: any = {};
      try {
        parsedContent = JSON.parse(c.content || '{}');
      } catch (e) {
        console.warn('Failed to parse recipe content JSON:', e);
      }

      let type: 'Overview' | 'Ingredients' | 'Instructions' = 'Instructions';
      if (c.section_type === 'instructions') type = 'Instructions';
      else if (c.section_type === 'notes') type = 'Ingredients';
      else if (c.section_type === 'tips') type = 'Overview';

      return {
        type,
        title: parsedContent.title || '',
        items: parsedContent.items || [],
        ingredients: parsedContent.ingredients || [],
        metadata: parsedContent.metadata || {}
      };
    });

    return {
      id: recipeSnap.id,
      title: recipeRow.name || '',
      description: recipeRow.description || '',
      difficulty: recipeRow.difficulty_level || '',
      chefNote: recipeRow.chef_note || '',
      chefPersona: recipeRow.chef_persona || '',
      totalTime: (recipeRow.prep_time_minutes || 0) + (recipeRow.cook_time_minutes || 0),
      prepTime: recipeRow.prep_time_minutes || 0,
      cookTime: recipeRow.cook_time_minutes || 0,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      mealType: recipeRow.meal_type || '',
      cuisine: recipeRow.cuisine_type || '',
      servings: recipeRow.servings || 1,
      dietaryTags: recipeRow.dietary_tags || [],
      allergens: recipeRow.allergens || [],
      imageUrl: includeImages ? (recipeRow.image_url || '') : '',
      isFavorite: recipeRow.is_favorite || false,
      isPublic: recipeRow.is_public || false,
      createdAt: timestampToISO(recipeRow.created_at),
      sections
    };
  } catch (error) {
    console.error('Error fetching recipe by id:', error);
    return null;
  }
};

/**
 * Fetches image URLs for multiple recipes in batch
 */
export const getRecipeImageUrls = async (recipeIds: string[]): Promise<Map<string, string>> => {
  if (recipeIds.length === 0) return new Map();

  try {
    // Firestore doesn't support querying by document ID with 'in', so fetch individually
    // For better performance, we could batch read, but for now fetch sequentially
    const imageMap = new Map<string, string>();
    
    // Batch reads (Firestore allows up to 10 documents per batch)
    const batchSize = 10;
    for (let i = 0; i < recipeIds.length; i += batchSize) {
      const batch = recipeIds.slice(i, i + batchSize);
      const promises = batch.map(async (id) => {
        try {
          const recipeRef = doc(db, 'recipes', id);
          const recipeSnap = await getDoc(recipeRef);
          if (recipeSnap.exists()) {
            const data = recipeSnap.data();
            if (data.image_url) {
              imageMap.set(id, data.image_url);
            }
          }
        } catch (error) {
          console.warn(`Error fetching recipe ${id}:`, error);
        }
      });
      await Promise.all(promises);
    }

    return imageMap;
  } catch (error) {
    console.error('Error fetching recipe image URLs:', error);
    return new Map();
  }
};

export const deleteRecipe = async (recipeId: string): Promise<boolean> => {
  try {
    // Delete recipe
    const recipeRef = doc(db, 'recipes', recipeId);
    await deleteDoc(recipeRef);

    // Delete related content
    const contentRef = collection(db, 'recipe_content');
    const contentQuery = query(contentRef, where('recipe_id', '==', recipeId));
    const contentSnapshot = await getDocs(contentQuery);
    
    const batch = writeBatch(db);
    contentSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Delete recipe ingredients
    const recipeIngredientsRef = collection(db, 'recipe_ingredients');
    const recipeIngredientsQuery = query(recipeIngredientsRef, where('recipe_id', '==', recipeId));
    const recipeIngredientsSnapshot = await getDocs(recipeIngredientsQuery);
    const ingredientsBatch = writeBatch(db);
    recipeIngredientsSnapshot.docs.forEach(doc => {
      ingredientsBatch.delete(doc.ref);
    });
    await ingredientsBatch.commit();

    return true;
  } catch (error) {
    console.error("Error deleting recipe:", error);
    return false;
  }
};

/**
 * Fetches recent workouts - Stubbed out (was using Supabase RPC)
 * TODO: Re-implement if workout context is needed
 */
export const getRecentWorkouts = async (userId: string): Promise<any[]> => {
  console.warn("getRecentWorkouts: Not implemented in Firestore migration");
  return [];
};

/**
 * Get workout context for meal planning - Stubbed out (was using Supabase RPC)
 * TODO: Re-implement if workout context is needed
 */
export const getWorkoutContextForMealPlanning = async (userId: string, hoursBack: number = 24): Promise<any[]> => {
  console.warn("getWorkoutContextForMealPlanning: Not implemented in Firestore migration");
  return [];
};

/**
 * Audit Logic - Matches recipe ingredients to user inventory
 */
export const auditRecipeIngredients = async (userId: string, ingredients: Ingredient[]): Promise<AuditItem[]> => {
  try {
    // 1. Resolve Canonical IDs
    const names = ingredients.map(i => i.item.trim());
    const canonicalRef = collection(db, 'canonical_ingredients');
    
    // Firestore 'in' queries are limited to 10 items, so batch if needed
    const nameToIdMap = new Map<string, string>();
    if (names.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < names.length; i += batchSize) {
        const batch = names.slice(i, i + batchSize);
        const canonicalQuery = query(canonicalRef, where('name', 'in', batch));
        const canonicalSnapshot = await getDocs(canonicalQuery);
        
        canonicalSnapshot.docs.forEach(doc => {
          const data = doc.data();
          nameToIdMap.set(data.name.toLowerCase(), doc.id);
        });
      }
    }

    // 2. Fetch User's Inventory
    const inventoryRef = collection(db, 'user_inventory');
    const inventoryQuery = query(inventoryRef, where('user_id', '==', userId));
    const inventorySnapshot = await getDocs(inventoryQuery);
    
    const inventorySet = new Set<string>();
    const inventoryIdMap = new Map<string, string>();

    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      const normalizedName = data.ingredient_name?.toLowerCase();
      if (normalizedName) {
        inventorySet.add(normalizedName);
        inventoryIdMap.set(normalizedName, doc.id);
      }
    });

    // 3. Build the Audit List
    const auditList: AuditItem[] = ingredients.map(ing => {
      const normalizedName = ing.item.trim().toLowerCase();
      const canonicalId = nameToIdMap.get(normalizedName);
      const hasInStock = inventorySet.has(normalizedName);

      return {
        name: ing.item,
        qty: ing.quantity,
        unit: ing.unit,
        canonicalId: canonicalId,
        inventoryId: inventoryIdMap.get(normalizedName),
        inStock: hasInStock
      };
    });

    return auditList;

  } catch (error) {
    console.error("Error auditing ingredients:", extractErrorMessage(error));
    return ingredients.map(ing => ({
      name: ing.item,
      qty: ing.quantity,
      unit: ing.unit,
      inStock: false
    }));
  }
};

/**
 * Commit Audit - Updates inventory and shopping list
 */
export const commitShoppingAudit = async (userId: string, auditItems: AuditItem[], recipeId?: string): Promise<boolean> => {
  try {
    const inStockItems = auditItems.filter(i => i.inStock);
    const toBuyItems = auditItems.filter(i => !i.inStock);

    // Process inventory updates first (separate batch to avoid conflicts)
    if (inStockItems.length > 0) {
      const inventoryBatch = writeBatch(db);
      
      for (const item of inStockItems) {
        // Check if inventory item exists
        const inventoryRef = collection(db, 'user_inventory');
        const inventoryQuery = query(
          inventoryRef,
          where('user_id', '==', userId),
          where('ingredient_name', '==', item.name)
        );
        const inventorySnapshot = await getDocs(inventoryQuery);

        if (inventorySnapshot.empty) {
          const newInventoryRef = doc(collection(db, 'user_inventory'));
          inventoryBatch.set(newInventoryRef, {
            user_id: userId,
            ingredient_name: item.name,
            in_stock: true
          });
        } else {
          // Update existing to ensure in_stock is true
          const existingRef = inventorySnapshot.docs[0].ref;
          inventoryBatch.update(existingRef, {
            in_stock: true
          });
        }
      }
      
      await inventoryBatch.commit();
    }

    // Process shopping list updates
    if (toBuyItems.length > 0) {
      const ingredientNames = toBuyItems.map(i => i.name);
      const shoppingListRef = collection(db, 'shopping_list');
      const existingQuery = query(
        shoppingListRef,
        where('user_id', '==', userId),
        where('is_purchased', '==', false)
      );
      const existingSnapshot = await getDocs(existingQuery);

      const existingMap = new Map<string, any>();
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (ingredientNames.includes(data.ingredient_name)) {
          existingMap.set(data.ingredient_name.toLowerCase(), { ...data, id: doc.id });
        }
      });

      const shoppingBatch = writeBatch(db);
      
      for (const item of toBuyItems) {
        const existingItem = existingMap.get(item.name.toLowerCase());
        
        if (existingItem && existingItem.unit === item.unit) {
          // Update existing
          const existingRef = doc(db, 'shopping_list', existingItem.id);
          shoppingBatch.update(existingRef, {
            quantity: (existingItem.quantity || 0) + (parseFloat(item.qty) || 0),
            recipe_id: null
          });
        } else if (existingItem && existingItem.unit !== item.unit) {
          // Merge units
          const existingQty = existingItem.quantity ? `${existingItem.quantity} ${existingItem.unit || ''}`.trim() : '';
          const newQty = item.qty ? `${item.qty} ${item.unit || ''}`.trim() : '';
          const combinedQty = existingQty && newQty ? `${existingQty} + ${newQty}` : (newQty || existingQty);
          
          const existingRef = doc(db, 'shopping_list', existingItem.id);
          shoppingBatch.update(existingRef, {
            quantity: null,
            unit: combinedQty,
            recipe_id: null
          });
        } else {
          // New item
          const newItemRef = doc(collection(db, 'shopping_list'));
          shoppingBatch.set(newItemRef, {
            user_id: userId,
            ingredient_name: item.name,
            recipe_id: recipeId || null,
            is_purchased: false,
            quantity: parseFloat(item.qty) || null,
            unit: item.unit || null
          });
        }
      }
      
      await shoppingBatch.commit();
    }

    return true;
  } catch (error) {
    console.error("Error committing audit:", error);
    return false;
  }
};

/**
 * Get Shopping List
 */
export const getShoppingList = async (userId: string): Promise<ShoppingListItem[]> => {
  try {
    const shoppingListRef = collection(db, 'shopping_list');
    const q = query(
      shoppingListRef,
      where('user_id', '==', userId),
      orderBy('is_purchased', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ingredientId: d.ingredient_name || '',
        name: d.ingredient_name || 'Unknown Item',
        isChecked: d.is_purchased || false
      };
    });
  } catch (e) {
    console.error("Error fetching shopping list", e);
    return [];
  }
};

/**
 * Toggle Shopping Item
 */
export const toggleShoppingItem = async (itemId: string, isChecked: boolean) => {
  try {
    const itemRef = doc(db, 'shopping_list', itemId);
    await updateDoc(itemRef, { is_purchased: isChecked });
  } catch (error) {
    console.error("Error toggling shopping item:", error);
  }
};

/**
 * Get User Locations
 */
export const getUserLocations = async (userId: string): Promise<Location[]> => {
  try {
    const locationsRef = collection(db, 'locations');
    const q = query(locationsRef, where('user_id', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Seed defaults
      const defaults = [
        { user_id: userId, name: 'Pantry', icon: 'Box' },
        { user_id: userId, name: 'Fridge', icon: 'Snowflake' },
        { user_id: userId, name: 'Freezer', icon: 'IceCream' },
        { user_id: userId, name: 'Spice Rack', icon: 'Flame' }
      ];
      
      const batch = writeBatch(db);
      defaults.forEach(location => {
        const locationRef = doc(collection(db, 'locations'));
        batch.set(locationRef, location);
      });
      await batch.commit();

      // Fetch again
      const newSnapshot = await getDocs(q);
      return newSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Location));
    }

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Location));
  } catch (e) {
    console.error("Error fetching locations:", e);
    return [];
  }
};

/**
 * Move Shopping to Inventory
 */
export const moveShoppingToInventory = async (
  userId: string, 
  itemsToMove: ShoppingListItem[], 
  locationMap: Record<string, string>
): Promise<{ success: boolean; message?: string }> => {
  try {
    const uniqueItems = new Map<string, any>();

    itemsToMove.forEach(item => {
      const locId = locationMap[item.name];
      uniqueItems.set(item.name.toLowerCase(), {
        user_id: userId,
        ingredient_name: item.name,
        location_id: locId,
        in_stock: true
      });
    });

    // Fetch existing inventory items first (batch query)
    const ingredientNames = Array.from(uniqueItems.values()).map(item => item.ingredient_name);
    const inventoryRef = collection(db, 'user_inventory');
    const inventoryQuery = query(
      inventoryRef,
      where('user_id', '==', userId),
      where('ingredient_name', 'in', ingredientNames.length > 10 ? ingredientNames.slice(0, 10) : ingredientNames)
    );
    const inventorySnapshot = await getDocs(inventoryQuery);

    const existingInventoryMap = new Map<string, any>();
    inventorySnapshot.docs.forEach(doc => {
      const data = doc.data();
      existingInventoryMap.set(data.ingredient_name.toLowerCase(), { ...data, id: doc.id });
    });

    const batch = writeBatch(db);

    // Upsert to inventory
    for (const [key, item] of uniqueItems) {
      const existing = existingInventoryMap.get(key);
      
      if (existing) {
        // Update existing
        const existingRef = doc(db, 'user_inventory', existing.id);
        batch.update(existingRef, {
          location_id: item.location_id,
          in_stock: true
        });
      } else {
        // Create new
        const newInventoryRef = doc(collection(db, 'user_inventory'));
        batch.set(newInventoryRef, item);
      }
    }

    // Delete from shopping list
    itemsToMove.forEach(item => {
      const itemRef = doc(db, 'shopping_list', item.id);
      batch.delete(itemRef);
    });

    await batch.commit();
    return { success: true };
  } catch (e: any) {
    console.error("Error moving to inventory", e);
    const msg = extractErrorMessage(e);
    return { success: false, message: msg };
  }
};

/**
 * Get User Inventory
 */
export const getUserInventory = async (userId: string): Promise<InventoryItem[]> => {
  try {
    const inventoryRef = collection(db, 'user_inventory');
    const q = query(inventoryRef, where('user_id', '==', userId));
    const snapshot = await getDocs(q);

    // Fetch locations separately (Firestore doesn't support joins)
    const locationIds = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.location_id) locationIds.add(data.location_id);
    });

    const locationsMap = new Map<string, any>();
    if (locationIds.size > 0) {
      // Fetch locations individually (Firestore doesn't support querying by document ID with 'in')
      const locationPromises = Array.from(locationIds).map(async (locationId) => {
        try {
          const locationRef = doc(db, 'locations', locationId);
          const locationSnap = await getDoc(locationRef);
          if (locationSnap.exists()) {
            locationsMap.set(locationId, locationSnap.data());
          }
        } catch (error) {
          console.warn(`Error fetching location ${locationId}:`, error);
        }
      });
      await Promise.all(locationPromises);
    }

    return snapshot.docs.map(doc => {
      const row = doc.data();
      const location = locationsMap.get(row.location_id);
      return {
        id: doc.id,
        ingredientId: row.ingredient_name || '',
        ingredientName: row.ingredient_name || 'Unknown',
        name: row.ingredient_name || 'Unknown',
        quantity: row.quantity,
        unit: row.unit,
        locationId: row.location_id,
        locationName: location?.name || 'Unsorted',
        inStock: row.in_stock ?? true
      };
    });
  } catch (e) {
    console.error("Error fetching inventory:", e);
    return [];
  }
};

/**
 * Update Inventory Status
 */
export const updateInventoryStatus = async (
  userId: string, 
  inventoryItem: InventoryItem, 
  newInStock: boolean
): Promise<boolean> => {
  try {
    const itemRef = doc(db, 'user_inventory', inventoryItem.id);
    await updateDoc(itemRef, { in_stock: newInStock });

    // If depleted, add to shopping list
    if (!newInStock) {
      // Check if already in shopping list
      const shoppingListRef = collection(db, 'shopping_list');
      const shoppingQuery = query(
        shoppingListRef,
        where('user_id', '==', userId),
        where('ingredient_name', '==', inventoryItem.name),
        where('is_purchased', '==', false)
      );
      const shoppingSnapshot = await getDocs(shoppingQuery);

      if (shoppingSnapshot.empty) {
        const newItemRef = doc(collection(db, 'shopping_list'));
        await setDoc(newItemRef, {
          user_id: userId,
          ingredient_name: inventoryItem.name,
          is_purchased: false,
          quantity: inventoryItem.quantity,
          unit: inventoryItem.unit
        });
      }
    }

    return true;
  } catch (e) {
    console.error("Error updating inventory status:", e);
    return false;
  }
};

/**
 * Update Inventory Location
 */
export const updateInventoryLocation = async (
  inventoryItemId: string,
  newLocationId: string | null
): Promise<boolean> => {
  try {
    const itemRef = doc(db, 'user_inventory', inventoryItemId);
    await updateDoc(itemRef, { location_id: newLocationId });
    return true;
  } catch (e) {
    console.error("Error updating inventory location:", e);
    return false;
  }
};
