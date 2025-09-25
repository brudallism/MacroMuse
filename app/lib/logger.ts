// lib/logger.ts - Structured logging with Sentry integration
import { sentryService } from './sentry'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: Record<string, unknown>
  userId?: string
}

class Logger {
  private isDevelopment = __DEV__

  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, context, userId } = entry
    const userInfo = userId ? `[User: ${userId}]` : ''
    const contextInfo = context ? `[Context: ${JSON.stringify(context)}]` : ''
    return `[${timestamp}] [${level.toUpperCase()}] ${userInfo} ${message} ${contextInfo}`
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    userId?: string
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
      ...(userId && { userId }),
    }

    // Always log to console in development
    if (this.isDevelopment) {
      const formatted = this.formatLog(entry)
      switch (level) {
        case 'debug':
          console.debug(formatted)
          break
        case 'info':
          console.info(formatted)
          break
        case 'warn':
          console.warn(formatted)
          break
        case 'error':
          console.error(formatted)
          break
      }
    }

    // Send warn/error to Sentry in production
    if (!this.isDevelopment && (level === 'warn' || level === 'error')) {
      if (level === 'error') {
        const error = new Error(message)
        sentryService.captureError(error, context, userId)
      } else {
        // For warnings, just log structured data to Sentry
        sentryService.logCoreEvent('analytics_rollup', { level, message, ...context }, userId)
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log('debug', message, context, userId)
  }

  info(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log('info', message, context, userId)
  }

  warn(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log('warn', message, context, userId)
  }

  error(message: string, context?: Record<string, unknown>, userId?: string): void {
    this.log('error', message, context, userId)
  }

  // Structured logging for core events as specified in Foundation document
  logCoreEvent(
    event: 'meal_logged' | 'goal_updated' | 'plan_applied',
    data: Record<string, unknown>,
    userId?: string
  ): void {
    this.info(`Core event: ${event}`, data, userId)
    sentryService.logCoreEvent(event, data, userId)
  }
}

export const logger = new Logger()
