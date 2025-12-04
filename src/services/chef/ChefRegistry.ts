/**
 * Chef Registry
 * Manages available AI chefs
 */

import type { ChefPersona } from './chefPersonas';

export class ChefRegistry {
  private chefs: Map<string, ChefPersona> = new Map();

  /**
   * Register a chef
   */
  register(chef: ChefPersona): void {
    this.chefs.set(chef.id, chef);
    console.log(`✅ Registered ${chef.name} (ID: ${chef.id})`);
  }

  /**
   * Get all registered chefs
   */
  getAllChefs(): ChefPersona[] {
    return Array.from(this.chefs.values());
  }

  /**
   * Get chef by ID
   */
  getChef(id: string): ChefPersona | undefined {
    return this.chefs.get(id);
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.chefs.size;
  }
}

// Export singleton
export const chefRegistry = new ChefRegistry();

