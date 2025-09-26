import { FoodSearchResult } from '@domain/models'

import { UsdaAdapter } from '@infra/adapters/usda'
import { SpoonacularAdapter } from '@infra/adapters/spoonacular'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'
import { trackOperation } from '@lib/performance'

import { FoodDedupeService } from './foodDedupe'

interface SearchConfig {
  maxResults: number
  timeoutMs: number
  enableFallback: boolean
  debounceMs: number
}

interface CachedSearchResult {
  results: FoodSearchResult[]
  timestamp: number
  query: string
}

const DEFAULT_CONFIG: SearchConfig = {
  maxResults: 50,
  timeoutMs: 800, // Must complete within 800ms performance budget
  enableFallback: true,
  debounceMs: 300
}

export class FoodSearchService {
  private cache = new Map<string, CachedSearchResult>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private activeRequests = new Map<string, Promise<FoodSearchResult[]>>()
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private usdaAdapter: UsdaAdapter,
    private spoonacularAdapter: SpoonacularAdapter,
    private dedupeService: FoodDedupeService,
    private config: SearchConfig = DEFAULT_CONFIG
  ) {}

  async search(query: string, signal?: any): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    // Check cache first
    const cached = this.getCachedResults(normalizedQuery)
    if (cached) {
      logger.debug('Returning cached search results', { query: normalizedQuery })
      return cached
    }

    // Check for active request to prevent duplicate API calls
    const activeRequest = this.activeRequests.get(normalizedQuery)
    if (activeRequest) {
      logger.debug('Joining active search request', { query: normalizedQuery })
      return activeRequest
    }

    // Create new search request
    const searchPromise = this.performSearch(normalizedQuery, signal)
    this.activeRequests.set(normalizedQuery, searchPromise)

    try {
      const results = await searchPromise
      this.setCachedResults(normalizedQuery, results)
      return results
    } finally {
      this.activeRequests.delete(normalizedQuery)
    }
  }

  searchWithDebounce(query: string, callback: (results: FoodSearchResult[]) => void): void {
    const normalizedQuery = query.trim().toLowerCase()

    // Clear existing timer for this query
    const existingTimer = this.debounceTimers.get(normalizedQuery)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(async () => {
      try {
        const results = await this.search(normalizedQuery)
        callback(results)
      } catch (error) {
        logger.error('Debounced search failed', { query: normalizedQuery, error })
        callback([])
      } finally {
        this.debounceTimers.delete(normalizedQuery)
      }
    }, this.config.debounceMs)

    this.debounceTimers.set(normalizedQuery, timer)
  }

  cancelPendingSearches(): void {
    // Cancel all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Note: Active requests will be cancelled by AbortSignal if provided
    logger.debug('Cancelled all pending searches')
  }

  private async performSearch(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
    return trackOperation('search', async () => {
      try {
        const results = await this.searchWithFallback(query, signal)
        const deduplicated = await this.dedupeService.deduplicate(results)
        const enhanced = this.dedupeService.enhanceConfidenceScoring(deduplicated, query)

        // Sort by confidence and limit results
        const sorted = enhanced
          .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
          .slice(0, this.config.maxResults)

        eventBus.emit('food_search_completed', {
          query,
          results: sorted,
          source: 'search_service'
        })

        return sorted
      } catch (error) {
        logger.error('Food search failed', { query, error })
        throw error
      }
    })
  }

  private async searchWithFallback(query: string, signal?: any): Promise<FoodSearchResult[]> {
    const allResults: FoodSearchResult[] = []

    try {
      // Primary source: USDA for whole foods
      logger.debug('Searching USDA', { query })
      const usdaResults = await this.withTimeout(
        this.usdaAdapter.search(query),
        this.config.timeoutMs / 2, // Give USDA half the budget
        signal
      )

      if (usdaResults.length > 0) {
        allResults.push(...usdaResults)
        logger.debug('USDA search completed', { query, count: usdaResults.length })
      }
    } catch (error) {
      logger.warn('USDA search failed, continuing with fallback', { query, error })
    }

    if (this.config.enableFallback) {
      try {
        // Fallback: Spoonacular for recipes
        logger.debug('Searching Spoonacular', { query })
        const spoonacularResults = await this.withTimeout(
          this.spoonacularAdapter.searchRecipes(query),
          this.config.timeoutMs / 2, // Give Spoonacular remaining budget
          signal
        )

        if (spoonacularResults.length > 0) {
          // Convert RecipeSearchResult to FoodSearchResult
          const convertedResults: FoodSearchResult[] = spoonacularResults.map(recipe => ({
            id: recipe.id,
            name: recipe.name,
            source: 'spoonacular' as const,
            nutrients: {}, // Will be populated when recipe is fetched
            servingSize: {
              amount: recipe.servings,
              unit: 'servings'
            },
            confidence: recipe.confidence || 0
          }))

          allResults.push(...convertedResults)
          logger.debug('Spoonacular search completed', { query, count: convertedResults.length })
        }
      } catch (error) {
        logger.warn('Spoonacular search failed', { query, error })
      }

      // Additional fallback: Check cache for previous searches
      const cachedFallback = this.searchCacheForSimilar(query)
      if (cachedFallback.length > 0) {
        allResults.push(...cachedFallback)
        logger.debug('Cache fallback found results', { query, count: cachedFallback.length })
      }
    }

    return allResults
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: any
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const cleanup = (): void => clearTimeout(timer)

      if (signal) {
        signal.addEventListener('abort', () => {
          cleanup()
          reject(new Error('Operation was aborted'))
        })
      }

      promise
        .then(result => {
          cleanup()
          resolve(result)
        })
        .catch(error => {
          cleanup()
          reject(error)
        })
    })
  }

  private searchCacheForSimilar(query: string): FoodSearchResult[] {
    const normalizedQuery = query.toLowerCase()
    const results: FoodSearchResult[] = []

    for (const [cachedQuery, cached] of this.cache.entries()) {
      // Check if cached query is similar
      if (this.isQuerySimilar(normalizedQuery, cachedQuery)) {
        // Filter cached results to match current query
        const matchingResults = cached.results.filter(result =>
          result.name.toLowerCase().includes(normalizedQuery) ||
          normalizedQuery.includes(result.name.toLowerCase())
        )
        results.push(...matchingResults)
      }
    }

    return results
  }

  private isQuerySimilar(query1: string, query2: string): boolean {
    // Simple similarity check - can be enhanced
    const words1 = new Set(query1.split(/\s+/))
    const words2 = new Set(query2.split(/\s+/))
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size >= 0.5 // 50% similarity threshold
  }

  private getCachedResults(query: string): FoodSearchResult[] | null {
    const cached = this.cache.get(query)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(query)
      return null
    }

    return cached.results
  }

  private setCachedResults(query: string, results: FoodSearchResult[]): void {
    this.cache.set(query, {
      query,
      results,
      timestamp: Date.now()
    })

    // Emit cache event
    eventBus.emit('food_data_cached', {
      foodId: `search:${query}`,
      source: 'search_service',
      nutrients: {} // Not applicable for search cache
    })
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
      }
    }
  }

  // Get search statistics for monitoring
  getStats(): {
    cacheSize: number
    activeRequests: number
    pendingDebounces: number
  } {
    return {
      cacheSize: this.cache.size,
      activeRequests: this.activeRequests.size,
      pendingDebounces: this.debounceTimers.size
    }
  }
}