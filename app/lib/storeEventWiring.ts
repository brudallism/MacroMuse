// lib/storeEventWiring.ts - Wire stores together via event bus (no cross-store imports)
import { eventBus } from './eventBus'
import { sentryService } from './sentry'
import { logger } from './logger'

// Wire event listeners to handle cross-store reactions
export function wireStoreEvents(): void {
  // Performance budget exceeded -> Log to Sentry
  eventBus.on('performance_budget_exceeded', ({ operation, actualMs, budgetMs }) => {
    logger.warn(`Performance budget exceeded: ${operation}`, { actualMs, budgetMs })
    sentryService.logPerformanceViolation(operation, actualMs, budgetMs)
  })

  // Error boundary triggered -> Log to Sentry
  eventBus.on('error_boundary_triggered', ({ error, componentStack, userId }) => {
    logger.error(`Error boundary triggered: ${error}`, { componentStack }, userId)
    const errorObj = new Error(error)
    sentryService.captureError(errorObj, { componentStack }, userId)
  })

  // User authenticated -> Set user in Sentry
  eventBus.on('user_authenticated', ({ userId, profile }) => {
    logger.info('User authenticated', { userId }, userId)
    sentryService.setUser(userId, profile.email)
  })

  // Core events -> Structured logging
  eventBus.on('meal_logged', ({ userId, entry }) => {
    logger.logCoreEvent('meal_logged', { entryId: entry.id, source: entry.source }, userId)
  })

  eventBus.on('goal_updated', ({ date }) => {
    logger.logCoreEvent('goal_updated', { date })
  })

  eventBus.on('plan_applied', ({ planId }) => {
    logger.logCoreEvent('plan_applied', { planId })
  })

  // Analytics rollup completed -> Log completion
  eventBus.on('analytics_rollup_completed', ({ userId, period, date }) => {
    logger.info('Analytics rollup completed', { period, date }, userId)
  })

  // Insights generated -> Log insight count
  eventBus.on('insights_generated', ({ userId, insights }) => {
    logger.info(
      'Insights generated',
      { count: insights.length, severities: insights.map((i) => i.severity) },
      userId
    )
  })

  // Food search completed -> Cache invalidation could go here
  eventBus.on('food_search_completed', ({ query, results, source }) => {
    logger.debug('Food search completed', { query, resultCount: results.length, source })
  })

  logger.info('Store event wiring initialized')
}

// Call this once at app startup
export function initializeStoreEventSystem(): void {
  wireStoreEvents()
  logger.info('Store event system initialized')
}
