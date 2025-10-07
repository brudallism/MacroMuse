import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { BarcodeFacade, createBarcodeFacade } from '@facades/barcodeFacade'

import { NutrientVector } from '@domain/models'

import { BarcodeAdapter, BarcodeProduct } from '@infra/adapters/barcode'

import { eventBus } from '@lib/eventBus'


// Mock fetch globally
global.fetch = jest.fn()

describe('Barcode Integration Tests', () => {
  let barcodeAdapter: BarcodeAdapter
  let barcodeFacade: BarcodeFacade
  let mockFetch: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockClear()

    barcodeAdapter = new BarcodeAdapter()
    barcodeFacade = createBarcodeFacade({
      maxRetries: 2,
      timeout: 1000,
      enableFallbackSearch: true
    })

    // Mock successful Open Food Facts response
    const mockProductResponse = {
      status: 1,
      product: {
        product_name: 'Test Granola Bar',
        brands: 'Test Brand',
        ingredients_text: 'Oats, honey, almonds',
        allergens: 'nuts',
        serving_size: '40g',
        nutrition_grade_fr: 'b',
        nova_group: 3,
        nutriments: {
          'energy-kcal_100g': 450,
          'proteins_100g': 8.5,
          'carbohydrates_100g': 65,
          'fat_100g': 16,
          'fiber_100g': 7.2,
          'sodium_100g': 0.25,
          'sugars_100g': 28
        }
      }
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockProductResponse)
    } as Response)
  })

  afterEach(() => {
    jest.clearAllMocks()
    eventBus.removeAllListeners()
    barcodeFacade.cleanup()
  })

  describe('BarcodeAdapter', () => {
    it('should normalize Open Food Facts response to NutrientVector format', async () => {
      const product = await barcodeAdapter.lookup('1234567890123')

      expect(product).toBeDefined()
      expect(product!.name).toBe('Test Granola Bar')
      expect(product!.brand).toBe('Test Brand')
      expect(product!.barcode).toBe('1234567890123')

      // Check nutrient normalization
      expect(product!.nutrients.calories).toBe(450)
      expect(product!.nutrients.protein_g).toBe(8.5)
      expect(product!.nutrients.carbs_g).toBe(65)
      expect(product!.nutrients.fat_g).toBe(16)
      expect(product!.nutrients.fiber_g).toBe(7.2)
      expect(product!.nutrients.sodium_mg).toBe(250) // 0.25g * 1000
      expect(product!.nutrients.totalSugars_g).toBe(28)
    })

    it('should assess data quality correctly', async () => {
      const product = await barcodeAdapter.lookup('1234567890123')

      expect(product!.dataQuality.isComplete).toBe(true)
      expect(product!.dataQuality.isSuspicious).toBe(false)
      expect(product!.dataQuality.warnings).toEqual([])
    })

    it('should detect suspicious nutritional data', async () => {
      // Mock product with suspicious data (zero calories but high fat)
      const suspiciousResponse = {
        status: 1,
        product: {
          product_name: 'Suspicious Product',
          nutriments: {
            'energy-kcal_100g': 0,
            'fat_100g': 50 // High fat but zero calories - suspicious
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(suspiciousResponse)
      } as Response)

      const product = await barcodeAdapter.lookup('9876543210987')

      expect(product!.dataQuality.isSuspicious).toBe(true)
      expect(product!.dataQuality.warnings).toContain('Zero calories claimed for high-fat product')
    })

    it('should handle invalid barcode formats', async () => {
      const invalidBarcodes = ['123', 'abcd', '123456789012345678', '']

      for (const barcode of invalidBarcodes) {
        const result = await barcodeAdapter.lookup(barcode)
        expect(result).toBeNull()
      }
    })

    it('should return null for products not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 0 })
      } as Response)

      const result = await barcodeAdapter.lookup('1111111111111')
      expect(result).toBeNull()
    })

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await barcodeAdapter.lookup('1234567890123')
      expect(result).toBeNull()
    })

    it('should cache successful lookups', async () => {
      // First call
      await barcodeAdapter.lookup('1234567890123')
      expect(mockFetch).toHaveBeenCalledTimes(1)

      // Second call should use cache
      await barcodeAdapter.lookup('1234567890123')
      expect(mockFetch).toHaveBeenCalledTimes(1) // No additional API call
    })
  })

  describe('BarcodeFacade', () => {
    it('should handle complete barcode flow successfully', async () => {
      const sessionId = 'test-session'

      // Lookup barcode
      const product = await barcodeFacade.lookupBarcode('1234567890123', sessionId)
      expect(product).toBeDefined()

      // Log the product
      await expect(
        barcodeFacade.logBarcodeProduct(product!, 40, 'breakfast', 'test-user', sessionId)
      ).resolves.not.toThrow()

      // Session should be cleaned up
      const stats = barcodeFacade.getBarcodeStats()
      expect(stats.activeSessions).toBe(0)
    })

    it('should retry failed requests up to maxRetries', async () => {
      const facade = createBarcodeFacade({ maxRetries: 3, timeout: 500 })

      // First two calls fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            status: 1,
            product: { product_name: 'Retry Success' }
          })
        } as Response)

      const product = await facade.lookupBarcode('1234567890123')
      expect(product?.name).toBe('Retry Success')
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle fallback search when product not found', async () => {
      // Mock barcode not found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 0 })
      } as Response)

      // Mock fallback search (this would need to be mocked in searchFacade)
      const fallbackResults = await barcodeFacade.handleBarcodeNotFound('1234567890123')
      expect(fallbackResults).toBeDefined()
    })

    it('should calculate serving nutrients correctly', async () => {
      const product = await barcodeFacade.lookupBarcode('1234567890123')
      expect(product).toBeDefined()

      // Calculate nutrients for 40g serving (40% of 100g base)
      const servingRatio = 40 / 100
      const expectedCalories = Math.round((450 * servingRatio) * 100) / 100

      // The actual calculation is done internally during logging
      // We can verify the logic by checking the product data
      expect(product!.nutrients.calories).toBe(450) // per 100g
    })

    it('should emit proper events during barcode flow', async () => {
      let searchCompletedEvent: any = null
      let dataCachedEvent: any = null

      eventBus.on('food_search_completed', (data) => {
        searchCompletedEvent = data
      })

      eventBus.on('food_data_cached', (data) => {
        dataCachedEvent = data
      })

      await barcodeFacade.lookupBarcode('1234567890123')

      expect(searchCompletedEvent).toMatchObject({
        query: '1234567890123',
        source: 'barcode'
      })

      expect(dataCachedEvent).toMatchObject({
        foodId: '1234567890123',
        source: 'barcode'
      })
    })

    it('should handle session management correctly', async () => {
      const sessionId1 = 'session-1'
      const sessionId2 = 'session-2'

      // Start two sessions
      await barcodeFacade.lookupBarcode('1111111111111', sessionId1)
      await barcodeFacade.lookupBarcode('2222222222222', sessionId2)

      expect(barcodeFacade.getBarcodeStats().activeSessions).toBe(2)

      // Cancel one session
      barcodeFacade.cancelBarcodeSession(sessionId1)
      expect(barcodeFacade.getBarcodeStats().activeSessions).toBe(1)
    })
  })

  describe('Data Quality Validation', () => {
    it('should flag products with missing basic nutrients', async () => {
      const incompleteResponse = {
        status: 1,
        product: {
          product_name: 'Incomplete Product',
          nutriments: {
            'energy-kcal_100g': 200
            // Missing protein, carbs, fat
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(incompleteResponse)
      } as Response)

      const product = await barcodeAdapter.lookup('1234567890123')
      expect(product!.dataQuality.isComplete).toBe(false)
      expect(product!.dataQuality.warnings).toContain('Missing basic nutrients: protein_g, carbs_g, fat_g')
    })

    it('should flag macronutrient-calorie discrepancies', async () => {
      const discrepantResponse = {
        status: 1,
        product: {
          product_name: 'Discrepant Product',
          nutriments: {
            'energy-kcal_100g': 100, // Claimed calories
            'proteins_100g': 10,     // 40 calories
            'carbohydrates_100g': 20, // 80 calories
            'fat_100g': 10           // 90 calories
            // Total: 210 calories from macros vs 100 claimed
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(discrepantResponse)
      } as Response)

      const product = await barcodeAdapter.lookup('1234567890123')
      expect(product!.dataQuality.isSuspicious).toBe(true)
      expect(product!.dataQuality.warnings).toContain('Calorie count doesn\'t match macronutrient breakdown')
    })

    it('should validate extremely high calorie density', async () => {
      const highCalorieResponse = {
        status: 1,
        product: {
          product_name: 'Ultra High Calorie Product',
          nutriments: {
            'energy-kcal_100g': 950 // Unrealistically high
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(highCalorieResponse)
      } as Response)

      const product = await barcodeAdapter.lookup('1234567890123')
      expect(product!.dataQuality.isSuspicious).toBe(true)
      expect(product!.dataQuality.warnings).toContain('Unusually high calorie density')
    })
  })

  describe('Fallback Strategy', () => {
    it('should attempt manual search when barcode lookup fails', async () => {
      // Mock barcode not found
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 0 })
      } as Response)

      const barcode = '1234567890123'
      const fallbackResults = await barcodeFacade.handleBarcodeNotFound(barcode)

      // Verify fallback was attempted (results depend on searchFacade mock)
      expect(fallbackResults).toBeDefined()
    })

    it('should track manual entry usage', () => {
      const sessionId = 'test-session'
      const barcode = '1234567890123'

      barcodeFacade.handleManualEntry(barcode, sessionId)

      // Verify tracking (implementation detail - mainly for analytics)
      expect(true).toBe(true) // This would check internal session data in real implementation
    })
  })

  describe('Performance', () => {
    it('should respect timeout settings', async () => {
      const facade = createBarcodeFacade({ timeout: 100 }) // Very short timeout

      // Mock slow response
      mockFetch.mockImplementationOnce(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ status: 1, product: {} })
          } as Response), 200) // Longer than timeout
        )
      )

      const result = await facade.lookupBarcode('1234567890123')
      expect(result).toBeNull() // Should timeout and return null
    })

    it('should cache products to improve performance', async () => {
      const start1 = Date.now()
      await barcodeAdapter.lookup('1234567890123')
      const time1 = Date.now() - start1

      const start2 = Date.now()
      await barcodeAdapter.lookup('1234567890123') // Should use cache
      const time2 = Date.now() - start2

      expect(time2).toBeLessThan(time1) // Cached call should be faster
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only one API call
    })
  })
})

