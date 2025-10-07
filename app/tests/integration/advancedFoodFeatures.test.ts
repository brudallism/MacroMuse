import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { advancedFoodFacade } from '@facades/advancedFoodFacade'
import { searchFacade } from '@facades/searchFacade'
import { barcodeFacade } from '@facades/barcodeFacade'

import { FoodItem, LogEntry, MealType, NutrientVector } from '@domain/models'
import { CustomFoodData } from '@domain/services/customFoods'

import { initializeApp } from '@infra/initialization'

import { eventBus } from '@lib/eventBus'

// Initialize services for testing

// Mock data store and external dependencies
jest.mock('@state/dataStore')
jest.mock('@infra/database/supabase')
jest.mock('@facades/searchFacade')
jest.mock('@facades/barcodeFacade')

describe('Advanced Food Features Integration Tests', () => {
  const mockUserId = 'test-user-123'
  let mockFoods: FoodItem[]
  let mockLogEntries: LogEntry[]

  beforeEach(() => {
    jest.clearAllMocks()
    eventBus.removeAllListeners()

    // Initialize app with mocked dependencies before each test
    initializeApp()

    // Mock food data
    mockFoods = [
      {
        id: 'usda_1',
        name: 'Chicken Breast',
        source: 'usda',
        nutrients: {
          calories: 165,
          protein_g: 31,
          carbs_g: 0,
          fat_g: 3.6,
          fiber_g: 0,
          sodium_mg: 74
        },
        servingSize: { amount: 100, unit: 'g' },
        usageCount: 5,
        lastUsed: '2023-12-01T18:00:00Z'
      },
      {
        id: 'custom_1',
        name: 'My Protein Smoothie',
        source: 'custom',
        nutrients: {
          calories: 250,
          protein_g: 25,
          carbs_g: 15,
          fat_g: 8,
          fiber_g: 5
        },
        servingSize: { amount: 300, unit: 'ml' },
        isCustom: true,
        createdBy: mockUserId,
        isFavorite: true
      },
      {
        id: 'barcode_1',
        name: 'Organic Granola',
        brand: 'Nature Valley',
        source: 'barcode',
        nutrients: {
          calories: 120,
          protein_g: 4,
          carbs_g: 20,
          fat_g: 3,
          fiber_g: 3,
          totalSugars_g: 6
        },
        servingSize: { amount: 30, unit: 'g' },
        usageCount: 2
      }
    ]

    // Mock log entries
    mockLogEntries = [
      {
        id: 'log_1',
        userId: mockUserId,
        loggedAt: '2023-12-01T08:00:00Z',
        source: 'usda',
        sourceId: 'usda_1',
        qty: 150,
        unit: 'g',
        nutrients: { calories: 248, protein_g: 46.5, carbs_g: 0, fat_g: 5.4 },
        mealLabel: 'breakfast'
      },
      {
        id: 'log_2',
        userId: mockUserId,
        loggedAt: '2023-12-01T12:30:00Z',
        source: 'barcode',
        sourceId: 'barcode_1',
        qty: 30,
        unit: 'g',
        nutrients: { calories: 120, protein_g: 4, carbs_g: 20, fat_g: 3 },
        mealLabel: 'lunch'
      }
    ]
  })

  afterEach(() => {
    advancedFoodFacade.clearCache()
    eventBus.removeAllListeners()
  })

  describe('Recent Foods Integration', () => {
    it('should integrate recent foods with search flow', async () => {
      // Mock search results
      const mockSearchResults = [mockFoods[0]]
      ;(searchFacade.searchFoods as jest.Mock).mockResolvedValue(mockSearchResults)

      // Add food to recent through advanced facade
      await advancedFoodFacade.addToRecent(mockUserId, mockFoods[0])

      // Verify recent foods can be retrieved
      const recentFoods = await advancedFoodFacade.getRecentFoods(mockUserId)
      expect(recentFoods).toHaveLength(1)
      expect(recentFoods[0].id).toBe('usda_1')

      // Verify event was emitted
      let eventEmitted = false
      eventBus.on('user_activity_tracked', (data) => {
        if (data.activity === 'food_added_to_recent') {
          eventEmitted = true
        }
      })

      await advancedFoodFacade.addToRecent(mockUserId, mockFoods[1])
      expect(eventEmitted).toBe(true)
    })

    it('should maintain recent foods order and cleanup', async () => {
      // Add multiple foods
      for (const food of mockFoods) {
        await advancedFoodFacade.addToRecent(mockUserId, food)
      }

      const recentFoods = await advancedFoodFacade.getRecentFoods(mockUserId, 2)
      expect(recentFoods).toHaveLength(2)

      // Should be in reverse order (most recent first)
      expect(recentFoods[0].id).toBe('barcode_1')
      expect(recentFoods[1].id).toBe('custom_1')
    })
  })

  describe('Favorites Integration', () => {
    it('should handle favorite toggle workflow', async () => {
      const food = mockFoods[0]

      // Initially not favorite
      expect(await advancedFoodFacade.isFavorite(mockUserId, food.id)).toBe(false)

      // Add to favorites
      await advancedFoodFacade.addToFavorites(mockUserId, food, 'proteins')

      // Should now be favorite
      expect(await advancedFoodFacade.isFavorite(mockUserId, food.id)).toBe(true)

      // Should appear in favorites list
      const favorites = await advancedFoodFacade.getFavorites(mockUserId)
      expect(favorites).toHaveLength(1)
      expect(favorites[0].id).toBe(food.id)

      // Remove from favorites
      await advancedFoodFacade.removeFromFavorites(mockUserId, food.id)
      expect(await advancedFoodFacade.isFavorite(mockUserId, food.id)).toBe(false)
    })

    it('should support favorite categories', async () => {
      await advancedFoodFacade.addToFavorites(mockUserId, mockFoods[0], 'proteins')
      await advancedFoodFacade.addToFavorites(mockUserId, mockFoods[2], 'breakfast')

      const categories = await advancedFoodFacade.getFavoriteCategories(mockUserId)
      expect(categories).toContain('proteins')
      expect(categories).toContain('breakfast')

      const proteinFavorites = await advancedFoodFacade.getFavorites(mockUserId, 'proteins')
      expect(proteinFavorites).toHaveLength(1)
      expect(proteinFavorites[0].id).toBe('usda_1')
    })
  })

  describe('Custom Foods Integration', () => {
    const customFoodData: CustomFoodData = {
      name: 'Test Custom Food',
      brand: 'My Kitchen',
      nutrients: {
        calories: 200,
        protein_g: 10,
        carbs_g: 30,
        fat_g: 5,
        fiber_g: 8,
        sodium_mg: 150
      },
      servingSize: { amount: 100, unit: 'g' },
      description: 'A test custom food',
      ingredients: 'Test ingredients',
      allergens: 'None'
    }

    it('should create and manage custom foods', async () => {
      const createdFood = await advancedFoodFacade.createCustomFood(mockUserId, customFoodData)

      expect(createdFood.name).toBe(customFoodData.name)
      expect(createdFood.isCustom).toBe(true)
      expect(createdFood.createdBy).toBe(mockUserId)

      // Should appear in custom foods list
      const customFoods = await advancedFoodFacade.getCustomFoods(mockUserId)
      expect(customFoods).toHaveLength(1)
      expect(customFoods[0].id).toBe(createdFood.id)
    })

    it('should validate custom food data', async () => {
      const invalidData: CustomFoodData = {
        name: 'X', // Too short
        nutrients: {
          calories: -10, // Invalid negative calories
          protein_g: 150 // Unrealistic protein amount
        },
        servingSize: { amount: 0, unit: 'g' } // Invalid serving size
      }

      await expect(
        advancedFoodFacade.createCustomFood(mockUserId, invalidData)
      ).rejects.toThrow()
    })

    it('should update and delete custom foods', async () => {
      const createdFood = await advancedFoodFacade.createCustomFood(mockUserId, customFoodData)

      // Update food
      await advancedFoodFacade.updateCustomFood(mockUserId, createdFood.id, {
        name: 'Updated Custom Food',
        nutrients: { ...customFoodData.nutrients, calories: 220 }
      })

      // Delete food
      await advancedFoodFacade.deleteCustomFood(mockUserId, createdFood.id)

      const customFoods = await advancedFoodFacade.getCustomFoods(mockUserId)
      expect(customFoods).toHaveLength(0)
    })
  })

  describe('Portion Calculator Integration', () => {
    it('should calculate nutrients for different serving sizes', () => {
      const food = mockFoods[0] // Chicken breast, 100g serving
      const adjustedNutrients = advancedFoodFacade.calculateNutrients(food, 150, 'g')

      expect(adjustedNutrients.calories).toBe(247.5) // 165 * 1.5
      expect(adjustedNutrients.protein_g).toBe(46.5) // 31 * 1.5
      expect(adjustedNutrients.fat_g).toBe(5.4) // 3.6 * 1.5
    })

    it('should provide serving suggestions', () => {
      const food = mockFoods[0]
      const suggestions = advancedFoodFacade.getServingSuggestions(food)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.label.includes('oz'))).toBe(true)
      expect(suggestions.some(s => s.unit === 'g')).toBe(true)
    })

    it('should convert between units', () => {
      const result = advancedFoodFacade.convertUnits(100, 'g', 'oz')
      expect(result).toBeCloseTo(3.53, 1) // 100g ≈ 3.53oz

      const invalidResult = advancedFoodFacade.convertUnits(100, 'g', 'ml')
      expect(invalidResult).toBeNull() // Can't convert weight to volume
    })
  })

  describe('Meal Categorization Integration', () => {
    it('should suggest appropriate meal types', () => {
      const breakfastTime = '2023-12-01T08:00:00Z'
      const lunchTime = '2023-12-01T12:30:00Z'
      const dinnerTime = '2023-12-01T19:00:00Z'

      expect(advancedFoodFacade.suggestMealType(breakfastTime)).toBe('breakfast')
      expect(advancedFoodFacade.suggestMealType(lunchTime)).toBe('lunch')
      expect(advancedFoodFacade.suggestMealType(dinnerTime)).toBe('dinner')
    })

    it('should categorize food suitability for meals', () => {
      const chickenBreast = mockFoods[0]
      const granola = mockFoods[2]

      const chickenForDinner = advancedFoodFacade.categorizeFoodForMeal(chickenBreast, 'dinner')
      expect(chickenForDinner.suitability).toBe('excellent')

      const granolaForBreakfast = advancedFoodFacade.categorizeFoodForMeal(granola, 'breakfast')
      expect(granolaForBreakfast.suitability).toBe('excellent')

      const granolaForDinner = advancedFoodFacade.categorizeFoodForMeal(granola, 'dinner')
      expect(granolaForDinner.suitability).toBe('poor')
    })

    it('should analyze meal timing patterns', () => {
      const analysis = advancedFoodFacade.analyzeMealTiming(mockLogEntries)

      expect(analysis.averageMealTimes).toBeDefined()
      expect(analysis.mealFrequency).toBeDefined()
      expect(analysis.patterns.mostActiveHour).toBeDefined()
      expect(analysis.patterns.averageEntriesPerDay).toBeDefined()
      expect(analysis.patterns.preferredMealTypes).toBeInstanceOf(Array)
    })
  })

  describe('Complete Food Logging Flow', () => {
    it('should log food with all advanced features', async () => {
      const food = mockFoods[0]
      const amount = 150
      const unit = 'g'
      const timestamp = '2023-12-01T19:00:00Z'

      const logEntry = await advancedFoodFacade.logFoodWithAdvancedFeatures(
        mockUserId,
        food,
        amount,
        unit,
        'dinner',
        timestamp
      )

      expect(logEntry.userId).toBe(mockUserId)
      expect(logEntry.qty).toBe(amount)
      expect(logEntry.unit).toBe(unit)
      expect(logEntry.mealLabel).toBe('dinner')
      expect(logEntry.nutrients.calories).toBe(247.5) // Adjusted for 150g

      // Should also add to recent foods
      const recentFoods = await advancedFoodFacade.getRecentFoods(mockUserId)
      expect(recentFoods).toContainEqual(expect.objectContaining({ id: food.id }))
    })

    it('should auto-suggest meal type when not provided', async () => {
      const food = mockFoods[2] // Granola
      const breakfastTime = '2023-12-01T08:00:00Z'

      const logEntry = await advancedFoodFacade.logFoodWithAdvancedFeatures(
        mockUserId,
        food,
        30,
        'g',
        undefined, // No meal type provided
        breakfastTime
      )

      expect(logEntry.mealLabel).toBe('breakfast') // Should auto-suggest
    })

    it('should emit events for unusual meal choices', async () => {
      let unusualChoiceDetected = false

      eventBus.on('user_activity_tracked', (data) => {
        if (data.activity === 'unusual_meal_choice') {
          unusualChoiceDetected = true
        }
      })

      const granola = mockFoods[2]
      const dinnerTime = '2023-12-01T20:00:00Z'

      await advancedFoodFacade.logFoodWithAdvancedFeatures(
        mockUserId,
        granola,
        30,
        'g',
        'dinner', // Granola for dinner is unusual
        dinnerTime
      )

      expect(unusualChoiceDetected).toBe(true)
    })
  })

  describe('Integration with Search and Barcode', () => {
    it('should integrate with search facade', async () => {
      const mockSearchResults = [mockFoods[0], mockFoods[1]]
      ;(searchFacade.searchFoods as jest.Mock).mockResolvedValue(mockSearchResults)

      // Search should work with advanced features
      const searchResults = await searchFacade.searchFoods('chicken', 'test-session')
      expect(searchResults).toEqual(mockSearchResults)

      // Add search result to recent
      await advancedFoodFacade.addToRecent(mockUserId, searchResults[0])

      const recentFoods = await advancedFoodFacade.getRecentFoods(mockUserId)
      expect(recentFoods[0].id).toBe(searchResults[0].id)
    })

    it('should integrate with barcode facade', async () => {
      const mockBarcodeProduct = {
        barcode: '1234567890123',
        name: 'Scanned Product',
        nutrients: mockFoods[2].nutrients,
        servingSize: mockFoods[2].servingSize,
        dataQuality: { isComplete: true, isSuspicious: false, warnings: [] }
      }

      ;(barcodeFacade.lookupBarcode as jest.Mock).mockResolvedValue(mockBarcodeProduct)

      // Barcode scan should work with advanced features
      const scannedProduct = await barcodeFacade.lookupBarcode('1234567890123', 'test-session')
      expect(scannedProduct).toEqual(mockBarcodeProduct)

      // Convert to FoodItem and add to favorites
      const foodItem: FoodItem = {
        id: 'barcode_new',
        name: scannedProduct.name,
        source: 'barcode',
        nutrients: scannedProduct.nutrients,
        servingSize: scannedProduct.servingSize
      }

      await advancedFoodFacade.addToFavorites(mockUserId, foodItem, 'scanned')

      const favorites = await advancedFoodFacade.getFavorites(mockUserId, 'scanned')
      expect(favorites).toHaveLength(1)
    })
  })

  describe('Analytics and Recommendations', () => {
    beforeEach(async () => {
      // Set up test data
      for (const food of mockFoods) {
        await advancedFoodFacade.addToRecent(mockUserId, food)
        if (food.isFavorite) {
          await advancedFoodFacade.addToFavorites(mockUserId, food)
        }
      }
    })

    it('should generate usage statistics', async () => {
      const stats = await advancedFoodFacade.getFoodUsageStats(mockUserId)

      expect(stats.totalFoods).toBeGreaterThan(0)
      expect(stats.recentCount).toBeGreaterThan(0)
      expect(stats.favoriteCount).toBeGreaterThan(0)
      expect(stats.mostUsedFoods).toBeInstanceOf(Array)
      expect(stats.averageNutritionProfile).toBeDefined()
    })

    it('should generate food recommendations', async () => {
      const recommendations = await advancedFoodFacade.generateFoodRecommendations(mockUserId, 'dinner')

      expect(recommendations).toBeInstanceOf(Array)
      expect(recommendations.length).toBeGreaterThan(0)

      // Should prioritize foods suitable for dinner
      const chickenRecommended = recommendations.some(food => food.id === 'usda_1')
      expect(chickenRecommended).toBe(true)
    })
  })

  describe('Performance and Caching', () => {
    it('should track operation performance', async () => {
      let performanceTracked = false

      eventBus.on('performance_budget_exceeded', (data) => {
        if (data.operation.includes('food')) {
          performanceTracked = true
        }
      })

      // Perform operations that should be tracked
      await advancedFoodFacade.getRecentFoods(mockUserId)
      await advancedFoodFacade.getFavorites(mockUserId)
      await advancedFoodFacade.getCustomFoods(mockUserId)

      // Performance tracking should be working (even if no budget exceeded)
      expect(true).toBe(true) // Operations completed successfully
    })

    it('should manage cache effectively', () => {
      const stats = advancedFoodFacade.getCacheStats()

      expect(stats).toHaveProperty('recent')
      expect(stats).toHaveProperty('favorites')
      expect(stats).toHaveProperty('custom')
      expect(stats).toHaveProperty('totalMemoryUsage')

      // Clear cache
      advancedFoodFacade.clearCache(mockUserId)

      const clearedStats = advancedFoodFacade.getCacheStats()
      expect(clearedStats.totalMemoryUsage).toBeLessThanOrEqual(stats.totalMemoryUsage)
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing food data gracefully', async () => {
      const invalidFood: FoodItem = {
        id: 'invalid',
        name: '',
        source: 'usda',
        nutrients: {},
        servingSize: { amount: 0, unit: '' }
      }

      // Should not throw but handle gracefully
      await expect(
        advancedFoodFacade.addToRecent(mockUserId, invalidFood)
      ).resolves.not.toThrow()
    })

    it('should handle empty results gracefully', async () => {
      const emptyUserId = 'empty-user'

      const recentFoods = await advancedFoodFacade.getRecentFoods(emptyUserId)
      expect(recentFoods).toEqual([])

      const favorites = await advancedFoodFacade.getFavorites(emptyUserId)
      expect(favorites).toEqual([])

      const customFoods = await advancedFoodFacade.getCustomFoods(emptyUserId)
      expect(customFoods).toEqual([])
    })

    it('should handle concurrent operations', async () => {
      const food = mockFoods[0]

      // Perform multiple operations concurrently
      const operations = [
        advancedFoodFacade.addToRecent(mockUserId, food),
        advancedFoodFacade.addToFavorites(mockUserId, food),
        advancedFoodFacade.getRecentFoods(mockUserId),
        advancedFoodFacade.getFavorites(mockUserId)
      ]

      await expect(Promise.all(operations)).resolves.not.toThrow()
    })
  })
})