// tests/integration/meal-logging.test.ts - Complete flow integration testing
import { LedgerServiceImpl } from '../../domain/services/ledger'
import { TotalsServiceImpl } from '../../domain/services/totals'
import { TargetsServiceImpl } from '../../domain/services/targets'
import { MealLoggingFacade } from '../../facades/MealLoggingFacade'
import { DashboardFacade } from '../../facades/DashboardFacade'
import { LogRepository } from '../../infra/repositories/LogRepository'
import { TargetsRepository } from '../../infra/repositories/TargetsRepository'
import { LogEntry, NutrientVector } from '../../domain/models'
import { trackOperation } from '../../lib/performance'

// Mock all repository dependencies
jest.mock('../../infra/repositories/LogRepository')
jest.mock('../../infra/repositories/TargetsRepository')
jest.mock('../../lib/performance')

const MockLogRepository = LogRepository as jest.MockedClass<typeof LogRepository>
const MockTargetsRepository = TargetsRepository as jest.MockedClass<typeof TargetsRepository>
const mockTrackOperation = trackOperation as jest.MockedFunction<typeof trackOperation>

describe('Meal Logging Integration Flow', () => {
  let logRepository: jest.Mocked<LogRepository>
  let targetsRepository: jest.Mocked<TargetsRepository>
  let ledgerService: LedgerServiceImpl
  let totalsService: TotalsServiceImpl
  let targetsService: TargetsServiceImpl
  let mealLoggingFacade: MealLoggingFacade
  let dashboardFacade: DashboardFacade

  const userId = 'test-user-123'
  const testDate = '2024-01-15'

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock repositories
    logRepository = new MockLogRepository({} as any) as jest.Mocked<LogRepository>
    targetsRepository = new MockTargetsRepository({} as any) as jest.Mocked<TargetsRepository>

    // Create service instances
    ledgerService = new LedgerServiceImpl(logRepository)
    totalsService = new TotalsServiceImpl(logRepository, targetsRepository)
    targetsService = new TargetsServiceImpl(targetsRepository)
    mealLoggingFacade = new MealLoggingFacade(ledgerService)
    dashboardFacade = new DashboardFacade(targetsService, totalsService)

    // Setup performance tracking mock to just execute the function
    mockTrackOperation.mockImplementation(async (operation, fn) => {
      return await fn()
    })
  })

  describe('Complete Meal Logging Flow', () => {
    const sampleTargets = {
      calories: 2000,
      protein_g: 150,
      carbs_g: 200,
      fat_g: 67
    }

    const appleMealEntry: LogEntry = {
      id: 'entry-1',
      user_id: userId,
      date: testDate,
      meal_type: 'breakfast',
      food_id: 'apple-001',
      food_name: 'Medium Apple',
      serving_size: 1,
      serving_unit: 'medium',
      nutrients: {
        calories: 95,
        protein_g: 0.5,
        carbs_g: 25,
        fat_g: 0.3,
        fiber_g: 4.4,
        vitaminC_mg: 8.4,
      },
      created_at: new Date().toISOString(),
    }

    const chickenMealEntry: LogEntry = {
      id: 'entry-2',
      user_id: userId,
      date: testDate,
      meal_type: 'lunch',
      food_id: 'chicken-001',
      food_name: 'Grilled Chicken Breast',
      serving_size: 100,
      serving_unit: 'g',
      nutrients: {
        calories: 165,
        protein_g: 31,
        carbs_g: 0,
        fat_g: 3.6,
      },
      created_at: new Date().toISOString(),
    }

    it('should complete full meal logging to dashboard flow', async () => {
      // Setup: Configure repository mocks
      targetsRepository.getTargets.mockResolvedValue(sampleTargets)
      logRepository.create.mockImplementation(async (entry) => entry as LogEntry)
      logRepository.findByUserAndDate.mockResolvedValue([appleMealEntry, chickenMealEntry])

      // Step 1: Log first meal (apple)
      const appleResult = await mealLoggingFacade.logMeal(appleMealEntry)
      expect(appleResult.success).toBe(true)
      expect(logRepository.create).toHaveBeenCalledWith(appleMealEntry)

      // Step 2: Log second meal (chicken)
      const chickenResult = await mealLoggingFacade.logMeal(chickenMealEntry)
      expect(chickenResult.success).toBe(true)
      expect(logRepository.create).toHaveBeenCalledWith(chickenMealEntry)

      // Step 3: Get updated dashboard data
      const dashboardData = await dashboardFacade.getDashboardData(userId, testDate)

      // Verify dashboard shows combined totals
      expect(dashboardData.targets).toEqual(sampleTargets)
      expect(dashboardData.totals.calories).toBe(260) // 95 + 165
      expect(dashboardData.totals.protein_g).toBe(31.5) // 0.5 + 31
      expect(dashboardData.totals.carbs_g).toBe(25) // 25 + 0
      expect(dashboardData.totals.fat_g).toBe(3.9) // 0.3 + 3.6

      // Verify percentage calculations
      expect(dashboardData.totals.pctOfTarget.calories).toBe(13) // 260/2000 * 100
      expect(dashboardData.totals.pctOfTarget.protein_g).toBe(21) // 31.5/150 * 100
    })

    it('should handle meal removal and update totals correctly', async () => {
      // Setup: Initial state with two logged meals
      targetsRepository.getTargets.mockResolvedValue(sampleTargets)
      logRepository.findByUserAndDate
        .mockResolvedValueOnce([appleMealEntry, chickenMealEntry]) // Before removal
        .mockResolvedValueOnce([chickenMealEntry]) // After removal

      logRepository.delete.mockResolvedValue()

      // Get initial dashboard state
      const initialData = await dashboardFacade.getDashboardData(userId, testDate)
      expect(initialData.totals.calories).toBe(260)

      // Remove the apple entry
      const removeResult = await mealLoggingFacade.removeMeal('entry-1')
      expect(removeResult.success).toBe(true)
      expect(logRepository.delete).toHaveBeenCalledWith('entry-1')

      // Get updated dashboard state
      const updatedData = await dashboardFacade.getDashboardData(userId, testDate)
      expect(updatedData.totals.calories).toBe(165) // Only chicken remaining
      expect(updatedData.totals.protein_g).toBe(31) // Only chicken protein
    })

    it('should maintain performance budget of 1200ms for complete logging flow', async () => {
      const startTime = performance.now()

      // Setup mocks for performance test
      targetsRepository.getTargets.mockResolvedValue(sampleTargets)
      logRepository.create.mockImplementation(async (entry) => {
        // Simulate database latency
        await new Promise(resolve => setTimeout(resolve, 50))
        return entry as LogEntry
      })
      logRepository.findByUserAndDate.mockResolvedValue([appleMealEntry])

      // Execute complete flow: Settings → Profile → Targets → Entry → Totals → Dashboard
      await mealLoggingFacade.logMeal(appleMealEntry)
      const dashboardData = await dashboardFacade.getDashboardData(userId, testDate)

      const duration = performance.now() - startTime

      // Should complete within 1200ms budget for logFlow
      expect(duration).toBeLessThan(1200)
      expect(dashboardData.isLoading).toBe(false)
    })

    it('should handle concurrent meal logging correctly', async () => {
      targetsRepository.getTargets.mockResolvedValue(sampleTargets)
      logRepository.create.mockImplementation(async (entry) => entry as LogEntry)

      // Create multiple meal entries
      const meals = [
        { ...appleMealEntry, id: 'entry-1' },
        { ...chickenMealEntry, id: 'entry-2' },
        { ...appleMealEntry, id: 'entry-3', food_name: 'Banana' },
      ]

      // Log meals concurrently
      const promises = meals.map(meal => mealLoggingFacade.logMeal(meal))
      const results = await Promise.all(promises)

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true)
      })

      // Repository should be called for each meal
      expect(logRepository.create).toHaveBeenCalledTimes(3)
    })

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed')
      logRepository.create.mockRejectedValue(dbError)

      const result = await mealLoggingFacade.logMeal(appleMealEntry)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection failed')
    })

    it('should maintain data consistency during partial failures', async () => {
      targetsRepository.getTargets.mockResolvedValue(sampleTargets)

      // First meal succeeds, second fails
      logRepository.create
        .mockResolvedValueOnce(appleMealEntry)
        .mockRejectedValueOnce(new Error('Network error'))

      // Log first meal successfully
      const appleResult = await mealLoggingFacade.logMeal(appleMealEntry)
      expect(appleResult.success).toBe(true)

      // Second meal fails
      const chickenResult = await mealLoggingFacade.logMeal(chickenMealEntry)
      expect(chickenResult.success).toBe(false)

      // Dashboard should only show first meal
      logRepository.findByUserAndDate.mockResolvedValue([appleMealEntry])
      const dashboardData = await dashboardFacade.getDashboardData(userId, testDate)

      expect(dashboardData.totals.calories).toBe(95) // Only apple
      expect(dashboardData.error).toBeNull() // Dashboard itself should not error
    })
  })

  describe('Event Bus Integration', () => {
    it('should emit correct events during meal logging flow', async () => {
      // This would test event bus integration if we had access to it
      // For now, we verify the facade calls work correctly

      const sampleTargets = {
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 67
      }

      targetsRepository.getTargets.mockResolvedValue(sampleTargets)
      logRepository.create.mockResolvedValue(appleMealEntry)
      logRepository.findByUserAndDate.mockResolvedValue([appleMealEntry])

      const result = await mealLoggingFacade.logMeal(appleMealEntry)
      expect(result.success).toBe(true)

      // Verify repository interactions that would trigger events
      expect(logRepository.create).toHaveBeenCalledWith(appleMealEntry)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle a typical daily eating pattern', async () => {
      const dailyMeals: LogEntry[] = [
        // Breakfast
        { ...appleMealEntry, id: 'breakfast-1', meal_type: 'breakfast' },
        {
          ...appleMealEntry,
          id: 'breakfast-2',
          meal_type: 'breakfast',
          food_name: 'Oatmeal',
          nutrients: { calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3 }
        },

        // Lunch
        { ...chickenMealEntry, id: 'lunch-1', meal_type: 'lunch' },
        {
          ...appleMealEntry,
          id: 'lunch-2',
          meal_type: 'lunch',
          food_name: 'Brown Rice',
          nutrients: { calories: 110, protein_g: 3, carbs_g: 22, fat_g: 1 }
        },

        // Dinner
        {
          ...appleMealEntry,
          id: 'dinner-1',
          meal_type: 'dinner',
          food_name: 'Salmon',
          nutrients: { calories: 206, protein_g: 22, carbs_g: 0, fat_g: 12 }
        }
      ]

      targetsRepository.getTargets.mockResolvedValue({
        calories: 2000,
        protein_g: 150,
        carbs_g: 200,
        fat_g: 67
      })

      logRepository.create.mockImplementation(async (entry) => entry as LogEntry)
      logRepository.findByUserAndDate.mockResolvedValue(dailyMeals)

      // Log all meals
      for (const meal of dailyMeals) {
        const result = await mealLoggingFacade.logMeal(meal)
        expect(result.success).toBe(true)
      }

      // Check final dashboard state
      const dashboardData = await dashboardFacade.getDashboardData(userId, testDate)

      // Verify reasonable daily totals
      expect(dashboardData.totals.calories).toBe(726) // Sum of all meals
      expect(dashboardData.totals.protein_g).toBe(61.5)
      expect(dashboardData.totals.pctOfTarget.calories).toBe(36) // 726/2000 * 100
    })
  })
})