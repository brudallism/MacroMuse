import { FoodSearchResult } from '@domain/models'

import { SpoonacularAdapter } from '@infra/adapters/spoonacular'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

import { FoodDedupeService } from './foodDedupe'

interface RecipeSearchConfig {
  maxResults: number
  timeoutMs: number
  debounceMs: number
}

interface CachedSearchResult {
  results: FoodSearchResult[]
  timestamp: number
  query: string
}

const DEFAULT_CONFIG: RecipeSearchConfig = {
  maxResults: 25,
  timeoutMs: 800, // Full 800ms budget for Spoonacular only
  debounceMs: 300
}

export class RecipeOnlySearchService {
  private cache = new Map<string, CachedSearchResult>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private activeRequests = new Map<string, Promise<FoodSearchResult[]>>()
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private spoonacularAdapter: SpoonacularAdapter,
    private dedupeService: FoodDedupeService,
    private config: RecipeSearchConfig = DEFAULT_CONFIG
  ) {}

  async search(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    // Check cache first
    const cached = this.getCachedResults(normalizedQuery)
    if (cached) {
      logger.debug('Returning cached recipe search results', { query: normalizedQuery })
      return cached
    }

    // Check for active request to prevent duplicate API calls
    const activeRequest = this.activeRequests.get(normalizedQuery)
    if (activeRequest) {
      logger.debug('Joining active recipe search request', { query: normalizedQuery })
      return activeRequest
    }

    // Create new search request
    const searchPromise = this.performRecipeSearch(normalizedQuery, signal)
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
        logger.error('Debounced recipe search failed', { query: normalizedQuery, error })
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

    logger.debug('Cancelled all pending recipe searches')
  }

  private async performRecipeSearch(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
    try {
      logger.debug('Searching Spoonacular for recipes', { query })

      const spoonacularResults = await this.withTimeout(
        this.spoonacularAdapter.searchRecipes(query),
        this.config.timeoutMs,
        signal
      )

      if (spoonacularResults.length === 0) {
        logger.info('No recipe results found in Spoonacular', { query })
        return []
      }

      // Convert RecipeSearchResult to FoodSearchResult
      const convertedResults: FoodSearchResult[] = spoonacularResults.map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        source: 'spoonacular' as const,
        nutrients: recipe.nutrients || {}, // Will be populated when recipe is fetched
        servingSize: {
          amount: recipe.servings || 1,
          unit: 'servings'
        },
        confidence: recipe.confidence || 0.7 // Default confidence for recipes
      }))

      // Deduplicate and enhance confidence scoring
      const deduplicated = await this.dedupeService.deduplicate(convertedResults)
      const enhanced = this.dedupeService.enhanceConfidenceScoring(deduplicated, query)

      // Sort by confidence and limit results
      const sorted = enhanced
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, this.config.maxResults)

      eventBus.emit('food_search_completed', {
        query,
        results: sorted,
        source: 'spoonacular_only'
      })

      logger.info('Recipe search completed', {
        query,
        resultsCount: sorted.length,
        source: 'spoonacular'
      })

      return sorted
    } catch (error) {
      logger.error('Recipe search failed', { query, error })
      throw error
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Recipe search timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      signal?.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Recipe search aborted'))
      })
    })

    return Promise.race([promise, timeoutPromise])
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
      results,
      timestamp: Date.now(),
      query
    })
  }

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

  // Cleanup method to prevent memory leaks
  cleanup(): void {
    this.cache.clear()
    this.cancelPendingSearches()
    logger.debug('RecipeOnlySearchService cleaned up')
  }
}

// Factory function following Foundation patterns
export function createRecipeOnlySearchService(): RecipeOnlySearchService {
  const spoonacularApiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY

  if (!spoonacularApiKey) {
    throw new Error('EXPO_PUBLIC_SPOONACULAR_API_KEY environment variable is required')
  }

  return new RecipeOnlySearchService(
    new SpoonacularAdapter(spoonacularApiKey),
    new FoodDedupeService()
  )
}