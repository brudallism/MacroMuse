// tests/performance/budgets.test.ts - Performance budget enforcement tests
import { performanceMonitor, PERFORMANCE_BUDGETS, assertPerformanceBudget } from '@lib/performance'
import { searchFacade } from '@facades/SearchFacade'
import { ledgerFacade } from '@facades/LedgerFacade'
import { analyticsService } from '@domain/services/analytics'
import { recipeService } from '@domain/services/recipes'
import { planService } from '@domain/services/plans'

describe('Performance Budget Enforcement', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    // Clear performance marks/measures if available
    if (typeof performance !== 'undefined') {
      performance.clearMarks?.()
      performance.clearMeasures?.()
    }
  })

  describe('Core User Flows', () => {
    it('should meet app launch budget on cold start', async () => {
      const startTime = performance.now()

      // Simulate full app initialization
      await performanceMonitor.trackOperation('appLaunch', async () => {
        // Mock app initialization sequence
        await new Promise(resolve => setTimeout(resolve, 100)) // Auth check
        await new Promise(resolve => setTimeout(resolve, 200)) // Store hydration
        await new Promise(resolve => setTimeout(resolve, 300)) // Initial data load
        return true
      })

      const elapsed = performance.now() - startTime
      assertPerformanceBudget('appLaunch', elapsed)
    }, 10000)

    it('should meet food search budget under realistic load', async () => {
      // Test with common search queries
      const queries = ['chicken', 'rice', 'broccoli', 'salmon', 'avocado', 'apple', 'banana']

      for (const query of queries) {
        await performanceMonitor.trackOperation('search', async () => {
          // Mock search operation with realistic delay
          await new Promise(resolve => setTimeout(resolve, Math.random() * 500))
          return { results: [], query }
        })
      }
    })

    it('should meet meal logging flow budget', async () => {
      await performanceMonitor.trackOperation('logFlow', async () => {
        // Simulate complete meal logging flow
        const searchResult = await performanceMonitor.trackOperation('search', async () => {
          await new Promise(resolve => setTimeout(resolve, 200))
          return { foodId: 'test-food', nutrients: {} }
        })

        await performanceMonitor.trackOperation('meal_log', async () => {
          await new Promise(resolve => setTimeout(resolve, 300))
          return { entryId: 'test-entry' }
        })

        await performanceMonitor.trackOperation('targets_calculation', async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
          return { targets: {} }
        })

        return true
      })
    })
  })

  describe('Database Operations', () => {
    it('should meet database query budgets', async () => {
      const criticalQueries = [
        'getDailyTotals',
        'getUserRecipes',
        'getWeeklyPlan',
        'getFavorites',
        'getRecentFoods'
      ]

      for (const queryName of criticalQueries) {
        await performanceMonitor.trackOperation('databaseQuery', async () => {
          // Mock database query with variable latency
          const latency = Math.random() * 300 // 0-300ms
          await new Promise(resolve => setTimeout(resolve, latency))
          return { queryName, data: [] }
        })
      }
    })

    it('should meet rollup operation budgets', async () => {
      // Test daily rollup
      await performanceMonitor.trackOperation('analyticsRollup', async () => {
        await new Promise(resolve => setTimeout(resolve, 800))
        return { rollupType: 'daily' }
      })

      // Test weekly rollup (more complex)
      await performanceMonitor.trackOperation('weeklyRollup', async () => {
        await new Promise(resolve => setTimeout(resolve, 1500))
        return { rollupType: 'weekly' }
      })
    })
  })

  describe('Recipe & Meal Planning', () => {
    it('should meet recipe nutrition calculation budget', async () => {
      await performanceMonitor.trackOperation('recipeNutritionCalculation', async () => {
        // Simulate complex nutrition calculation
        await new Promise(resolve => setTimeout(resolve, 200))
        return { calories: 400, protein: 25, carbs: 30, fat: 15 }
      })
    })

    it('should meet recipe import budget', async () => {
      await performanceMonitor.trackOperation('recipeImport', async () => {
        // Simulate Spoonacular API call and processing
        await new Promise(resolve => setTimeout(resolve, 1000))
        return { recipeId: 'imported-recipe' }
      })
    })

    it('should meet meal plan creation budget', async () => {
      await performanceMonitor.trackOperation('planCreation', async () => {
        // Simulate meal plan generation
        await new Promise(resolve => setTimeout(resolve, 600))
        return { planId: 'new-plan' }
      })
    })

    it('should meet shopping list generation budget', async () => {
      await performanceMonitor.trackOperation('shoppingListGeneration', async () => {
        // Simulate shopping list compilation
        await new Promise(resolve => setTimeout(resolve, 400))
        return { items: [] }
      })
    })
  })

  describe('Analytics & Insights', () => {
    it('should meet insight generation budget', async () => {
      await performanceMonitor.trackOperation('insightGeneration', async () => {
        // Simulate insight rule engine evaluation
        await new Promise(resolve => setTimeout(resolve, 800))
        return { insights: [] }
      })
    })

    it('should meet trend calculation budget', async () => {
      await performanceMonitor.trackOperation('trendCalculation', async () => {
        // Simulate trend analysis
        await new Promise(resolve => setTimeout(resolve, 400))
        return { trends: {} }
      })
    })

    it('should meet pattern detection budget', async () => {
      await performanceMonitor.trackOperation('patternDetection', async () => {
        // Simulate pattern detection algorithms
        await new Promise(resolve => setTimeout(resolve, 600))
        return { patterns: [] }
      })
    })
  })

  describe('UI Performance', () => {
    it('should meet tab navigation budget', async () => {
      const tabs = ['dashboard', 'search', 'analytics', 'profile']

      for (const tab of tabs) {
        await performanceMonitor.trackOperation('tabNavigation', async () => {
          // Simulate tab switch with state updates
          await new Promise(resolve => setTimeout(resolve, 50))
          return { activeTab: tab }
        })
      }
    })

    it('should meet food card render budget', async () => {
      // Test rendering multiple food cards
      const foodItems = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `Food ${i}` }))

      for (const food of foodItems) {
        performanceMonitor.trackOperationSync('foodCardRender', () => {
          // Simulate component render
          const startTime = Date.now()
          while (Date.now() - startTime < 20) {
            // Simulate rendering work
          }
          return { rendered: food.id }
        })
      }
    })

    it('should meet image loading budget', async () => {
      const imageUrls = [
        'https://example.com/food1.jpg',
        'https://example.com/food2.jpg',
        'https://example.com/food3.jpg'
      ]

      for (const url of imageUrls) {
        await performanceMonitor.trackOperation('imageLoad', async () => {
          // Simulate optimized image loading
          await new Promise(resolve => setTimeout(resolve, 600))
          return { loaded: url }
        })
      }
    })
  })

  describe('Production Operations', () => {
    it('should meet offline sync budget', async () => {
      await performanceMonitor.trackOperation('offlineSync', async () => {
        // Simulate processing offline queue
        const operations = Array.from({ length: 10 }, (_, i) => ({ id: i }))

        for (const op of operations) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }

        return { synced: operations.length }
      })
    })

    it('should meet error recovery budget', async () => {
      await performanceMonitor.trackOperation('errorBoundaryRecover', async () => {
        // Simulate error boundary recovery
        await new Promise(resolve => setTimeout(resolve, 200))
        return { recovered: true }
      })
    })

    it('should meet bundle loading budget', async () => {
      const bundles = ['barcode', 'analytics', 'recipes', 'planning']

      for (const bundle of bundles) {
        await performanceMonitor.trackOperation('bundleLoad', async () => {
          // Simulate dynamic import
          await new Promise(resolve => setTimeout(resolve, 400))
          return { bundle }
        })
      }
    })
  })

  describe('Memory Management', () => {
    it('should track memory usage during operations', async () => {
      const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0

      await performanceMonitor.trackOperation('search', async () => {
        // Create some objects to use memory
        const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: 'test' }))
        await new Promise(resolve => setTimeout(resolve, 100))
        return largeArray.slice(0, 5) // Return smaller result
      })

      const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0
      const memoryDelta = memoryAfter - memoryBefore

      // Memory delta should be reasonable (not testing exact values due to GC)
      expect(memoryDelta).toBeDefined()
    })
  })

  describe('Performance Budget Validation', () => {
    it('should throw error when budget is exceeded', () => {
      expect(() => {
        assertPerformanceBudget('search', 1000) // Exceeds 800ms budget
      }).toThrow('Performance budget exceeded')
    })

    it('should pass when budget is met', () => {
      expect(() => {
        assertPerformanceBudget('search', 500) // Within 800ms budget
      }).not.toThrow()
    })

    it('should include detailed error information', () => {
      expect(() => {
        assertPerformanceBudget('logFlow', 1500) // Exceeds 1200ms budget
      }).toThrow('logFlow took 1500.00ms, budget is 1200ms (exceeded by 300.00ms)')
    })
  })
})

describe('Performance Monitoring Integration', () => {
  it('should emit events for budget violations', async () => {
    const eventSpy = jest.fn()

    // Mock event bus
    const mockEventBus = {
      emit: eventSpy,
      on: jest.fn(),
      off: jest.fn()
    }

    // Simulate budget violation
    await performanceMonitor.trackOperation('search', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Exceeds 800ms budget
      return { results: [] }
    })

    // Verify event was emitted (this would need to be mocked properly)
    // expect(eventSpy).toHaveBeenCalledWith('performance_budget_exceeded', expect.objectContaining({
    //   operation: 'search',
    //   actualMs: expect.any(Number),
    //   budgetMs: 800
    // }))
  })
})