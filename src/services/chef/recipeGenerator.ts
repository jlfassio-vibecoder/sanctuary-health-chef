/**
 * Recipe Generator
 * Uses Gemini AI with chef personas to generate recipes
 */

import { chefRegistry } from './ChefRegistry';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI
const getGenAI = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY not configured');
  }
  return new GoogleGenerativeAI(apiKey);
};

export interface RecipeGenerationOptions {
  chefId: string;
  dietaryRestrictions?: string[];
  cuisinePreferences?: string[];
  cookingTime?: number;
  servings?: number;
  workoutContext?: string;
  cravings?: string;
  availableIngredients?: string[];
  hungerLevel?: number;
  moodLevel?: number;
}

export async function generateRecipe(options: RecipeGenerationOptions): Promise<string> {
  // Get the selected chef
  const chef = chefRegistry.getChef(options.chefId);
  
  if (!chef) {
    throw new Error(`Chef not found: ${options.chefId}`);
  }

  console.log(`👨‍🍳 Using ${chef.name} to generate recipe...`);

  // Build comprehensive prompt
  const prompt = `
${chef.systemPrompt}

User Preferences:
- Dietary restrictions: ${options.dietaryRestrictions?.join(', ') || 'None'}
- Cuisine preferences: ${options.cuisinePreferences?.join(', ') || 'Any'}
- Cooking time available: ${options.cookingTime || 30} minutes
- Servings needed: ${options.servings || 1}
${options.cravings ? `- Cravings/Goals: ${options.cravings}` : ''}
${options.availableIngredients?.length ? `- Ingredients to use: ${options.availableIngredients.join(', ')}` : ''}
${options.hungerLevel ? `- Hunger level: ${options.hungerLevel}/10` : ''}
${options.moodLevel ? `- Energy/Mood: ${options.moodLevel}/10` : ''}

${options.workoutContext ? `Recent Workout Context: ${options.workoutContext}` : ''}

Generate a detailed recipe including:
1. Recipe name (creative and descriptive)
2. Prep time and cook time
3. Complete ingredients list with measurements
4. Step-by-step cooking instructions
5. Macronutrient breakdown (protein, carbs, fats, calories per serving)
6. Storage and reheating instructions
7. Pro tips for best results

Format the recipe in clear, easy-to-follow sections.
  `.trim();

  try {
    // Call Gemini
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    console.log('🤖 Generating recipe with Gemini AI...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const recipeText = response.text();
    
    console.log(`✅ Recipe generated successfully by ${chef.name}`);
    
    return recipeText;
  } catch (error) {
    console.error('❌ Error generating recipe:', error);
    throw new Error(`Failed to generate recipe: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a default chef ID (Sports Nutritionist)
 */
export function getDefaultChefId(): string {
  const defaultChef = chefRegistry.getChef('gemini-nutritionist');
  if (defaultChef) {
    return defaultChef.id;
  }
  
  // Fallback to first available chef
  const allChefs = chefRegistry.getAllChefs();
  if (allChefs.length > 0) {
    return allChefs[0].id;
  }
  
  throw new Error('No chefs registered');
}

