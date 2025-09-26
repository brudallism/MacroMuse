import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { SearchFacade, createSearchFacade } from '@facades/searchFacade'

import { FoodDedupeService } from '@domain/services/foodDedupe'
import { FoodSearchResult } from '@domain/models'

import { UsdaAdapter } from '@infra/adapters/usda'
import { SpoonacularAdapter } from '@infra/adapters/spoonacular'

import { eventBus } from '@lib/eventBus'
import { PERFORMANCE_BUDGETS } from '@lib/performance'

// Mock API keys for testing
const TEST_CONFIG = {
  usdaApiKey: 'test-usda-key',
  spoonacularApiKey: 'test-spoonacular-key'
}

// Mock fetch globally
global.fetch = jest.fn()

describe('Food Search Vertical Slice Integration', () => {
  let searchFacade: SearchFacade
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()

    searchFacade = createSearchFacade({
      maxConcurrentSearches: 3,
      searchTimeout: 800
    })

    // Mock successful USDA response
    const mockUsdaResponse = {
      foods: [
        {
          fdcId: 123456,
          description: 'Apple, raw',
          foodNutrients: [
            { nutrientId: 1008, value: 52 }, // calories
            { nutrientId: 1003, value: 0.3 }, // protein
            { nutrientId: 1005, value: 14 }, // carbs
            { nutrientId: 1004, value: 0.2 }, // fat
          ]
        }
      ]
    }

    // Mock successful Spoonacular response
    const mockSpoonacularResponse = {
      results: [
        {
          id: 654321,
          title: 'Apple Pie Recipe',
          readyInMinutes: 45,
          servings: 8,
          image: 'apple-pie.jpg'
        }
      ]
    }

    mockFetch
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockUsdaResponse)
      } as Response))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSpoonacularResponse)
      } as Response))
  })

  afterEach(() => {
    searchFacade.cleanup()
    jest.clearAllMocks()
    eventBus.removeAllListeners()
  })

  describe('Performance Requirements', () => {
    it('should complete search within 800ms performance budget', async () => {
      const startTime = performance.now()

      const results = await searchFacade.searchFoods('apple')

      const elapsed = performance.now() - startTime
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.search)
      expect(results).toBeDefined()
    }, 1000)

    it('should emit performance_budget_exceeded event when search exceeds budget', async () => {
      let budgetExceededEvent: any = null

      eventBus.on('performance_budget_exceeded', (data) => {
        budgetExceededEvent = data
      })

      // Mock slow response
      mockFetch.mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ foods: [] })
          } as Response), 900) // Exceed 800ms budget
        )
      )

      await searchFacade.searchFoods('slow query')

      // Allow event to be processed
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(budgetExceededEvent).not.toBeNull()
      expect(budgetExceededEvent.operation).toBe('search')
      expect(budgetExceededEvent.actualMs).toBeGreaterThan(PERFORMANCE_BUDGETS.search)
    }, 2000)
  })

  describe('API Adapters Integration', () => {
    it('should normalize USDA responses to NutrientVector format', async () => {
      const results = await searchFacade.searchFoods('apple')

      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        id: '123456',
        name: 'Apple, raw',
        source: 'usda',
        nutrients: {
          calories: 52,
          protein_g: 0.3,
          carbs_g: 14,
          fat_g: 0.2
        },
        confidence: expect.any(Number)
      })
    })

    it('should handle USDA API errors gracefully', async () => {
      mockFetch.mockImplementationOnce(() => Promise.resolve({
        ok: false,
        status: 429
      } as Response))

      const results = await searchFacade.searchFoods('rate limited query')

      // Should still return results (empty array) instead of throwing
      expect(results).toEqual([])
    })

    it('should prefer USDA results over Spoonacular for exact matches', async () => {
      // Setup mock responses for both APIs
      const mockUsdaResponse = {
        foods: [
          {
            fdcId: 111,
            description: 'chicken breast',
            foodNutrients: [
              { nutrientId: 1008, value: 165 },
              { nutrientId: 1003, value: 31 }
            ]
          }
        ]
      }

      const mockSpoonacularResponse = {
        results: [
          {
            id: 222,
            title: 'chicken breast',
            readyInMinutes: 20,
            servings: 4
          }
        ]
      }

      mockFetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsdaResponse)
        } as Response))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSpoonacularResponse)
        } as Response))

      const results = await searchFacade.searchFoods('chicken breast')

      // USDA result should have higher confidence for exact match
      const usdaResult = results.find(r => r.source === 'usda')
      expect(usdaResult).toBeDefined()
      expect(usdaResult?.confidence).toBeGreaterThan(0.9)
    })
  })

  describe('Fallback Chain Implementation', () => {
    it('should fallback to Spoonacular when USDA fails', async () => {
      // Mock USDA failure
      mockFetch
        .mockImplementationOnce(() => Promise.reject(new Error('USDA API down')))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            results: [
              {
                id: 999,
                title: 'Backup Recipe',
                readyInMinutes: 30,
                servings: 4
              }
            ]
          })
        } as Response))

      const results = await searchFacade.searchFoods('backup query')

      expect(results).toHaveLength(1)
      expect(results[0].source).toBe('spoonacular')
    })

    it('should return cached results when both APIs fail', async () => {
      // First, populate cache with a successful search
      await searchFacade.searchFoods('apple')

      // Clear mock and make both APIs fail
      mockFetch.mockClear()
      mockFetch
        .mockImplementation(() => Promise.reject(new Error('All APIs down')))

      // Search for similar query that should hit cache fallback
      const results = await searchFacade.searchFoods('apple fruit')

      // Should return cached results
      expect(results).toBeDefined()
    })
  })

  describe('Caching Layer', () => {
    it('should cache successful API responses for 5 minutes', async () => {
      // First search
      const results1 = await searchFacade.searchFoods('apple')
      expect(mockFetch).toHaveBeenCalledTimes(2) // USDA + Spoonacular

      // Second search within cache TTL
      mockFetch.mockClear()
      const results2 = await searchFacade.searchFoods('apple')
      expect(mockFetch).not.toHaveBeenCalled() // Should use cache
      expect(results2).toEqual(results1)
    })

    it('should invalidate cache after 5 minutes', async () => {
      // Mock timer
      jest.useFakeTimers()

      await searchFacade.searchFoods('apple')
      mockFetch.mockClear()

      // Fast forward 5 minutes + 1 second
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000)

      await searchFacade.searchFoods('apple')
      expect(mockFetch).toHaveBeenCalled() // Should hit API again

      jest.useRealTimers()
    })
  })

  describe('Deduplication Service', () => {
    it('should deduplicate similar foods from different sources', async () => {
      const mockUsdaResponse = {
        foods: [
          {
            fdcId: 1,
            description: 'Apple, raw',
            foodNutrients: [{ nutrientId: 1008, value: 52 }]
          }
        ]
      }

      const mockSpoonacularResponse = {
        results: [
          {
            id: 2,
            title: 'Apple raw',
            readyInMinutes: 0,
            servings: 1
          }
        ]
      }

      mockFetch
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsdaResponse)
        } as Response))
        .mockImplementationOnce(() => Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSpoonacularResponse)
        } as Response))

      const results = await searchFacade.searchFoods('apple')

      // Should deduplicate and prefer USDA
      expect(results).toHaveLength(1)
      expect(results[0].source).toBe('usda')
    })
  })

  describe('Debouncing', () => {
    it('should debounce search requests with 300ms delay', async () => {
      jest.useFakeTimers()

      let callbackCount = 0
      const callback = jest.fn(() => callbackCount++)

      // Make multiple rapid searches
      searchFacade.searchWithDebounce('a', callback)
      searchFacade.searchWithDebounce('ap', callback)
      searchFacade.searchWithDebounce('app', callback)
      searchFacade.searchWithDebounce('appl', callback)
      searchFacade.searchWithDebounce('apple', callback)

      // Fast forward less than debounce time
      jest.advanceTimersByTime(200)
      expect(callback).not.toHaveBeenCalled()

      // Fast forward past debounce time
      jest.advanceTimersByTime(200)

      // Allow async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(callback).toHaveBeenCalledTimes(1)

      jest.useRealTimers()
    })

    it('should cancel previous requests on new searches', async () => {
      const sessionId = 'test-session'

      // Start first search
      const promise1 = searchFacade.searchFoods('first query', sessionId)

      // Start second search with same session (should cancel first)
      const promise2 = searchFacade.searchFoods('second query', sessionId)

      const results = await promise2
      expect(results).toBeDefined()

      // First promise should be cancelled
      await expect(promise1).rejects.toThrow('Operation was aborted')
    })
  })

  describe('Event Bus Integration', () => {
    it('should emit food_search_completed event', async () => {
      let searchCompletedEvent: any = null

      eventBus.on('food_search_completed', (data) => {
        searchCompletedEvent = data
      })

      await searchFacade.searchFoods('test query')

      expect(searchCompletedEvent).toMatchObject({
        query: 'test query',
        results: expect.any(Array),
        source: expect.any(String)
      })
    })

    it('should emit food_data_cached event when caching data', async () => {
      let cachedEvent: any = null

      eventBus.on('food_data_cached', (data) => {
        cachedEvent = data
      })

      await searchFacade.searchFoods('cache test')

      expect(cachedEvent).toMatchObject({
        foodId: expect.any(String),
        source: expect.any(String)
      })
    })
  })
})

