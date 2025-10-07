// lib/monitoring.ts - Sentry integration with proper fingerprints and context
import * as Sentry from '@sentry/react-native'

import { logger } from './logger'
import { eventBus } from './eventBus'
import { performanceMonitor } from './performance'

interface UserContext {
  id: string
  email?: string
  username?: string
  segment?: string
  isPremium?: boolean
  installDate?: string
  lastActiveDate?: string
  sessionCount?: number
}

interface AppContext {
  version: string
  buildNumber: string
  environment: 'development' | 'staging' | 'production'
  platform: 'ios' | 'android'
  deviceInfo: {
    model?: string
    osVersion?: string
    locale?: string
    timezone?: string
  }
  features: Record<string, boolean>
}

interface PerformanceContext {
  memoryUsage?: number
  bundleSize?: number
  connectionType?: string
  batteryLevel?: number
  diskSpace?: number
}

export class MonitoringService {
  private static instance: MonitoringService | null = null
  private isInitialized = false
  private userContext: UserContext | null = null
  private appContext: AppContext | null = null

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService()
    }
    return MonitoringService.instance
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      Sentry.init({
        dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
        environment: this.getEnvironment(),
        release: this.getRelease(),
        dist: this.getBuildNumber(),

        // Performance monitoring
        integrations: [
          new Sentry.ReactNativeTracing({
            tracingOrigins: [
              'localhost',
              /^https:\/\/api\.spoonacular\.com/,
              /^https:\/\/.*\.supabase\.co/,
              /^https:\/\/world\.openfoodfacts\.org/
            ],
            enableStallTracking: true,
            enableAppStartTracking: true,
            enableNativeFramesTracking: true,
            enableUserInteractionTracing: true
          }),
        ],

        // Performance sampling
        tracesSampleRate: this.getTraceSampleRate(),
        profilesSampleRate: this.getProfileSampleRate(),

        // Session tracking
        autoSessionTracking: true,
        sessionTrackingIntervalMillis: 30000,

        // Error filtering and processing
        beforeSend: this.beforeSendHandler.bind(this),
        beforeSendTransaction: this.beforeSendTransactionHandler.bind(this),

        // Debug options
        debug: __DEV__,
        enabled: !__DEV__ || process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',

        // Native crash handling
        enableNativeCrashHandling: true,
        enableNativeNagger: false,

        // Privacy settings
        sendDefaultPii: false,
        beforeBreadcrumb: this.beforeBreadcrumbHandler.bind(this)
      })

      // Set up global event processors
      this.setupGlobalEventProcessors()

      // Set up event listeners
      this.setupEventListeners()

      this.isInitialized = true

      logger.info('Monitoring service initialized', {
        environment: this.getEnvironment(),
        release: this.getRelease()
      })

    } catch (error) {
      logger.error('Failed to initialize monitoring service', { error })
    }
  }

  private getEnvironment(): string {
    if (__DEV__) return 'development'
    if (process.env.EXPO_PUBLIC_ENVIRONMENT) return process.env.EXPO_PUBLIC_ENVIRONMENT
    return 'production'
  }

  private getRelease(): string {
    const version = process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0'
    const buildNumber = this.getBuildNumber()
    return `macromuse@${version}+${buildNumber}`
  }

  private getBuildNumber(): string {
    return process.env.EXPO_PUBLIC_BUILD_NUMBER || '1'
  }

  private getTraceSampleRate(): number {
    if (__DEV__) return 1.0
    if (this.getEnvironment() === 'staging') return 0.5
    return 0.1 // 10% sampling in production
  }

  private getProfileSampleRate(): number {
    if (__DEV__) return 1.0
    return 0.05 // 5% profiling in production
  }

  private beforeSendHandler(event: Sentry.Event): Sentry.Event | null {
    // Filter out non-critical errors in production
    if (!__DEV__ && this.shouldFilterEvent(event)) {
      return null
    }

    // Add custom fingerprinting
    event.fingerprint = this.generateFingerprint(event)

    // Add performance context
    event.contexts = {
      ...event.contexts,
      performance: this.getPerformanceContext(),
      app: this.appContext || undefined,
      device: this.getDeviceContext()
    }

    // Sanitize sensitive data
    event = this.sanitizeEvent(event)

    logger.debug('Sentry event processed', {
      eventId: event.event_id,
      level: event.level,
      message: event.message,
      fingerprint: event.fingerprint
    })

    return event
  }

  private beforeSendTransactionHandler(event: Sentry.Event): Sentry.Event | null {
    // Filter out noisy transactions
    if (this.shouldFilterTransaction(event)) {
      return null
    }

    // Add transaction-specific context
    event.contexts = {
      ...event.contexts,
      performance: this.getPerformanceContext()
    }

    return event
  }

  private beforeBreadcrumbHandler(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb | null {
    // Filter out sensitive breadcrumbs
    if (this.shouldFilterBreadcrumb(breadcrumb)) {
      return null
    }

    // Sanitize breadcrumb data
    if (breadcrumb.data) {
      breadcrumb.data = this.sanitizeData(breadcrumb.data)
    }

    return breadcrumb
  }

  private shouldFilterEvent(event: Sentry.Event): boolean {
    // Filter out network errors that are too common
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return true
    }

    // Filter out expected React Native warnings
    const message = event.message || event.exception?.values?.[0]?.value || ''
    const ignoredMessages = [
      'Warning: componentWillMount',
      'Warning: componentWillReceiveProps',
      'Non-serializable values were found in the navigation state'
    ]

    return ignoredMessages.some(ignored => message.includes(ignored))
  }

  private shouldFilterTransaction(event: Sentry.Event): boolean {
    const transactionName = event.transaction

    // Filter out very frequent UI transactions
    const ignoredTransactions = [
      'FlatList scroll',
      'TouchableOpacity press',
      'TextInput change'
    ]

    return ignoredTransactions.some(ignored =>
      transactionName?.includes(ignored)
    )
  }

  private shouldFilterBreadcrumb(breadcrumb: Sentry.Breadcrumb): boolean {
    // Filter out console logs in production
    if (!__DEV__ && breadcrumb.category === 'console') {
      return true
    }

    // Filter out sensitive navigation breadcrumbs
    if (breadcrumb.category === 'navigation' && breadcrumb.data?.to?.includes('sensitive')) {
      return true
    }

    return false
  }

  private generateFingerprint(event: Sentry.Event): string[] {
    const error = event.exception?.values?.[0]

    if (error) {
      // Create fingerprint based on error type and location
      const errorType = error.type || 'UnknownError'
      const errorLocation = this.extractErrorLocation(error)
      const errorMessage = this.normalizeErrorMessage(error.value)

      return [errorType, errorLocation, errorMessage]
    }

    // Fallback fingerprint for non-exception events
    return [event.level || 'info', event.logger || 'default', event.message || 'unknown']
  }

  private extractErrorLocation(error: Sentry.Exception): string {
    const frame = error.stacktrace?.frames?.[0]
    if (frame) {
      return `${frame.filename}:${frame.function}:${frame.lineno}`
    }
    return 'unknown'
  }

  private normalizeErrorMessage(message?: string): string {
    if (!message) return 'no-message'

    // Normalize common patterns
    return message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // Replace UUIDs
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .substring(0, 100) // Limit length
  }

  private getPerformanceContext(): PerformanceContext {
    return {
      memoryUsage: (performance as any).memory?.usedJSHeapSize,
      connectionType: 'unknown', // Would integrate with NetInfo
      batteryLevel: undefined, // Would integrate with battery API
      diskSpace: undefined // Would integrate with device info
    }
  }

  private getDeviceContext() {
    // This would integrate with react-native-device-info
    return {
      model: 'unknown',
      osVersion: 'unknown',
      locale: 'en-US',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  }

  private sanitizeEvent(event: Sentry.Event): Sentry.Event {
    // Remove sensitive data from event
    if (event.request?.headers) {
      delete event.request.headers.authorization
      delete event.request.headers.cookie
    }

    if (event.extra) {
      event.extra = this.sanitizeData(event.extra)
    }

    return event
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    const sanitized = { ...data }
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential']

    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[Filtered]'
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key])
      }
    }

    return sanitized
  }

  private setupGlobalEventProcessors(): void {
    // Add global event processor for user context
    Sentry.addGlobalEventProcessor(event => {
      if (this.userContext) {
        event.user = {
          id: this.userContext.id,
          username: this.userContext.username,
          segment: this.userContext.segment
        }
      }

      // Add feature flag context
      if (this.appContext?.features) {
        event.contexts = {
          ...event.contexts,
          features: this.appContext.features
        }
      }

      return event
    })

    // Add performance monitoring processor
    Sentry.addGlobalEventProcessor(event => {
      if (event.type === 'transaction') {
        // Add performance budget context
        const operationName = event.transaction
        if (operationName) {
          const budgetInfo = this.getPerformanceBudgetForOperation(operationName)
          if (budgetInfo) {
            event.contexts = {
              ...event.contexts,
              performance_budget: budgetInfo
            }
          }
        }
      }

      return event
    })
  }

  private getPerformanceBudgetForOperation(operationName: string): any {
    // Map transaction names to performance budgets
    const budgetMappings: Record<string, number> = {
      'food-search': 800,
      'meal-log': 1200,
      'recipe-import': 2000,
      'analytics-rollup': 2000
    }

    const budget = budgetMappings[operationName]
    return budget ? { budget, operation: operationName } : null
  }

  private setupEventListeners(): void {
    // Listen to performance budget violations
    eventBus.on('performance_budget_exceeded', (data) => {
      Sentry.addBreadcrumb({
        category: 'performance',
        message: `Performance budget exceeded: ${data.operation}`,
        level: 'warning',
        data: {
          operation: data.operation,
          actualMs: data.actualMs,
          budgetMs: data.budgetMs,
          excess: data.actualMs - data.budgetMs
        }
      })

      // Create performance issue for significant violations
      if (data.actualMs > data.budgetMs * 1.5) {
        Sentry.captureMessage(
          `Significant performance budget violation: ${data.operation}`,
          'warning'
        )
      }
    })

    // Listen to error boundary triggers
    eventBus.on('error_boundary_triggered', (data) => {
      Sentry.addBreadcrumb({
        category: 'ui',
        message: `Error boundary triggered: ${data.error}`,
        level: 'error',
        data: {
          errorId: data.errorId,
          componentStack: data.componentStack?.substring(0, 500)
        }
      })
    })

    // Listen to feature flag evaluations
    eventBus.on('feature_flag_evaluated', (data) => {
      Sentry.addBreadcrumb({
        category: 'feature',
        message: `Feature flag evaluated: ${data.feature}`,
        level: 'info',
        data: {
          feature: data.feature,
          enabled: data.enabled,
          userId: data.userId
        }
      })
    })

    // Listen to sync events
    eventBus.on('sync_completed', (data) => {
      Sentry.addBreadcrumb({
        category: 'sync',
        message: `Offline sync completed`,
        level: 'info',
        data: {
          processed: data.processed,
          failed: data.failed,
          remaining: data.remaining
        }
      })

      if (data.failed > 0) {
        Sentry.captureMessage(
          `Offline sync had failures: ${data.failed} operations failed`,
          'warning'
        )
      }
    })
  }

  // Public API methods
  setUserContext(user: UserContext): void {
    this.userContext = user

    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username
    })

    Sentry.setContext('user_details', {
      segment: user.segment,
      isPremium: user.isPremium,
      installDate: user.installDate,
      sessionCount: user.sessionCount
    })

    logger.info('User context set for monitoring', {
      userId: user.id,
      segment: user.segment,
      isPremium: user.isPremium
    })
  }

  setAppContext(app: AppContext): void {
    this.appContext = app

    Sentry.setContext('app_details', {
      version: app.version,
      buildNumber: app.buildNumber,
      environment: app.environment,
      platform: app.platform
    })

    Sentry.setContext('device_details', app.deviceInfo)
    Sentry.setContext('features', app.features)
  }

  captureError(error: Error, context?: Record<string, any>): string {
    const eventId = Sentry.captureException(error, {
      contexts: context ? { additional: context } : undefined
    })

    logger.error('Error captured by monitoring service', {
      eventId,
      error: error.message,
      context
    })

    return eventId
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>): string {
    const eventId = Sentry.captureMessage(message, level)

    if (context) {
      Sentry.setContext('message_context', context)
    }

    return eventId
  }

  addBreadcrumb(breadcrumb: Partial<Sentry.Breadcrumb>): void {
    Sentry.addBreadcrumb({
      timestamp: Date.now() / 1000,
      level: 'info',
      ...breadcrumb
    })
  }

  setTag(key: string, value: string): void {
    Sentry.setTag(key, value)
  }

  setExtra(key: string, value: any): void {
    Sentry.setExtra(key, value)
  }

  startTransaction(name: string, description?: string): Sentry.Transaction {
    return Sentry.startTransaction({
      name,
      description,
      tags: {
        component: 'app'
      }
    })
  }

  // Performance monitoring helpers
  async trackUserJourney(journeyName: string, steps: Array<() => Promise<void>>): Promise<void> {
    const transaction = this.startTransaction(`user-journey-${journeyName}`)

    try {
      for (let i = 0; i < steps.length; i++) {
        const span = transaction.startChild({
          op: 'user-step',
          description: `Step ${i + 1}`
        })

        await steps[i]()
        span.finish()
      }

      transaction.setStatus('ok')
    } catch (error) {
      transaction.setStatus('internal_error')
      this.captureError(error as Error, { journey: journeyName })
      throw error
    } finally {
      transaction.finish()
    }
  }

  // Health check and diagnostics
  async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    // Check if Sentry is properly initialized
    if (!this.isInitialized) {
      issues.push('Monitoring service not initialized')
    }

    // Check if user context is set
    if (!this.userContext) {
      issues.push('User context not set')
    }

    // Check if app context is set
    if (!this.appContext) {
      issues.push('App context not set')
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    try {
      await Sentry.flush(2000) // Wait up to 2 seconds for events to be sent
      Sentry.close()

      this.isInitialized = false
      this.userContext = null
      this.appContext = null

      logger.info('Monitoring service cleanup completed')
    } catch (error) {
      logger.error('Failed to cleanup monitoring service', { error })
    }
  }
}

// Singleton instance and convenience exports
export const monitoringService = MonitoringService.getInstance()

export const captureError = (error: Error, context?: Record<string, any>): string => {
  return monitoringService.captureError(error, context)
}

export const captureMessage = (message: string, level?: Sentry.SeverityLevel, context?: Record<string, any>): string => {
  return monitoringService.captureMessage(message, level, context)
}

export const addBreadcrumb = (breadcrumb: Partial<Sentry.Breadcrumb>): void => {
  monitoringService.addBreadcrumb(breadcrumb)
}

export const setUserContext = (user: UserContext): void => {
  monitoringService.setUserContext(user)
}

export const setAppContext = (app: AppContext): void => {
  monitoringService.setAppContext(app)
}

// Initialize monitoring when module is imported
monitoringService.initialize().catch(error => {
  console.error('Failed to initialize monitoring service:', error)
})

export default MonitoringService