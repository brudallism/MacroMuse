// lib/performance.ts - Performance tracking system with exact budgets from Foundation document
import { eventBus } from './eventBus'
import { logger } from './logger'

// Exact budgets from Foundation document
const PERFORMANCE_BUDGETS = {
  coldStart: 2000, // cold start p95 < 2000ms
  search: 800, // search p95 < 800ms
  logFlow: 1200, // log flow p95 < 1200ms
} as const

type OperationType = keyof typeof PERFORMANCE_BUDGETS

export async function trackOperation<T>(
  operation: OperationType,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now()
  const result = await fn()
  const elapsed = performance.now() - startTime

  logger.debug(`Operation ${operation} completed in ${elapsed.toFixed(2)}ms`)

  if (elapsed > PERFORMANCE_BUDGETS[operation]) {
    const budgetExceeded = {
      operation,
      actualMs: elapsed,
      budgetMs: PERFORMANCE_BUDGETS[operation],
    }

    eventBus.emit('performance_budget_exceeded', budgetExceeded)
    logger.warn(`Performance budget exceeded for ${operation}`, budgetExceeded)
  }

  return result
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

// Automated performance tracking as specified in Foundation document
export const trackOperationSync = <T>(operation: OperationType, fn: () => T): T => {
  const startTime = performance.now()
  const result = fn()
  const elapsed = performance.now() - startTime

  logger.debug(`Sync operation ${operation} completed in ${elapsed.toFixed(2)}ms`)

  if (elapsed > PERFORMANCE_BUDGETS[operation]) {
    const budgetExceeded = {
      operation,
      actualMs: elapsed,
      budgetMs: PERFORMANCE_BUDGETS[operation],
    }

    eventBus.emit('performance_budget_exceeded', budgetExceeded)
    logger.warn(`Performance budget exceeded for ${operation}`, budgetExceeded)
  }

  return result
}

// Performance budget enforcement for testing
export function assertPerformanceBudget(operation: OperationType, actualMs: number): void {
  const budget = PERFORMANCE_BUDGETS[operation]
  if (actualMs > budget) {
    throw new Error(
      `Performance budget exceeded: ${operation} took ${actualMs}ms, budget is ${budget}ms`
    )
  }
}

export { PERFORMANCE_BUDGETS }
