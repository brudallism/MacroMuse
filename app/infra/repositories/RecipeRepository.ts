// RecipeRepository.ts - Handles persistence for user recent recipes
import { SupabaseClient } from '@supabase/supabase-js'

import { Recipe, RecentRecipeEntry } from '@domain/models'

const RECENT_RECIPES_TABLE = 'user_recent_recipes'

export interface RecipeRepository {
  // Recent Recipes
  getRecentRecipes(userId: string, limit?: number): Promise<RecentRecipeEntry[]>
  addRecentRecipe(userId: string, recipe: Recipe): Promise<void>
  updateRecentRecipe(userId: string, recipeId: string, usageCount: number): Promise<void>
  clearRecentRecipes(userId: string): Promise<void>
  cleanupOldRecipes(userId: string, keepCount: number): Promise<void>
}

export class RecipeRepositoryImpl implements RecipeRepository {
  constructor(private supabase: SupabaseClient) {}

  async getRecentRecipes(userId: string, limit: number = 20): Promise<RecentRecipeEntry[]> {
    const { data, error } = await this.supabase
      .from(RECENT_RECIPES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('last_used', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch recent recipes: ${error.message}`)
    }

    return (data || []).map(row => this.mapToRecentRecipeEntry(row))
  }

  async addRecentRecipe(userId: string, recipe: Recipe): Promise<void> {
    const now = new Date().toISOString()

    // Check if recipe already exists
    const { data: existing } = await this.supabase
      .from(RECENT_RECIPES_TABLE)
      .select('id, usage_count')
      .eq('user_id', userId)
      .eq('recipe_id', recipe.id)
      .maybeSingle()

    if (existing) {
      // Update existing entry
      const { error } = await this.supabase
        .from(RECENT_RECIPES_TABLE)
        .update({
          last_used: now,
          usage_count: existing.usage_count + 1
        })
        .eq('id', existing.id)

      if (error) {
        throw new Error(`Failed to update recent recipe: ${error.message}`)
      }
    } else {
      // Insert new entry
      const recentRecipeData = {
        user_id: userId,
        recipe_id: recipe.id,
        recipe_name: recipe.name,
        recipe_image: recipe.image,
        recipe_source: recipe.source,
        recipe_source_id: recipe.sourceId,
        recipe_servings: recipe.servings,
        recipe_ready_minutes: recipe.readyInMinutes,
        recipe_diets: recipe.diets,
        recipe_dish_types: recipe.dishTypes,
        recipe_cuisines: recipe.cuisines,
        recipe_summary: recipe.summary,
        recipe_nutrients: recipe.nutrients,
        recipe_weight_per_serving: recipe.weightPerServing,
        last_used: now,
        usage_count: 1
      }

      const { error } = await this.supabase
        .from(RECENT_RECIPES_TABLE)
        .insert([recentRecipeData])

      if (error) {
        throw new Error(`Failed to add recent recipe: ${error.message}`)
      }
    }
  }

  async updateRecentRecipe(userId: string, recipeId: string, usageCount: number): Promise<void> {
    const { error } = await this.supabase
      .from(RECENT_RECIPES_TABLE)
      .update({
        last_used: new Date().toISOString(),
        usage_count: usageCount
      })
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (error) {
      throw new Error(`Failed to update recent recipe: ${error.message}`)
    }
  }

  async clearRecentRecipes(userId: string): Promise<void> {
    const { error } = await this.supabase
      .from(RECENT_RECIPES_TABLE)
      .delete()
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to clear recent recipes: ${error.message}`)
    }
  }

  async cleanupOldRecipes(userId: string, keepCount: number = 20): Promise<void> {
    // Get all recent recipes for this user, ordered by last_used
    const { data: allRecipes, error: fetchError } = await this.supabase
      .from(RECENT_RECIPES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .order('last_used', { ascending: false })

    if (fetchError) {
      throw new Error(`Failed to fetch recipes for cleanup: ${fetchError.message}`)
    }

    // If we have more than keepCount, delete the older ones
    if (allRecipes && allRecipes.length > keepCount) {
      const idsToKeep = allRecipes.slice(0, keepCount).map(r => r.id)

      const { error: deleteError } = await this.supabase
        .from(RECENT_RECIPES_TABLE)
        .delete()
        .eq('user_id', userId)
        .not('id', 'in', `(${idsToKeep.join(',')})`)

      if (deleteError) {
        throw new Error(`Failed to cleanup old recipes: ${deleteError.message}`)
      }
    }
  }

  private mapToRecentRecipeEntry(row: any): RecentRecipeEntry {
    return {
      recipe: {
        id: row.recipe_id,
        name: row.recipe_name,
        image: row.recipe_image,
        source: row.recipe_source,
        sourceId: row.recipe_source_id,
        servings: row.recipe_servings,
        readyInMinutes: row.recipe_ready_minutes,
        diets: row.recipe_diets,
        dishTypes: row.recipe_dish_types,
        cuisines: row.recipe_cuisines,
        summary: row.recipe_summary,
        nutrients: row.recipe_nutrients,
        weightPerServing: row.recipe_weight_per_serving,
        lastUsed: row.last_used,
        usageCount: row.usage_count
      },
      lastUsed: row.last_used,
      usageCount: row.usage_count,
      userId: row.user_id
    }
  }
}
