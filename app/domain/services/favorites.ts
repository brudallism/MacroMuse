import { FoodItem, FavoriteFood } from '@domain/models'
import { supabase } from '@infra/database/supabase'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface FavoritesService {
  getFavorites(userId: string, category?: string): Promise<FoodItem[]>
  addToFavorites(userId: string, food: FoodItem, category?: string): Promise<void>
  removeFromFavorites(userId: string, foodId: string): Promise<void>
  isFavorite(userId: string, foodId: string): Promise<boolean>
  getFavoriteCategories(userId: string): Promise<string[]>
  updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void>
}

const FAVORITES_TABLE = 'user_favorites'

export class FavoritesServiceImpl implements FavoritesService {
  private cache = new Map<string, FavoriteFood[]>()
  private favoriteIds = new Map<string, Set<string>>()

  async getFavorites(userId: string, category?: string): Promise<FoodItem[]> {
    try {
      let favorites = this.cache.get(userId)

      if (!favorites) {
        const { data, error } = await supabase
          .from(FAVORITES_TABLE)
          .select('*')
          .eq('user_id', userId)
          .order('added_at', { ascending: false })

        if (error) {
          throw new Error(`Failed to fetch favorites: ${error.message}`)
        }

        favorites = (data || []).map(row => ({
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
        }))

        this.cache.set(userId, favorites)
        this.favoriteIds.set(userId, new Set(favorites.map(f => f.food.id)))
      }

      // Filter by category if specified
      const filteredFavorites = category
        ? favorites.filter(fav => fav.category === category)
        : favorites

      return filteredFavorites.map(fav => fav.food)

    } catch (error) {
      logger.error('Failed to get favorites', { userId, category, error })
      return []
    }
  }

  async addToFavorites(userId: string, food: FoodItem, category?: string): Promise<void> {
    try {
      // Check if already favorited
      if (await this.isFavorite(userId, food.id)) {
        logger.debug('Food already in favorites', { userId, foodId: food.id })
        return
      }

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

      const { error } = await supabase
        .from(FAVORITES_TABLE)
        .insert([favoriteData])

      if (error) {
        throw new Error(`Failed to add favorite: ${error.message}`)
      }

      // Update cache
      const favorites = this.cache.get(userId) || []
      const newFavorite: FavoriteFood = {
        food: { ...food, isFavorite: true },
        addedAt: now,
        userId,
        category: category || 'general'
      }
      favorites.unshift(newFavorite)
      this.cache.set(userId, favorites)

      // Update favorite IDs set
      const favoriteIdSet = this.favoriteIds.get(userId) || new Set()
      favoriteIdSet.add(food.id)
      this.favoriteIds.set(userId, favoriteIdSet)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: food.id,
        source: 'favorites_added',
        cacheSize: favorites.length
      })

      logger.info('Added food to favorites', {
        userId,
        foodId: food.id,
        foodName: food.name,
        category: category || 'general'
      })

    } catch (error) {
      logger.error('Failed to add food to favorites', { userId, foodId: food.id, error })
      throw error
    }
  }

  async removeFromFavorites(userId: string, foodId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(FAVORITES_TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('food_id', foodId)

      if (error) {
        throw new Error(`Failed to remove favorite: ${error.message}`)
      }

      // Update cache
      const favorites = this.cache.get(userId) || []
      const updatedFavorites = favorites.filter(fav => fav.food.id !== foodId)
      this.cache.set(userId, updatedFavorites)

      // Update favorite IDs set
      const favoriteIdSet = this.favoriteIds.get(userId) || new Set()
      favoriteIdSet.delete(foodId)
      this.favoriteIds.set(userId, favoriteIdSet)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: foodId,
        source: 'favorites_removed',
        cacheSize: updatedFavorites.length
      })

      logger.info('Removed food from favorites', { userId, foodId })

    } catch (error) {
      logger.error('Failed to remove food from favorites', { userId, foodId, error })
      throw error
    }
  }

  async isFavorite(userId: string, foodId: string): Promise<boolean> {
    try {
      let favoriteIdSet = this.favoriteIds.get(userId)

      if (!favoriteIdSet) {
        // Load favorites to populate cache
        await this.getFavorites(userId)
        favoriteIdSet = this.favoriteIds.get(userId) || new Set()
      }

      return favoriteIdSet.has(foodId)

    } catch (error) {
      logger.error('Failed to check if food is favorite', { userId, foodId, error })
      return false
    }
  }

  async getFavoriteCategories(userId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from(FAVORITES_TABLE)
        .select('category')
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Failed to fetch favorite categories: ${error.message}`)
      }

      const categories = [...new Set((data || []).map(row => row.category).filter(Boolean))]
      return categories.sort()

    } catch (error) {
      logger.error('Failed to get favorite categories', { userId, error })
      return ['general']
    }
  }

  async updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(FAVORITES_TABLE)
        .update({ category })
        .eq('user_id', userId)
        .eq('food_id', foodId)

      if (error) {
        throw new Error(`Failed to update favorite category: ${error.message}`)
      }

      // Update cache
      const favorites = this.cache.get(userId) || []
      const favoriteIndex = favorites.findIndex(fav => fav.food.id === foodId)
      if (favoriteIndex >= 0) {
        favorites[favoriteIndex] = {
          ...favorites[favoriteIndex],
          category
        }
        this.cache.set(userId, favorites)
      }

      logger.info('Updated favorite category', { userId, foodId, category })

    } catch (error) {
      logger.error('Failed to update favorite category', { userId, foodId, category, error })
      throw error
    }
  }

  // Bulk operations for efficiency
  async addMultipleToFavorites(userId: string, foods: FoodItem[], category?: string): Promise<void> {
    try {
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

      const { error } = await supabase
        .from(FAVORITES_TABLE)
        .insert(favoriteDataArray)

      if (error) {
        throw new Error(`Failed to add multiple favorites: ${error.message}`)
      }

      // Clear cache to force reload
      this.cache.delete(userId)
      this.favoriteIds.delete(userId)

      logger.info('Added multiple foods to favorites', {
        userId,
        count: foods.length,
        category: category || 'general'
      })

    } catch (error) {
      logger.error('Failed to add multiple foods to favorites', { userId, count: foods.length, error })
      throw error
    }
  }

  // Clear cache for memory management
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
      this.favoriteIds.delete(userId)
    } else {
      this.cache.clear()
      this.favoriteIds.clear()
    }
    logger.debug('Favorites cache cleared', { userId })
  }

  // Get cache stats for debugging
  getCacheStats(): { userCount: number; totalFavorites: number } {
    let totalFavorites = 0
    for (const favorites of this.cache.values()) {
      totalFavorites += favorites.length
    }

    return {
      userCount: this.cache.size,
      totalFavorites
    }
  }
}

// Singleton instance
export const favoritesService = new FavoritesServiceImpl()