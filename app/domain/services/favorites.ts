import { FoodItem, FavoriteFood, Recipe, FavoriteRecipe, Favorite } from '@domain/models'

import { FavoritesRepository } from '@infra/repositories/FavoritesRepository'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface FavoritesService {
  getFavorites(userId: string, category?: string): Promise<FoodItem[]>
  getFavoriteRecipes(userId: string, category?: string): Promise<Recipe[]>
  getFavoritesAll(userId: string, category?: string): Promise<(FoodItem | Recipe)[]>
  addToFavorites(userId: string, food: FoodItem, category?: string): Promise<void>
  addRecipeToFavorites(userId: string, recipe: Recipe, category?: string): Promise<void>
  removeFromFavorites(userId: string, foodId: string): Promise<void>
  removeRecipeFromFavorites(userId: string, recipeId: string): Promise<void>
  isFavorite(userId: string, foodId: string): Promise<boolean>
  isRecipeFavorite(userId: string, recipeId: string): Promise<boolean>
  getFavoriteCategories(userId: string): Promise<string[]>
  updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void>
  updateRecipeFavoriteCategory(userId: string, recipeId: string, category: string): Promise<void>
}

export class FavoritesServiceImpl implements FavoritesService {
  private cache = new Map<string, FavoriteFood[]>()
  private recipeCache = new Map<string, FavoriteRecipe[]>()
  private favoriteIds = new Map<string, Set<string>>()
  private favoriteRecipeIds = new Map<string, Set<string>>()

  constructor(private repository: FavoritesRepository) {}

  async getFavorites(userId: string, category?: string): Promise<FoodItem[]> {
    try {
      let favorites = this.cache.get(userId)

      if (!favorites) {
        favorites = await this.repository.getFavorites(userId)
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

      await this.repository.addFavorite(userId, food, category)

      // Update cache
      const favorites = this.cache.get(userId) || []
      const newFavorite: FavoriteFood = {
        food: { ...food, isFavorite: true },
        addedAt: new Date().toISOString(),
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
      await this.repository.removeFavorite(userId, foodId)

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
      const categories = await this.repository.getFavoriteCategories(userId)
      return categories.length > 0 ? categories : ['general']

    } catch (error) {
      logger.error('Failed to get favorite categories', { userId, error })
      return ['general']
    }
  }

  async updateFavoriteCategory(userId: string, foodId: string, category: string): Promise<void> {
    try {
      await this.repository.updateFavoriteCategory(userId, foodId, category)

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

  async getFavoriteRecipes(userId: string, category?: string): Promise<Recipe[]> {
    try {
      let favorites = this.recipeCache.get(userId)

      if (!favorites) {
        favorites = await this.repository.getRecipeFavorites(userId)
        this.recipeCache.set(userId, favorites)
        this.favoriteRecipeIds.set(userId, new Set(favorites.map(f => f.recipe.id)))
      }

      // Filter by category if specified
      const filteredFavorites = category
        ? favorites.filter(fav => fav.category === category)
        : favorites

      return filteredFavorites.map(fav => fav.recipe)

    } catch (error) {
      logger.error('Failed to get favorite recipes', { userId, category, error })
      return []
    }
  }

  async getFavoritesAll(userId: string, category?: string): Promise<(FoodItem | Recipe)[]> {
    try {
      const foods = await this.getFavorites(userId, category)
      const recipes = await this.getFavoriteRecipes(userId, category)

      // Combine and sort by added date
      const combined: Array<{ item: FoodItem | Recipe; addedAt: string }> = [
        ...foods.map(food => ({
          item: food,
          addedAt: this.cache.get(userId)?.find(f => f.food.id === food.id)?.addedAt || new Date().toISOString()
        })),
        ...recipes.map(recipe => ({
          item: recipe,
          addedAt: this.recipeCache.get(userId)?.find(f => f.recipe.id === recipe.id)?.addedAt || new Date().toISOString()
        }))
      ]

      // Sort by most recently added
      const sorted = combined.sort((a, b) =>
        new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      )

      return sorted.map(entry => entry.item)

    } catch (error) {
      logger.error('Failed to get all favorites', { userId, category, error })
      return []
    }
  }

  async addRecipeToFavorites(userId: string, recipe: Recipe, category?: string): Promise<void> {
    try {
      // Check if already favorited
      if (await this.isRecipeFavorite(userId, recipe.id)) {
        logger.debug('Recipe already in favorites', { userId, recipeId: recipe.id })
        return
      }

      await this.repository.addRecipeFavorite(userId, recipe, category)

      // Update cache
      const favorites = this.recipeCache.get(userId) || []
      const newFavorite: FavoriteRecipe = {
        recipe: { ...recipe, isFavorite: true },
        addedAt: new Date().toISOString(),
        userId,
        category: category || 'general'
      }
      favorites.unshift(newFavorite)
      this.recipeCache.set(userId, favorites)

      // Update favorite IDs set
      const favoriteIdSet = this.favoriteRecipeIds.get(userId) || new Set()
      favoriteIdSet.add(recipe.id)
      this.favoriteRecipeIds.set(userId, favoriteIdSet)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: recipe.id,
        source: 'recipe_favorites_added',
        cacheSize: favorites.length
      })

      logger.info('Added recipe to favorites', {
        userId,
        recipeId: recipe.id,
        recipeName: recipe.name,
        category: category || 'general'
      })

    } catch (error) {
      logger.error('Failed to add recipe to favorites', { userId, recipeId: recipe.id, error })
      throw error
    }
  }

  async removeRecipeFromFavorites(userId: string, recipeId: string): Promise<void> {
    try {
      await this.repository.removeRecipeFavorite(userId, recipeId)

      // Update cache
      const favorites = this.recipeCache.get(userId) || []
      const updatedFavorites = favorites.filter(fav => fav.recipe.id !== recipeId)
      this.recipeCache.set(userId, updatedFavorites)

      // Update favorite IDs set
      const favoriteIdSet = this.favoriteRecipeIds.get(userId) || new Set()
      favoriteIdSet.delete(recipeId)
      this.favoriteRecipeIds.set(userId, favoriteIdSet)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: recipeId,
        source: 'recipe_favorites_removed',
        cacheSize: updatedFavorites.length
      })

      logger.info('Removed recipe from favorites', { userId, recipeId })

    } catch (error) {
      logger.error('Failed to remove recipe from favorites', { userId, recipeId, error })
      throw error
    }
  }

