// lib/performance.ts - Enhanced performance tracking with production polish (Days 12-13)
import { eventBus } from './eventBus'
import { logger } from './logger'

// Complete performance budgets with production-level monitoring
export const PERFORMANCE_BUDGETS = {
  // Core Foundation document budgets
  coldStart: 2000, // cold start p95 < 2000ms
  search: 800, // search p95 < 800ms
  logFlow: 1200, // log flow p95 < 1200ms
  dashboard_load: 1000, // Dashboard data loading
  profile_update: 800,  // Profile updates
  meal_log: 1200,       // Individual meal logging
  targets_calculation: 500, // Target calculations

  // Advanced food operations
  recent_foods_get: 500,
  recent_foods_add: 300,
  favorites_get: 500,
  favorites_add: 400,
  favorites_remove: 300,
  custom_food_create: 800,
  custom_food_update: 600,
  custom_food_delete: 400,
  custom_foods_get: 600,
  advanced_food_log: 1000,
  food_usage_stats: 1000,
  food_recommendations: 1200,

  // Analytics & Insights operations (Days 8-9)
  analyticsRollup: 2000, // Daily rollup computation
  insightGeneration: 1500, // Insight rule engine evaluation
  trendCalculation: 800, // Trend analysis computation
  goalAdherence: 500, // Goal adherence calculation
  nutrientAggregation: 1000, // Nutrient data aggregation
  patternDetection: 1200, // Pattern detection algorithms
  weeklyRollup: 3000, // Weekly rollup (more complex)
  monthlyRollup: 5000, // Monthly rollup (most complex)
  goalRecommendations: 1000, // Goal adjustment recommendations
  streakAnalysis: 600, // Streak detection

  // Recipe & Meal Planning operations (Days 10-11)
  recipeNutritionCalculation: 500, // Recipe nutrition calculation
  recipeScaling: 500, // Recipe scaling operations
  recipeImport: 2000, // Spoonacular recipe import
  planCreation: 1200, // Meal plan creation
  planApplication: 1200, // Apply meal plan to ledger
  shoppingListGeneration: 800, // Shopping list generation
  mealPlanNutritionCalculation: 800, // Plan nutrition analysis

  // Production performance budgets (Days 12-13)
  appLaunch: 3000, // Full app initialization
  tabNavigation: 200, // Tab switching
  foodCardRender: 100, // Individual food card render
  imageLoad: 1500, // Image loading with optimization
  databaseQuery: 500, // Database operation budget
  stateHydration: 300, // Store rehydration
  errorBoundaryRecover: 500, // Error recovery time
  offlineSync: 2000, // Offline queue processing
  bundleLoad: 1000, // Code splitting bundle load
} as const

type OperationType = keyof typeof PERFORMANCE_BUDGETS

interface PerformanceMetrics {
  operation: OperationType
  duration: number
  memoryDelta: number
  budget: number
  budgetMet: boolean
  timestamp: number
  userId?: string
}

// Enhanced performance monitor with memory tracking and detailed metrics
export const performanceMonitor = {
  async trackOperation<T>(
    operation: OperationType,
    fn: () => Promise<T>,
    userId?: string
  ): Promise<T> {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0

    try {
      const result = await fn()
      const elapsed = performance.now() - startTime
      const memoryDelta = ((performance as any).memory?.usedJSHeapSize || 0) - startMemory

      const metrics: PerformanceMetrics = {
        operation,
        duration: elapsed,
        memoryDelta,
        budget: PERFORMANCE_BUDGETS[operation],
        budgetMet: elapsed <= PERFORMANCE_BUDGETS[operation],
        timestamp: Date.now(),
        userId
      }

      // Log detailed performance data
      logger.info('Performance tracked', metrics)

      // Emit budget violation events for monitoring
      if (!metrics.budgetMet) {
        eventBus.emit('performance_budget_exceeded', {
          operation,
          actualMs: elapsed,
          budgetMs: PERFORMANCE_BUDGETS[operation],
          memoryDelta,
          userId
        })
      }

      return result
    } catch (error) {
      logger.error('Performance tracking failed', { operation, error })
      throw error
    }
  },

  trackOperationSync<T>(
    operation: OperationType,
    fn: () => T,
    userId?: string
  ): T {
    const startTime = performance.now()
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0

    try {
      const result = fn()
      const elapsed = performance.now() - startTime
      const memoryDelta = ((performance as any).memory?.usedJSHeapSize || 0) - startMemory

      const metrics: PerformanceMetrics = {
        operation,
        duration: elapsed,
        memoryDelta,
        budget: PERFORMANCE_BUDGETS[operation],
        budgetMet: elapsed <= PERFORMANCE_BUDGETS[operation],
        timestamp: Date.now(),
        userId
      }

      logger.info('Performance tracked (sync)', metrics)

      if (!metrics.budgetMet) {
        eventBus.emit('performance_budget_exceeded', {
          operation,
          actualMs: elapsed,
          budgetMs: PERFORMANCE_BUDGETS[operation],
          memoryDelta,
          userId
        })
      }

      return result
    } catch (error) {
      logger.error('Performance tracking failed (sync)', { operation, error })
      throw error
    }
  }
}

// Legacy exports for backward compatibility
export async function trackOperation<T>(
  operation: OperationType,
  fn: () => Promise<T>
): Promise<T> {
  return performanceMonitor.trackOperation(operation, fn)
}

export const trackOperationSync = <T>(operation: OperationType, fn: () => T): T => {
  return performanceMonitor.trackOperationSync(operation, fn)
}

export function createPerformanceTimer(name: string): { end: () => number } {
  const startTime = performance.now()

  return {
    end: (): number => {
      const elapsed = performance.now() - startTime
      logger.debug(`Timer ${name} completed in ${elapsed.toFixed(2)}ms`)
      return elapsed
    },
  }
}

// Enhanced performance budget enforcement for testing
export function assertPerformanceBudget(operation: OperationType, actualMs: number): void {
  const budget = PERFORMANCE_BUDGETS[operation]
  if (actualMs > budget) {
    throw new Error(
      `Performance budget exceeded: ${operation} took ${actualMs.toFixed(2)}ms, budget is ${budget}ms (exceeded by ${(actualMs - budget).toFixed(2)}ms)`
    )
  }
}

// Performance analytics for production monitoring
export const performanceAnalytics = {
  getOperationStats(operation: OperationType): { calls: number; avgDuration: number; violations: number } {
    // This would integrate with your analytics system
    // For now, return placeholder data
    return { calls: 0, avgDuration: 0, violations: 0 }
  },

  getBudgetViolationRate(): number {
    // Calculate percentage of operations exceeding budget
    return 0
  },

  getMemoryUsageTrend(): Array<{ timestamp: number; usage: number }> {
    // Track memory usage over time
    return []
  }
}

export { PERFORMANCE_BUDGETS }
