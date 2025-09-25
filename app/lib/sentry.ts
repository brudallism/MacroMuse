// lib/sentry.ts - Sentry integration with structured logging for core events
import * as Sentry from '@sentry/react-native'

// Core events that should be logged to Sentry as specified in Foundation document
type CoreEvent =
  | 'meal_logged'
  | 'goal_updated'
  | 'plan_applied'
  | 'analytics_rollup'
  | 'performance_budget_exceeded'
  | 'error_boundary_triggered'

interface SentryConfig {
  dsn?: string
  environment: 'development' | 'staging' | 'production'
  release?: string
  enableInExpoDevelopment?: boolean
}

class SentryService {
  private isInitialized = false

  init(config: SentryConfig): void {
    if (this.isInitialized) {
      console.warn('Sentry already initialized')
      return
    }

    // Don't initialize in development unless explicitly enabled
    if (__DEV__ && !config.enableInExpoDevelopment) {
      console.log('Sentry disabled in development mode')
      return
    }

    if (!config.dsn) {
      console.warn('Sentry DSN not provided - Sentry will not be initialized')
      return
    }

    const sentryConfig: any = {
      dsn: config.dsn,
      environment: config.environment,
      enableAutoSessionTracking: true,
      beforeSend: (event: any) => {
        // Filter out sensitive data
        if (event.extra) {
          // Remove any potential PII from logs
          delete event.extra.email
          delete event.extra.phone
          delete event.extra.address
        }
        return event
      },
    }

    if (config.release) {
      sentryConfig.release = config.release
    }

    Sentry.init(sentryConfig)

    this.isInitialized = true
    console.log(`Sentry initialized for ${config.environment}`)
  }

  // Structured logging for core events
  logCoreEvent(event: CoreEvent, data: Record<string, unknown>, userId?: string): void {
    if (!this.isInitialized) return

    Sentry.addBreadcrumb({
      message: `Core event: ${event}`,
      category: 'core-event',
      level: 'info',
      data: {
        event,
        ...data,
        timestamp: new Date().toISOString(),
      },
    })

    // Set user context if provided
    if (userId) {
      Sentry.setUser({ id: userId })
    }
  }

  // Log performance budget violations
  logPerformanceViolation(
    operation: string,
    actualMs: number,
    budgetMs: number,
    userId?: string
  ): void {
    if (!this.isInitialized) return

    Sentry.captureMessage(`Performance budget exceeded: ${operation}`, 'warning')

    Sentry.setTag('performance_violation', operation)
    Sentry.setExtra('actual_ms', actualMs)
    Sentry.setExtra('budget_ms', budgetMs)
    Sentry.setExtra('overage_ms', actualMs - budgetMs)

    if (userId) {
      Sentry.setUser({ id: userId })
    }
  }

  // Capture errors with context
  captureError(error: Error, context?: Record<string, unknown>, userId?: string): void {
    if (!this.isInitialized) {
      console.error('Error captured (Sentry not initialized):', error, context)
      return
    }

    Sentry.withScope((scope) => {
      if (context) {
        Object.keys(context).forEach((key) => {
          scope.setExtra(key, context[key])
        })
      }

      if (userId) {
        scope.setUser({ id: userId })
      }

      Sentry.captureException(error)
    })
  }

  // Set user context
  setUser(userId: string, email?: string): void {
    if (!this.isInitialized) return

    const user: { id: string; email?: string } = { id: userId }
    if (email) {
      user.email = email
    }

    Sentry.setUser(user)
  }

  // Clear user context (on logout)
  clearUser(): void {
    if (!this.isInitialized) return

    Sentry.setUser(null)
  }
}

// Create singleton instance
export const sentryService = new SentryService()

// Initialize with environment variables
const initializeSentry = (): void => {
  const config: SentryConfig = {
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
    enableInExpoDevelopment: false, // Set to true for testing Sentry in dev
  }

  sentryService.init(config)
}

// Auto-initialize
initializeSentry()

export { Sentry }
