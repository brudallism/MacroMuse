import { FoodItem, RecentFoodEntry } from '@domain/models'
import { useDataStore } from '@state/dataStore'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface RecentFoodsService {
  getRecent(userId: string, limit?: number): Promise<FoodItem[]>
  addToRecent(userId: string, food: FoodItem): Promise<void>
  clearRecent(userId: string): Promise<void>
  cleanupOldEntries(userId: string): Promise<void>
}

const MAX_RECENT_FOODS = 20
const CLEANUP_THRESHOLD = 50

export class RecentFoodsServiceImpl implements RecentFoodsService {
  private cache = new Map<string, RecentFoodEntry[]>()
  private lastCleanup = new Map<string, number>()

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

  async clearRecent(userId: string): Promise<void> {
    try {
      const dataStore = useDataStore.getState()

      this.cache.delete(userId)
      await dataStore.clearRecentFoods(userId)

      logger.info('Cleared recent foods for user', { userId })

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

// Singleton instance
export const recentFoodsService = new RecentFoodsServiceImpl()