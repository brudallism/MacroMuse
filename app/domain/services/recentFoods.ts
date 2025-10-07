import { FoodItem, RecentFoodEntry, Recipe, RecentRecipeEntry, RecentEntry } from '@domain/models'

import { RecipeRepository } from '@infra/repositories/RecipeRepository'

import { useDataStore } from '@state/dataStore'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface RecentFoodsService {
  getRecent(userId: string, limit?: number): Promise<FoodItem[]>
  getRecentRecipes(userId: string, limit?: number): Promise<Recipe[]>
  getRecentAll(userId: string, limit?: number): Promise<(FoodItem | Recipe)[]>
  addToRecent(userId: string, food: FoodItem): Promise<void>
  addRecipeToRecent(userId: string, recipe: Recipe): Promise<void>
  clearRecent(userId: string): Promise<void>
  cleanupOldEntries(userId: string): Promise<void>
}

const MAX_RECENT_FOODS = 20
const CLEANUP_THRESHOLD = 50

export class RecentFoodsServiceImpl implements RecentFoodsService {
  private cache = new Map<string, RecentFoodEntry[]>()
  private recipeCache = new Map<string, RecentRecipeEntry[]>()
  private lastCleanup = new Map<string, number>()

  constructor(private recipeRepository: RecipeRepository) {}

  async getRecent(userId: string, limit: number = MAX_RECENT_FOODS): Promise<FoodItem[]> {
    try {
      let recentEntries = this.cache.get(userId)

      if (!recentEntries) {
        const dataStore = useDataStore.getState()
        recentEntries = await dataStore.getRecentFoods(userId)
        this.cache.set(userId, recentEntries)
      }

      // Sort by most recent, then by usage count
      const sortedEntries = recentEntries
        .sort((a, b) => {
          const timeDiff = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.usageCount - a.usageCount
        })
        .slice(0, limit)

      return sortedEntries.map(entry => entry.food)

    } catch (error) {
      logger.error('Failed to get recent foods', { userId, error })
      return []
    }
  }

  async addToRecent(userId: string, food: FoodItem): Promise<void> {
    try {
      const dataStore = useDataStore.getState()
      const now = new Date().toISOString()

      // Check if food already exists in recent
      let recentEntries = this.cache.get(userId) || await dataStore.getRecentFoods(userId)
      const existingIndex = recentEntries.findIndex(entry => entry.food.id === food.id)

      if (existingIndex >= 0) {
        // Update existing entry
        recentEntries[existingIndex] = {
          ...recentEntries[existingIndex],
          lastUsed: now,
          usageCount: recentEntries[existingIndex].usageCount + 1
        }
      } else {
        // Add new entry
        const newEntry: RecentFoodEntry = {
          food: {
            ...food,
            lastUsed: now,
            usageCount: (food.usageCount || 0) + 1
          },
          lastUsed: now,
          usageCount: 1,
          userId
        }
        recentEntries.unshift(newEntry)
      }

      // Limit to MAX_RECENT_FOODS
      if (recentEntries.length > MAX_RECENT_FOODS) {
        recentEntries = recentEntries.slice(0, MAX_RECENT_FOODS)
      }

      // Update cache and storage
      this.cache.set(userId, recentEntries)
      await dataStore.saveRecentFoods(userId, recentEntries)

      // Trigger cleanup if needed
      await this.conditionalCleanup(userId)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: food.id,
        source: 'recent_foods',
        cacheSize: recentEntries.length
      })