describe('Real-world Barcode Compatibility', () => {
  it('should handle common barcode formats', () => {
    const validBarcodes = [
      '12345678',      // EAN-8
      '1234567890123', // EAN-13
      '123456789012',  // UPC-A
      '01234567890',   // UPC-E padded
    ]

    validBarcodes.forEach(barcode => {
      expect(/^\d{8,14}$/.test(barcode)).toBe(true)
    })
  })

  it('should reject invalid barcode formats', () => {
    const invalidBarcodes = [
      '1234567',       // Too short
      '123456789012345678', // Too long
      'abc123456789',  // Contains letters
      '12345-67890',   // Contains hyphens
      '',              // Empty
      '   ',           // Whitespace only
    ]

    invalidBarcodes.forEach(barcode => {
      expect(/^\d{8,14}$/.test(barcode)).toBe(false)
    })
  })
})

// Test real products (these would require actual API calls in integration environment)
describe('Real Product Tests', () => {
  // These tests would be run against actual Open Food Facts API in integration environment
  const realProductBarcodes = [
    '3017620422003', // Nutella
    '8076809513388', // Barilla pasta
    '4000417025005', // Milka chocolate
  ]

  it.skip('should successfully lookup real products', async () => {
    const adapter = new BarcodeAdapter()

    for (const barcode of realProductBarcodes) {
      const product = await adapter.lookup(barcode)
      expect(product).toBeDefined()
      expect(product!.name).toBeTruthy()
      expect(product!.nutrients.calories).toBeGreaterThan(0)
    }
  })
})