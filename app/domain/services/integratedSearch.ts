import { FoodSearchResult } from '@domain/models'

import { UsdaAdapter } from '@infra/adapters/usda'
import { SpoonacularAdapter } from '@infra/adapters/spoonacular'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'
import { trackOperation } from '@lib/performance'

import { FoodSearchService } from './foodSearch'
import { FoodDedupeService } from './foodDedupe'

interface IntegratedSearchConfig {
  usdaApiKey: string
  spoonacularApiKey: string
  enableCaching: boolean
  enablePerformanceTracking: boolean
}

export class IntegratedFoodSearchService {
  private usdaAdapter: UsdaAdapter
  private spoonacularAdapter: SpoonacularAdapter
  private dedupeService: FoodDedupeService
  private searchService: FoodSearchService
  private cache = new Map<string, { data: unknown; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private config: IntegratedSearchConfig) {
    this.usdaAdapter = new UsdaAdapter(config.usdaApiKey)
    this.spoonacularAdapter = new SpoonacularAdapter(config.spoonacularApiKey)
    this.dedupeService = new FoodDedupeService()
    this.searchService = new FoodSearchService(
      this.usdaAdapter,
      this.spoonacularAdapter,
      this.dedupeService
    )
  }

  async search(query: string, signal?: any): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    // Check cache if enabled
    if (this.config.enableCaching) {
      const cached = this.getCachedData(normalizedQuery)
      if (cached) {
        logger.debug('Returning cached integrated search results', { query: normalizedQuery })
        return cached
      }
    }

    // Perform search with performance tracking
    const searchWithTracking = this.config.enablePerformanceTracking
      ? (): Promise<FoodSearchResult[]> => trackOperation('search', () => this.searchService.search(normalizedQuery, signal))
      : (): Promise<FoodSearchResult[]> => this.searchService.search(normalizedQuery, signal)

    try {
      const results = await searchWithTracking()

      // Cache results if enabled
      if (this.config.enableCaching) {
        this.setCachedData(normalizedQuery, results)
      }

      // Emit integrated search completion event
      eventBus.emit('food_search_completed', {
        query: normalizedQuery,
        results,
        source: 'integrated_search'
      })

      logger.info('Integrated food search completed', {
        query: normalizedQuery,
        resultsCount: results.length,
        sources: [...new Set(results.map(r => r.source))]
      })

      return results
    } catch (error) {
      logger.error('Integrated food search failed', { query: normalizedQuery, error })

      // Emit error event
      eventBus.emit('error_boundary_triggered', {
        error: error instanceof Error ? error.message : 'Unknown search error',
        componentStack: 'IntegratedFoodSearchService.search'
      })

      throw error
    }
  }

  searchWithDebounce(
    query: string,
    callback: (results: FoodSearchResult[]) => void
  ): void {
    this.searchService.searchWithDebounce(query, callback)
  }

  cancelPendingSearches(): void {
    this.searchService.cancelPendingSearches()
  }

  async getFood(id: string, source: 'usda' | 'spoonacular'): Promise<unknown> {
    const cacheKey = `food:${source}:${id}`

    if (this.config.enableCaching) {
      const cached = this.getCachedData(cacheKey)
      if (cached) {
        return cached
      }
    }

    try {
      let result: unknown

      if (source === 'usda') {
        result = await this.usdaAdapter.getFood(id)
      } else if (source === 'spoonacular') {
        result = await this.spoonacularAdapter.getRecipe(id)
      } else {
        throw new Error(`Unsupported source: ${source}`)
      }

      if (this.config.enableCaching) {
        this.setCachedData(cacheKey, result)
      }

      return result
    } catch (error) {
      logger.error('Food fetch failed', { id, source, error })
      throw error
    }
  }

  private getCachedData(key: string): unknown | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCachedData(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })

    // Emit cache event for performance monitoring
    eventBus.emit('food_data_cached', {
      foodId: key,
      source: 'integrated_search',
      nutrients: {} // Not applicable for all cache types
    })
  }

  getSearchStats(): {
    cacheSize: number
    cacheHitRate: number
    activeRequests: number
    pendingDebounces: number
  } {
    const searchStats = this.searchService.getStats()

    return {
      cacheSize: this.cache.size + searchStats.cacheSize,
      cacheHitRate: 0, // TODO: Implement cache hit rate tracking
      activeRequests: searchStats.activeRequests,
      pendingDebounces: searchStats.pendingDebounces
    }
  }

  // Cleanup method to prevent memory leaks
  cleanup(): void {
    this.cache.clear()
    this.cancelPendingSearches()
    logger.debug('IntegratedFoodSearchService cleaned up')
  }
}

// Factory function to create the service with environment variables
export function createIntegratedSearchService(): IntegratedFoodSearchService {
  const usdaApiKey = process.env.EXPO_PUBLIC_USDA_API_KEY
  const spoonacularApiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY

  if (!usdaApiKey) {
    throw new Error('EXPO_PUBLIC_USDA_API_KEY environment variable is required')
  }

  if (!spoonacularApiKey) {
    throw new Error('EXPO_PUBLIC_SPOONACULAR_API_KEY environment variable is required')
  }

  return new IntegratedFoodSearchService({
    usdaApiKey,
    spoonacularApiKey,
    enableCaching: true,
    enablePerformanceTracking: false // Temporarily disabled to reduce errors
  })
}