describe('UsdaAdapter Unit Tests', () => {
  let adapter: UsdaAdapter

  beforeEach(() => {
    adapter = new UsdaAdapter('test-key')
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()
  })

  it('should calculate confidence scores correctly', async () => {
    const mockResponse = {
      foods: [
        { fdcId: 1, description: 'Apple, raw', foodNutrients: [] },
        { fdcId: 2, description: 'Apple juice', foodNutrients: [] },
        { fdcId: 3, description: 'Pineapple', foodNutrients: [] }
      ]
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    } as Response)

    const results = await adapter.search('apple')

    // Exact match should have highest confidence
    expect(results[0].confidence).toBeGreaterThan(0.9)
    expect(results[0].name).toBe('Apple, raw')

    // Partial match should have lower confidence
    expect(results[1].confidence).toBeLessThan(results[0].confidence!)
  })
})

describe('FoodDedupeService Unit Tests', () => {
  let dedupeService: FoodDedupeService

  beforeEach(() => {
    dedupeService = new FoodDedupeService()
  })

  it('should merge similar foods and prefer USDA source', async () => {
    const foods: FoodSearchResult[] = [
      {
        id: '1',
        name: 'Apple, raw',
        source: 'usda',
        nutrients: { calories: 52 },
        servingSize: { amount: 100, unit: 'g' },
        confidence: 0.95
      },
      {
        id: '2',
        name: 'Apple raw',
        source: 'spoonacular',
        nutrients: { calories: 50 },
        servingSize: { amount: 1, unit: 'servings' },
        confidence: 0.85
      }
    ]

    const deduplicated = await dedupeService.deduplicate(foods)

    expect(deduplicated).toHaveLength(1)
    expect(deduplicated[0].source).toBe('usda')
    expect(deduplicated[0].id).toBe('1')
  })
})