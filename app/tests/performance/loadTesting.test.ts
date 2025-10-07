import { performance } from 'perf_hooks'

import { PERFORMANCE_BUDGETS } from '../../lib/performance'
import { searchFacade } from '../../facades/SearchFacade'
import { analyticsService } from '../../domain/services/analytics'
import { ledgerService } from '../../domain/services/ledger'
import { recipeService } from '../../domain/services/recipes'
import { planService } from '../../domain/services/plans'
import { recipeRepository } from '../../infra/database/recipeRepository'
import { generateHeavyUserTestData, generateRecipeTestData, generateLogEntry } from '../fixtures/testDataGenerator'

describe('Performance Under Realistic Load - Day 14 Final Testing', () => {
  const TEST_USER_ID = 'test-user-performance'
  const TODAY = new Date().toISOString().split('T')[0]
  const WEEK_START = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  beforeEach(async () => {
    // Clear performance marks
    performance.clearMarks()
    performance.clearMeasures()

    // Reset any test data
    await cleanupTestData()
  })

  afterEach(async () => {
    await cleanupTestData()
  })

  describe('Food Search Performance Under Load', () => {
    it('should handle large food database queries efficiently', async () => {
      const testQueries = [
        'chicken breast', 'brown rice', 'green apple', 'fresh broccoli',
        'atlantic salmon', 'whole wheat pasta', 'greek yogurt',
        'whole grain bread', 'cheddar cheese', 'ripe banana',
        'baby spinach', 'organic eggs', 'steel cut oats', 'almond milk',
        'quinoa cooked', 'sweet potato', 'avocado fresh', 'lean ground beef',
        'black beans', 'olive oil extra virgin'
      ]

      const queryTimes: number[] = []
      const resultCounts: number[] = []

      for (const query of testQueries) {
        const startTime = performance.now()

        try {
          const results = await searchFacade.search(query)

          const elapsed = performance.now() - startTime
          queryTimes.push(elapsed)
          resultCounts.push(results.length)

          // Individual query must meet performance budget
          expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.search)
          expect(results.length).toBeGreaterThan(0)

          // Verify results are properly normalized
          expect(results[0]).toHaveProperty('nutrients')
          expect(results[0].nutrients).toHaveProperty('calories')

        } catch (error) {
          fail(`Search failed for query "${query}": ${error.message}`)
        }
      }

      // Performance analytics
      const averageTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length
      const maxTime = Math.max(...queryTimes)
      const minTime = Math.min(...queryTimes)
      const averageResults = resultCounts.reduce((a, b) => a + b, 0) / resultCounts.length

      console.log(`Search Performance Summary:`)
      console.log(`  Average time: ${averageTime.toFixed(2)}ms`)
      console.log(`  Max time: ${maxTime.toFixed(2)}ms`)
      console.log(`  Min time: ${minTime.toFixed(2)}ms`)
      console.log(`  Average results: ${averageResults.toFixed(1)}`)

      // Overall performance requirements
      expect(averageTime).toBeLessThan(PERFORMANCE_BUDGETS.search * 0.8) // 20% buffer
      expect(maxTime).toBeLessThan(PERFORMANCE_BUDGETS.search * 1.2) // Allow 20% variance
      expect(averageResults).toBeGreaterThan(5) // Should return meaningful results
    })

    it('should handle concurrent search requests efficiently', async () => {
      const concurrentQueries = [
        'chicken', 'rice', 'apple', 'broccoli', 'salmon',
        'pasta', 'yogurt', 'bread', 'cheese', 'banana'
      ]

      const startTime = performance.now()

      // Execute all searches concurrently
      const searchPromises = concurrentQueries.map(query =>
        searchFacade.search(query)
      )

      const results = await Promise.all(searchPromises)
      const totalElapsed = performance.now() - startTime

      // Concurrent execution should be faster than sequential
      const sequentialEstimate = concurrentQueries.length * PERFORMANCE_BUDGETS.search
      expect(totalElapsed).toBeLessThan(sequentialEstimate * 0.6) // Should be significantly faster

      // All searches should succeed
      results.forEach((result, index) => {
        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('nutrients')
      })

      console.log(`Concurrent Search Performance:`)
      console.log(`  ${concurrentQueries.length} concurrent searches: ${totalElapsed.toFixed(2)}ms`)
      console.log(`  Average per search: ${(totalElapsed / concurrentQueries.length).toFixed(2)}ms`)
    })
  })

  describe('Analytics Performance Under Load', () => {
    it('should handle analytics rollup for heavy users', async () => {
      // Generate realistic heavy user data: 90 days, 4 meals per day
      const heavyUserData = await generateHeavyUserTestData(TEST_USER_ID, 90)

      console.log(`Generated test data: ${heavyUserData.logEntries.length} log entries over 90 days`)

      // Test daily rollup performance
      const dailyStart = performance.now()

      await analyticsService.rollup({
        userId: TEST_USER_ID,
        start: heavyUserData.startDate,
        end: heavyUserData.endDate
      })

      const dailyElapsed = performance.now() - dailyStart
      expect(dailyElapsed).toBeLessThan(PERFORMANCE_BUDGETS.analyticsRollup)

      console.log(`Daily rollup performance: ${dailyElapsed.toFixed(2)}ms`)

      // Test trend analysis performance
      const trendsStart = performance.now()

      const trends = await analyticsService.trends({
        userId: TEST_USER_ID,
        start: heavyUserData.startDate,
        end: heavyUserData.endDate
      }, ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'])

      const trendsElapsed = performance.now() - trendsStart
      expect(trendsElapsed).toBeLessThan(1500) // 1.5 second budget for trend analysis

      // Verify trend data quality
      expect(trends).toBeDefined()
      expect(trends.calories).toBeDefined()
      expect(trends.calories.dataPoints).toHaveLength(90)

      console.log(`Trend analysis performance: ${trendsElapsed.toFixed(2)}ms`)
    })

    it('should handle insights generation efficiently', async () => {
      // Generate user data with some intentional nutritional gaps
      const userData = await generateHeavyUserTestData(TEST_USER_ID, 30, {
        lowIron: true,
        highSodium: true,
        inconsistentCalories: true
      })

      const insightsStart = performance.now()

      const insights = await analyticsService.generateInsights({
        userId: TEST_USER_ID,
        start: userData.startDate,
        end: userData.endDate
      })

      const insightsElapsed = performance.now() - insightsStart
      expect(insightsElapsed).toBeLessThan(2000) // 2 second budget for insights

      // Verify insights quality
      expect(insights.length).toBeGreaterThan(0)
      expect(insights.some(i => i.key.includes('iron'))).toBe(true)
      expect(insights.some(i => i.key.includes('sodium'))).toBe(true)

      console.log(`Insights generation: ${insightsElapsed.toFixed(2)}ms, ${insights.length} insights`)
    })
  })

  describe('Recipe Management Performance', () => {
    it('should maintain performance with large recipe collections', async () => {
      // Generate realistic recipe collection
      const recipeCollection = await generateRecipeTestData(TEST_USER_ID, 50)

      console.log(`Generated ${recipeCollection.length} test recipes`)

      // Test recipe listing performance
      const listStart = performance.now()

      const recipes = await recipeRepository.getUserRecipes(TEST_USER_ID)

      const listElapsed = performance.now() - listStart
      expect(listElapsed).toBeLessThan(800) // Recipe listing budget

      expect(recipes.length).toBeGreaterThanOrEqual(45) // Account for generation variance

      console.log(`Recipe listing performance: ${listElapsed.toFixed(2)}ms for ${recipes.length} recipes`)

      // Test recipe nutrition calculation performance
      const complexRecipes = recipes.filter(r => r.ingredients.length > 8)
      expect(complexRecipes.length).toBeGreaterThan(0)

      const nutritionTimes: number[] = []

      for (const recipe of complexRecipes.slice(0, 5)) { // Test first 5 complex recipes
        const calcStart = performance.now()

        const nutrition = await recipeService.computeNutrients(recipe.id)

        const calcElapsed = performance.now() - calcStart
        nutritionTimes.push(calcElapsed)

        expect(calcElapsed).toBeLessThan(PERFORMANCE_BUDGETS.recipeNutritionCalculation || 1000)
        expect(nutrition.calories).toBeGreaterThan(0)
      }

      const avgNutritionTime = nutritionTimes.reduce((a, b) => a + b, 0) / nutritionTimes.length
      console.log(`Recipe nutrition calculation average: ${avgNutritionTime.toFixed(2)}ms`)
    })

    it('should handle recipe scaling efficiently', async () => {
      const testRecipe = await createTestRecipe(TEST_USER_ID, 'Performance Test Recipe')

      const scalingFactors = [0.5, 1.5, 2, 3, 4, 0.25]
      const scalingTimes: number[] = []

      for (const factor of scalingFactors) {
        const scaleStart = performance.now()

        await recipeService.scale(testRecipe.id, factor)
        const scaledNutrition = await recipeService.computeNutrients(testRecipe.id)

        const scaleElapsed = performance.now() - scaleStart
        scalingTimes.push(scaleElapsed)

        expect(scaleElapsed).toBeLessThan(500) // 500ms budget for scaling
        expect(scaledNutrition.calories).toBeGreaterThan(0)
      }

      const avgScalingTime = scalingTimes.reduce((a, b) => a + b, 0) / scalingTimes.length
      console.log(`Recipe scaling average: ${avgScalingTime.toFixed(2)}ms`)
    })
  })

  describe('Concurrent Operations Performance', () => {
    it('should handle realistic concurrent user operations', async () => {
      // Simulate realistic concurrent operations a user might perform
      const concurrentOperations = [
        () => searchFacade.search('chicken breast'),
        () => ledgerService.add(generateLogEntry(TEST_USER_ID, 'brown rice')),
        () => analyticsService.getDailyTotals(TEST_USER_ID, TODAY),
        () => recipeService.computeNutrients('test-recipe-complex'),
        () => planService.getWeeklyPlan(TEST_USER_ID, WEEK_START),
        () => searchFacade.getRecentFoods(TEST_USER_ID),
        () => searchFacade.getFavorites(TEST_USER_ID)
      ]

      const startTime = performance.now()

      // Execute all operations concurrently
      const results = await Promise.all(
        concurrentOperations.map(async (op, index) => {
          try {
            return await op()
          } catch (error) {
            console.warn(`Concurrent operation ${index} failed: ${error.message}`)
            return null
          }
        })
      )

      const totalElapsed = performance.now() - startTime

      // Should complete concurrent operations within budget
      expect(totalElapsed).toBeLessThan(3000) // 3 second budget for concurrent ops

      // Verify operations that should succeed did succeed
      const successfulResults = results.filter(result => result !== null)
      expect(successfulResults.length).toBeGreaterThanOrEqual(5) // Most should succeed

      console.log(`Concurrent operations performance:`)
      console.log(`  ${concurrentOperations.length} operations: ${totalElapsed.toFixed(2)}ms`)
      console.log(`  ${successfulResults.length} successful operations`)
    })
  })

  describe('Memory Management Under Load', () => {
    it('should not leak memory during extended usage simulation', async () => {
      const initialMemory = getMemoryUsage()

      // Simulate 30 minutes of heavy usage
      for (let i = 0; i < 100; i++) {
        // Alternate between different types of operations
        if (i % 4 === 0) {
          await searchFacade.search(`test query ${i}`)
        } else if (i % 4 === 1) {
          await ledgerService.add(generateLogEntry(TEST_USER_ID, `food ${i}`))
        } else if (i % 4 === 2) {
          await analyticsService.getDailyTotals(TEST_USER_ID, TODAY)
        } else {
          await recipeService.computeNutrients('test-recipe-simple')
        }

        // Force garbage collection every 25 iterations if available
        if (i % 25 === 0 && global.gc) {
          global.gc()
        }
      }

      const finalMemory = getMemoryUsage()
      const memoryIncrease = finalMemory - initialMemory

      console.log(`Memory usage:`)
      console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Final: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`)
      console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('Database Performance Under Load', () => {
    it('should handle high-volume database operations efficiently', async () => {
      const batchSize = 50
      const logEntries = Array.from({ length: batchSize }, (_, i) =>
        generateLogEntry(TEST_USER_ID, `batch-food-${i}`)
      )

      // Test batch insert performance
      const batchStart = performance.now()

      for (const entry of logEntries) {
        await ledgerService.add(entry)
      }

      const batchElapsed = performance.now() - batchStart
      const avgPerEntry = batchElapsed / batchSize

      expect(avgPerEntry).toBeLessThan(100) // Average 100ms per entry

      console.log(`Batch insert performance:`)
      console.log(`  ${batchSize} entries: ${batchElapsed.toFixed(2)}ms`)
      console.log(`  Average per entry: ${avgPerEntry.toFixed(2)}ms`)

      // Test query performance with large dataset
      const queryStart = performance.now()

      const dailyTotals = await analyticsService.getDailyTotals(TEST_USER_ID, TODAY)

      const queryElapsed = performance.now() - queryStart
      expect(queryElapsed).toBeLessThan(500) // 500ms budget for daily totals query

      expect(dailyTotals.calories).toBeGreaterThan(0)

      console.log(`Daily totals query: ${queryElapsed.toFixed(2)}ms`)
    })
  })
})

// Helper functions
function getMemoryUsage(): number {
  if ((performance as any).memory?.usedJSHeapSize) {
    return (performance as any).memory.usedJSHeapSize
  }

  if (process.memoryUsage) {
    return process.memoryUsage().heapUsed
  }

  return 0
}

async function cleanupTestData(): Promise<void> {
  // Clean up test data to prevent interference between tests
  try {
    // Implementation would depend on your specific database setup
    // This is a placeholder for actual cleanup logic
  } catch (error) {
    console.warn('Test cleanup failed:', error.message)
  }
}

async function createTestRecipe(userId: string, name: string): Promise<any> {
  return await recipeService.create({
    userId,
    name,
    description: 'Test recipe for performance testing',
    servings: 2,
    ingredients: [
      { foodId: 'test-chicken', amount: 200, unit: 'g' },
      { foodId: 'test-rice', amount: 100, unit: 'g' },
      { foodId: 'test-broccoli', amount: 150, unit: 'g' }
    ],
    instructions: 'Test instructions',
    cookTime: 30,
    prepTime: 15
  })
}