import { FoodSearchResult } from '@domain/models'
import { FoodOnlySearchService, createFoodOnlySearchService } from '@domain/services/foodOnlySearch'
import { RecipeOnlySearchService, createRecipeOnlySearchService } from '@domain/services/recipeOnlySearch'

import { useDataStore } from '@state/dataStore'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

interface SearchFacadeConfig {
  maxConcurrentSearches: number
  searchTimeout: number
}

const DEFAULT_CONFIG: SearchFacadeConfig = {
  maxConcurrentSearches: 3,
  searchTimeout: 800 // 800ms performance budget
}

export class SearchFacade {
  private foodSearchService: FoodOnlySearchService
  private recipeSearchService: RecipeOnlySearchService
  private activeSessions = new Map<string, AbortController>()

  constructor(private config: SearchFacadeConfig = DEFAULT_CONFIG) {
    this.foodSearchService = createFoodOnlySearchService()
    this.recipeSearchService = createRecipeOnlySearchService()

    // Listen to relevant events
    this.setupEventListeners()
  }

  async searchFoods(query: string, source: 'usda' | 'spoonacular' = 'usda', sessionId?: string): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    // Handle session management for concurrent searches
    if (sessionId) {
      this.cancelSession(sessionId)

      const controller = new AbortController()
      this.activeSessions.set(sessionId, controller)

      // Auto-cleanup after timeout
      setTimeout(() => {
        if (this.activeSessions.has(sessionId)) {
          this.cancelSession(sessionId)
        }
      }, this.config.searchTimeout + 1000)
    }

    try {
      const signal = sessionId ? this.activeSessions.get(sessionId)?.signal : undefined

      // Route to appropriate search service based on source
      const results = source === 'usda'
        ? await this.foodSearchService.search(query, signal)
        : await this.recipeSearchService.search(query, signal)

      // Update data store with search results
      const dataStore = useDataStore.getState()
      dataStore.setSearchResults(query, results)

      logger.info('Search facade completed successfully', {
        query,
        source,
        resultsCount: results.length,
        sessionId
      })

      return results
    } catch (error) {
      logger.error('Search facade failed', { query, source, sessionId, error })

      // Return empty results instead of throwing
      return []
    } finally {
      if (sessionId) {
        this.activeSessions.delete(sessionId)
      }
    }
  }

  searchWithDebounce(
    query: string,
    source: 'usda' | 'spoonacular' = 'usda',
    callback: (results: FoodSearchResult[]) => void,
    sessionId?: string
  ): void {
    // Cancel previous session if exists
    if (sessionId) {
      this.cancelSession(sessionId)
    }

    const searchService = source === 'usda' ? this.foodSearchService : this.recipeSearchService

    searchService.searchWithDebounce(query, (results) => {
      // Update data store
      const dataStore = useDataStore.getState()
      dataStore.setSearchResults(query, results)

      callback(results)
    })
  }

  async getFoodDetails(id: string, source: 'usda' | 'spoonacular'): Promise<any> {
    try {
      // NOTE: This method needs to be implemented properly in the search services
      // For now, return a placeholder that indicates the feature needs implementation
      logger.warn('getFoodDetails needs proper implementation in search services', { id, source })
      return null
    } catch (error) {
      logger.error('Food details fetch failed', { id, source, error })
      throw error
    }
  }

  cancelSession(sessionId: string): void {
    const controller = this.activeSessions.get(sessionId)
    if (controller) {
      controller.abort()
      this.activeSessions.delete(sessionId)
      logger.debug('Search session cancelled', { sessionId })
    }
  }

  cancelAllSessions(): void {
    for (const [sessionId, controller] of this.activeSessions.entries()) {
      controller.abort()
      logger.debug('Search session cancelled', { sessionId })
    }
    this.activeSessions.clear()
    this.foodSearchService.cancelPendingSearches()
    this.recipeSearchService.cancelPendingSearches()
  }

  getSearchStats(): {
    activeSessions: number
    foodStats: {
      cacheSize: number
      activeRequests: number
      pendingDebounces: number
    }
    recipeStats: {
      cacheSize: number
      activeRequests: number
      pendingDebounces: number
    }
  } {
    const foodStats = this.foodSearchService.getStats()
    const recipeStats = this.recipeSearchService.getStats()

    return {
      activeSessions: this.activeSessions.size,
      foodStats,
      recipeStats
    }
  }

  private setupEventListeners(): void {
    // Listen for performance budget exceeded events
    eventBus.on('performance_budget_exceeded', (data) => {
      if (data.operation === 'search') {
        logger.warn('Search performance budget exceeded', data)

        // Optionally emit notification to UI
        eventBus.emit('error_boundary_triggered', {
          error: `Search took ${data.actualMs}ms (budget: ${data.budgetMs}ms)`,
          componentStack: 'SearchFacade'
        })
      }
    })

    // Listen for search completion events for analytics
    eventBus.on('food_search_completed', (data) => {
      // Log search analytics
      logger.info('Search analytics', {
        query: data.query,
        resultsCount: data.results.length,
        source: data.source
      })
    })

    // Listen for cache events
    eventBus.on('food_data_cached', (data) => {
      logger.debug('Food data cached', {
        foodId: data.foodId,
        source: data.source
      })
    })
  }

  // Cleanup method for memory management
  cleanup(): void {
    this.cancelAllSessions()
    this.foodSearchService.cleanup()
    this.recipeSearchService.cleanup()
    logger.debug('SearchFacade cleaned up')
  }
}

// Singleton instance for app-wide use
export const searchFacade = new SearchFacade()

// Export factory function for testing
export function createSearchFacade(config?: Partial<SearchFacadeConfig>): SearchFacade {
  return new SearchFacade({ ...DEFAULT_CONFIG, ...config })
}