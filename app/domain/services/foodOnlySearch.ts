import { FoodSearchResult } from '@domain/models'

import { UsdaAdapter } from '@infra/adapters/usda'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

import { FoodDedupeService } from './foodDedupe'

interface FoodSearchConfig {
  maxResults: number
  timeoutMs: number
  debounceMs: number
}

interface CachedSearchResult {
  results: FoodSearchResult[]
  timestamp: number
  query: string
}

const DEFAULT_CONFIG: FoodSearchConfig = {
  maxResults: 25,
  timeoutMs: 800, // Full 800ms budget for USDA only
  debounceMs: 300
}

export class FoodOnlySearchService {
  private cache = new Map<string, CachedSearchResult>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private activeRequests = new Map<string, Promise<FoodSearchResult[]>>()
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private usdaAdapter: UsdaAdapter,
    private dedupeService: FoodDedupeService,
    private config: FoodSearchConfig = DEFAULT_CONFIG
  ) {}

  async search(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()

    // Check cache first
    const cached = this.getCachedResults(normalizedQuery)
    if (cached) {
      logger.debug('Returning cached food search results', { query: normalizedQuery })
      return cached
    }

    // Check for active request to prevent duplicate API calls
    const activeRequest = this.activeRequests.get(normalizedQuery)
    if (activeRequest) {
      logger.debug('Joining active food search request', { query: normalizedQuery })
      return activeRequest
    }

    // Create new search request
    const searchPromise = this.performFoodSearch(normalizedQuery, signal)
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
        logger.error('Debounced food search failed', { query: normalizedQuery, error })
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

    logger.debug('Cancelled all pending food searches')
  }

  private async performFoodSearch(query: string, signal?: AbortSignal): Promise<FoodSearchResult[]> {
    try {
      logger.debug('Searching USDA for foods', { query })

      const usdaResults = await this.withTimeout(
        this.usdaAdapter.search(query),
        this.config.timeoutMs,
        signal
      )

      if (usdaResults.length === 0) {
        logger.info('No food results found in USDA', { query })
        return []
      }

      // Deduplicate and enhance confidence scoring
      const deduplicated = await this.dedupeService.deduplicate(usdaResults)
      const enhanced = this.dedupeService.enhanceConfidenceScoring(deduplicated, query)

      // Sort by confidence and limit results
      const sorted = enhanced
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .slice(0, this.config.maxResults)

      eventBus.emit('food_search_completed', {
        query,
        results: sorted,
        source: 'usda_only'
      })

      logger.info('Food search completed', {
        query,
        resultsCount: sorted.length,
        source: 'usda'
      })

      return sorted
    } catch (error) {
      logger.error('Food search failed', { query, error })
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
        reject(new Error(`Food search timeout after ${timeoutMs}ms`))
      }, timeoutMs)

      signal?.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new Error('Food search aborted'))
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
    logger.debug('FoodOnlySearchService cleaned up')
  }
}

// Factory function following Foundation patterns
export function createFoodOnlySearchService(): FoodOnlySearchService {
  const usdaApiKey = process.env.EXPO_PUBLIC_USDA_API_KEY

  if (!usdaApiKey) {
    throw new Error('EXPO_PUBLIC_USDA_API_KEY environment variable is required')
  }

  return new FoodOnlySearchService(
    new UsdaAdapter(usdaApiKey),
    new FoodDedupeService()
  )
}