/**
 * Chef Services
 * Central export for all chef-related functionality
 */

export { chefRegistry, ChefRegistry } from './ChefRegistry';
export { CHEF_PERSONAS } from './chefPersonas';
export type { ChefPersona } from './chefPersonas';
export { generateRecipe, getDefaultChefId } from './recipeGenerator';
export type { RecipeGenerationOptions } from './recipeGenerator';

