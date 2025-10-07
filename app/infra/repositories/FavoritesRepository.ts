// FavoritesRepository.ts - Handles persistence for user favorites (foods & recipes)
import { SupabaseClient } from '@supabase/supabase-js'

import { FoodItem, Recipe, FavoriteFood, FavoriteRecipe } from '@domain/models'

const FAVORITES_TABLE = 'user_favorites'
const RECIPE_FAVORITES_TABLE = 'user_recipe_favorites'

export interface FavoritesRepository {
  // Food Favorites
  getFavorites(userId: string, category?: string): Promise<FavoriteFood[]>
  addFavorite(userId: string, food: FoodItem, category?: string): Promise<void>
  removeFavorite(userId: string, foodId: string): Promise<void>
  isFavorite(userId: string, foodId: string): Promise<boolean>
  updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void>

  // Recipe Favorites
  getRecipeFavorites(userId: string, category?: string): Promise<FavoriteRecipe[]>
  addRecipeFavorite(userId: string, recipe: Recipe, category?: string): Promise<void>
  removeRecipeFavorite(userId: string, recipeId: string): Promise<void>
  isRecipeFavorite(userId: string, recipeId: string): Promise<boolean>
  updateRecipeFavoriteCategory(userId: string, recipeId: string, category: string): Promise<void>

  // Categories
  getFavoriteCategories(userId: string): Promise<string[]>

  // Bulk operations
  addMultipleFavorites(userId: string, foods: FoodItem[], category?: string): Promise<void>
}

export class FavoritesRepositoryImpl implements FavoritesRepository {
  constructor(private supabase: SupabaseClient) {}

  // ============ FOOD FAVORITES ============

  async getFavorites(userId: string, category?: string): Promise<FavoriteFood[]> {
    let query = this.supabase
      .from(FAVORITES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch favorites: ${error.message}`)
    }

    return (data || []).map(row => this.mapToFavoriteFood(row))
  }

  async addFavorite(userId: string, food: FoodItem, category?: string): Promise<void> {
    const now = new Date().toISOString()

    const favoriteData = {
      user_id: userId,
      food_id: food.id,
      food_name: food.name,
      food_brand: food.brand,
      food_source: food.source,
      food_nutrients: food.nutrients,
      food_serving_size: food.servingSize,
      food_ingredients: food.ingredients,
      food_allergens: food.allergens,
      food_created_by: food.createdBy,
      last_used: food.lastUsed,
      usage_count: food.usageCount || 0,
      category: category || 'general',
      added_at: now
    }

    const { error } = await this.supabase
      .from(FAVORITES_TABLE)
      .insert([favoriteData])

    if (error) {
      throw new Error(`Failed to add favorite: ${error.message}`)
    }
  }

  async removeFavorite(userId: string, foodId: string): Promise<void> {
    const { error } = await this.supabase
      .from(FAVORITES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('food_id', foodId)

    if (error) {
      throw new Error(`Failed to remove favorite: ${error.message}`)
    }
  }

  async isFavorite(userId: string, foodId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(FAVORITES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('food_id', foodId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check favorite: ${error.message}`)
    }

    return !!data
  }

  async updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void> {
    const { error } = await this.supabase
      .from(FAVORITES_TABLE)
      .update({ category })
      .eq('user_id', userId)
      .eq('food_id', foodId)

    if (error) {
      throw new Error(`Failed to update favorite category: ${error.message}`)
    }
  }

  // ============ RECIPE FAVORITES ============

  async getRecipeFavorites(userId: string, category?: string): Promise<FavoriteRecipe[]> {
    let query = this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false })

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch recipe favorites: ${error.message}`)
    }

    return (data || []).map(row => this.mapToFavoriteRecipe(row))
  }

  async addRecipeFavorite(userId: string, recipe: Recipe, category?: string): Promise<void> {
    const now = new Date().toISOString()

    const favoriteData = {
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
      last_used: recipe.lastUsed,
      usage_count: recipe.usageCount || 0,
      category: category || 'general',
      added_at: now
    }

    const { error } = await this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .insert([favoriteData])

    if (error) {
      throw new Error(`Failed to add recipe to favorites: ${error.message}`)
    }
  }

  async removeRecipeFavorite(userId: string, recipeId: string): Promise<void> {
    const { error } = await this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (error) {
      throw new Error(`Failed to remove recipe from favorites: ${error.message}`)
    }
  }

  async isRecipeFavorite(userId: string, recipeId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check recipe favorite: ${error.message}`)
    }

    return !!data
  }

  async updateRecipeFavoriteCategory(userId: string, recipeId: string, category: string): Promise<void> {
    const { error } = await this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .update({ category })
      .eq('user_id', userId)
      .eq('recipe_id', recipeId)

    if (error) {
      throw new Error(`Failed to update recipe favorite category: ${error.message}`)
    }
  }

  // ============ CATEGORIES ============

  async getFavoriteCategories(userId: string): Promise<string[]> {
    // Get categories from both food and recipe favorites
    const { data: foodCategories, error: foodError } = await this.supabase
      .from(FAVORITES_TABLE)
      .select('category')
      .eq('user_id', userId)

    const { data: recipeCategories, error: recipeError } = await this.supabase
      .from(RECIPE_FAVORITES_TABLE)
      .select('category')
      .eq('user_id', userId)

    if (foodError || recipeError) {
      throw new Error('Failed to fetch favorite categories')
    }

    const allCategories = [
      ...(foodCategories || []).map(row => row.category),
      ...(recipeCategories || []).map(row => row.category)
    ].filter(Boolean)

    return [...new Set(allCategories)].sort()
  }

  // ============ BULK OPERATIONS ============

  async addMultipleFavorites(userId: string, foods: FoodItem[], category?: string): Promise<void> {
    const now = new Date().toISOString()
    const favoriteDataArray = foods.map(food => ({
      user_id: userId,
      food_id: food.id,
      food_name: food.name,
      food_brand: food.brand,
      food_source: food.source,
      food_nutrients: food.nutrients,
      food_serving_size: food.servingSize,
      food_ingredients: food.ingredients,
      food_allergens: food.allergens,
      food_created_by: food.createdBy,
      last_used: food.lastUsed,
      usage_count: food.usageCount || 0,
      category: category || 'general',
      added_at: now
    }))

    const { error } = await this.supabase
      .from(FAVORITES_TABLE)
      .insert(favoriteDataArray)

    if (error) {
      throw new Error(`Failed to add multiple favorites: ${error.message}`)
    }
  }

  // ============ MAPPERS ============

  private mapToFavoriteFood(row: any): FavoriteFood {
    return {
      food: {
        id: row.food_id,
        name: row.food_name,
        brand: row.food_brand,
        source: row.food_source,
        nutrients: row.food_nutrients,
        servingSize: row.food_serving_size,
        lastUsed: row.last_used,
        usageCount: row.usage_count,
        isFavorite: true,
        isCustom: row.food_source === 'custom',
        createdBy: row.food_created_by,
        ingredients: row.food_ingredients,
        allergens: row.food_allergens
      },
      addedAt: row.added_at,
      userId: row.user_id,
      category: row.category
    }
  }

  private mapToFavoriteRecipe(row: any): FavoriteRecipe {
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
        usageCount: row.usage_count,
        isFavorite: true
      },
      addedAt: row.added_at,
      userId: row.user_id,
      category: row.category
    }
  }
}