  async isRecipeFavorite(userId: string, recipeId: string): Promise<boolean> {
    try {
      let favoriteIdSet = this.favoriteRecipeIds.get(userId)

      if (!favoriteIdSet) {
        // Load favorites to populate cache
        await this.getFavoriteRecipes(userId)
        favoriteIdSet = this.favoriteRecipeIds.get(userId) || new Set()
      }

      return favoriteIdSet.has(recipeId)

    } catch (error) {
      logger.error('Failed to check if recipe is favorite', { userId, recipeId, error })
      return false
    }
  }

  async updateRecipeFavoriteCategory(userId: string, recipeId: string, category: string): Promise<void> {
    try {
      await this.repository.updateRecipeFavoriteCategory(userId, recipeId, category)

      // Update cache
      const favorites = this.recipeCache.get(userId) || []
      const favoriteIndex = favorites.findIndex(fav => fav.recipe.id === recipeId)
      if (favoriteIndex >= 0) {
        favorites[favoriteIndex] = {
          ...favorites[favoriteIndex],
          category
        }
        this.recipeCache.set(userId, favorites)
      }

      logger.info('Updated recipe favorite category', { userId, recipeId, category })

    } catch (error) {
      logger.error('Failed to update recipe favorite category', { userId, recipeId, category, error })
      throw error
    }
  }

  // Bulk operations for efficiency
  async addMultipleToFavorites(userId: string, foods: FoodItem[], category?: string): Promise<void> {
    try {
      await this.repository.addMultipleFavorites(userId, foods, category)

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
      this.recipeCache.delete(userId)
      this.favoriteIds.delete(userId)
      this.favoriteRecipeIds.delete(userId)
    } else {
      this.cache.clear()
      this.recipeCache.clear()
      this.favoriteIds.clear()
      this.favoriteRecipeIds.clear()
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

// Singleton instance - will be initialized with repository in app setup
// For now, this is a placeholder that will be replaced when the app initializes
export let favoritesService: FavoritesService

export function initializeFavoritesService(repository: FavoritesRepository): void {
  favoritesService = new FavoritesServiceImpl(repository)
}