      logger.debug('Added food to recent foods', {
        userId,
        foodId: food.id,
        foodName: food.name,
        usageCount: recentEntries.find(e => e.food.id === food.id)?.usageCount
      })

    } catch (error) {
      logger.error('Failed to add food to recent', { userId, foodId: food.id, error })
      throw error
    }
  }

  async getRecentRecipes(userId: string, limit: number = MAX_RECENT_FOODS): Promise<Recipe[]> {
    try {
      let recentEntries = this.recipeCache.get(userId)

      if (!recentEntries) {
        const dataStore = useDataStore.getState()
        recentEntries = await dataStore.getRecentRecipes(userId)
        this.recipeCache.set(userId, recentEntries)
      }

      // Sort by most recent, then by usage count
      const sortedEntries = recentEntries
        .sort((a, b) => {
          const timeDiff = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.usageCount - a.usageCount
        })
        .slice(0, limit)

      return sortedEntries.map(entry => entry.recipe)

    } catch (error) {
      logger.error('Failed to get recent recipes', { userId, error })
      return []
    }
  }

  async getRecentAll(userId: string, limit: number = MAX_RECENT_FOODS): Promise<(FoodItem | Recipe)[]> {
    try {
      const foods = await this.getRecent(userId, MAX_RECENT_FOODS)
      const recipes = await this.getRecentRecipes(userId, MAX_RECENT_FOODS)

      // Combine and sort by last used
      const combined: Array<{ item: FoodItem | Recipe; lastUsed: string; usageCount: number }> = [
        ...foods.map(food => ({
          item: food,
          lastUsed: food.lastUsed || new Date().toISOString(),
          usageCount: food.usageCount || 0
        })),
        ...recipes.map(recipe => ({
          item: recipe,
          lastUsed: recipe.lastUsed || new Date().toISOString(),
          usageCount: recipe.usageCount || 0
        }))
      ]

      // Sort by most recent
      const sorted = combined
        .sort((a, b) => {
          const timeDiff = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.usageCount - a.usageCount
        })
        .slice(0, limit)

      return sorted.map(entry => entry.item)

    } catch (error) {
      logger.error('Failed to get all recent items', { userId, error })
      return []
    }
  }

  async addRecipeToRecent(userId: string, recipe: Recipe): Promise<void> {
    try {
      // Add to repository (handles upsert logic)
      await this.recipeRepository.addRecentRecipe(userId, recipe)

      // Clear cache to force reload on next get
      this.recipeCache.delete(userId)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: recipe.id,
        source: 'recent_recipes',
        cacheSize: 0 // Cache was cleared
      })

      logger.debug('Added recipe to recent recipes', {
        userId,
        recipeId: recipe.id,
        recipeName: recipe.name
      })

    } catch (error) {
      logger.error('Failed to add recipe to recent', { userId, recipeId: recipe.id, error })
      throw error
    }
  }

  async clearRecent(userId: string): Promise<void> {
    try {
      const dataStore = useDataStore.getState()

      this.cache.delete(userId)
      this.recipeCache.delete(userId)
      await dataStore.clearRecentFoods(userId)
      await dataStore.clearRecentRecipes(userId)

      logger.info('Cleared recent foods and recipes for user', { userId })

      eventBus.emit('food_data_cached', {
        foodId: 'all',
        source: 'recent_foods_cleared',
        cacheSize: 0
      })

    } catch (error) {
      logger.error('Failed to clear recent foods', { userId, error })
      throw error
    }
  }

  async cleanupOldEntries(userId: string): Promise<void> {
    try {
      const dataStore = useDataStore.getState()
      const recentEntries = await dataStore.getRecentFoods(userId)

      if (recentEntries.length <= MAX_RECENT_FOODS) {
        return // No cleanup needed
      }

      // Keep only the most recent MAX_RECENT_FOODS entries
      const sortedEntries = recentEntries
        .sort((a, b) => {
          const timeDiff = new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.usageCount - a.usageCount
        })
        .slice(0, MAX_RECENT_FOODS)

      // Update cache and storage
      this.cache.set(userId, sortedEntries)
      await dataStore.saveRecentFoods(userId, sortedEntries)

      const removedCount = recentEntries.length - sortedEntries.length

      logger.info('Cleaned up old recent food entries', {
        userId,
        removedCount,
        remainingCount: sortedEntries.length
      })

      this.lastCleanup.set(userId, Date.now())

    } catch (error) {
      logger.error('Failed to cleanup old recent entries', { userId, error })
    }
  }

  private async conditionalCleanup(userId: string): Promise<void> {
    const lastCleanupTime = this.lastCleanup.get(userId) || 0
    const timeSinceCleanup = Date.now() - lastCleanupTime
    const cacheSize = this.cache.get(userId)?.length || 0

    // Cleanup if we exceed threshold or haven't cleaned up in 1 hour
    if (cacheSize > CLEANUP_THRESHOLD || timeSinceCleanup > 3600000) {
      await this.cleanupOldEntries(userId)
    }
  }

  // Clear cache for memory management
  clearCache(): void {
    this.cache.clear()
    this.lastCleanup.clear()
    logger.debug('Recent foods cache cleared')
  }

  // Get cache stats for debugging
  getCacheStats(): { userCount: number; totalEntries: number } {
    let totalEntries = 0
    for (const entries of this.cache.values()) {
      totalEntries += entries.length
    }

    return {
      userCount: this.cache.size,
      totalEntries
    }
  }
}

// Singleton instance - will be initialized with repository in app setup
export let recentFoodsService: RecentFoodsService

export function initializeRecentFoodsService(repository: RecipeRepository): void {
  recentFoodsService = new RecentFoodsServiceImpl(repository)
}