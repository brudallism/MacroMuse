// ui/components/ErrorBoundary.tsx - Global error boundary with user-friendly messaging
import React, { Component, ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'

import { logger } from '@lib/logger'
import { eventBus } from '@lib/eventBus'
import { performanceMonitor } from '@lib/performance'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string | null
  errorInfo: React.ErrorInfo | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, errorId: string, retry: () => void) => ReactNode
  level?: 'global' | 'feature' | 'component'
  featureName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private maxRetries = 3

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const errorId = generateErrorId()

    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { level = 'component', featureName, onError } = this.props
    const { errorId } = this.state

    this.setState({ errorInfo })

    // Log error with context
    logger.error('React Error Boundary triggered', {
      errorId,
      level,
      featureName,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount
    })

    // Emit error event for analytics and monitoring
    eventBus.emit('error_boundary_triggered', {
      error: error.message,
      componentStack: errorInfo.componentStack,
      errorId,
      level,
      featureName,
      userId: getCurrentUserId()
    })

    // Track error recovery performance
    performanceMonitor.trackOperation('errorBoundaryRecover', async () => {
      return { errorId, level, featureName }
    }).catch(perfError => {
      logger.warn('Failed to track error boundary performance', { perfError })
    })

    // Call custom error handler
    onError?.(error, errorInfo)

    // Report to external error service (Sentry integration happens elsewhere)
    this.reportError(error, errorInfo, errorId)
  }

  private reportError = (error: Error, errorInfo: React.ErrorInfo, errorId: string) => {
    // This would integrate with Sentry or other error reporting service
    // For now, we just ensure proper local logging
    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level,
      featureName: this.props.featureName,
      timestamp: new Date().toISOString(),
      userAgent: 'react-native-app',
      userId: getCurrentUserId()
    }

    // In a real implementation, this would send to your error reporting service
    logger.error('Error report generated', errorReport)
  }

  private handleRetry = () => {
    const { retryCount } = this.state

    if (retryCount < this.maxRetries) {
      logger.info('Retrying after error', {
        errorId: this.state.errorId,
        retryCount: retryCount + 1
      })

      this.setState({
        hasError: false,
        error: null,
        errorId: null,
        errorInfo: null,
        retryCount: retryCount + 1
      })
    } else {
      logger.warn('Max retries exceeded', {
        errorId: this.state.errorId,
        maxRetries: this.maxRetries
      })
    }
  }

  private handleRestart = () => {
    logger.info('Restarting component after error', {
      errorId: this.state.errorId
    })

    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      errorInfo: null,
      retryCount: 0
    })
  }

  render() {
    const { hasError, error, errorId, retryCount } = this.state
    const { fallback, level = 'component' } = this.props

    if (hasError && error && errorId) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorId, this.handleRetry)
      }

      // Use appropriate error screen based on level
      if (level === 'global') {
        return (
          <GlobalErrorScreen
            error={error}
            errorId={errorId}
            onRestart={this.handleRestart}
            onRetry={retryCount < this.maxRetries ? this.handleRetry : undefined}
          />
        )
      }

      if (level === 'feature') {
        return (
          <FeatureErrorScreen
            error={error}
            errorId={errorId}
            featureName={this.props.featureName || 'Feature'}
            onRetry={retryCount < this.maxRetries ? this.handleRetry : undefined}
            onRestart={this.handleRestart}
          />
        )
      }

      // Component level error
      return (
        <ComponentErrorScreen
          error={error}
          errorId={errorId}
          onRetry={retryCount < this.maxRetries ? this.handleRetry : undefined}
        />
      )
    }

    return this.props.children
  }
}

// Global app-level error screen
const GlobalErrorScreen: React.FC<{
  error: Error
  errorId: string
  onRestart: () => void
  onRetry?: () => void
}> = ({ error, errorId, onRestart, onRetry }) => (
  <View style={styles.globalErrorContainer}>
    <ScrollView contentContainerStyle={styles.globalErrorContent}>
      <Text style={styles.globalErrorIcon}>😓</Text>
      <Text style={styles.globalErrorTitle}>Oops! Something went wrong</Text>
      <Text style={styles.globalErrorMessage}>
        We're sorry, but the app encountered an unexpected error.
        Don't worry - your data is safe.
      </Text>

      <View style={styles.errorActions}>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.restartButton} onPress={onRestart}>
          <Text style={styles.restartButtonText}>Restart App</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.errorDetails}>
        <Text style={styles.errorId}>Error ID: {errorId}</Text>
        <Text style={styles.errorHelp}>
          If this problem persists, please contact support with the error ID above.
        </Text>
      </View>
    </ScrollView>
  </View>
)

// Feature-level error screen
const FeatureErrorScreen: React.FC<{
  error: Error
  errorId: string
  featureName: string
  onRetry?: () => void
  onRestart: () => void
}> = ({ error, errorId, featureName, onRetry, onRestart }) => (
  <View style={styles.featureErrorContainer}>
    <Text style={styles.featureErrorIcon}>⚠️</Text>
    <Text style={styles.featureErrorTitle}>
      {featureName} is temporarily unavailable
    </Text>
    <Text style={styles.featureErrorMessage}>
      We're having trouble loading this feature. Please try again in a moment.
    </Text>

    <View style={styles.errorActions}>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={onRestart}>
        <Text style={styles.secondaryButtonText}>Go Back</Text>
      </TouchableOpacity>
    </View>

    <Text style={styles.errorId}>Error ID: {errorId}</Text>
  </View>
)

// Component-level error screen
const ComponentErrorScreen: React.FC<{
  error: Error
  errorId: string
  onRetry?: () => void
}> = ({ error, errorId, onRetry }) => (
  <View style={styles.componentErrorContainer}>
    <Text style={styles.componentErrorIcon}>🔧</Text>
    <Text style={styles.componentErrorTitle}>Content unavailable</Text>
    <Text style={styles.componentErrorMessage}>
      This section couldn't load properly.
    </Text>

    {onRetry && (
      <TouchableOpacity style={styles.smallRetryButton} onPress={onRetry}>
        <Text style={styles.smallRetryButtonText}>Try again</Text>
      </TouchableOpacity>
    )}

    <Text style={styles.smallErrorId}>ID: {errorId}</Text>
  </View>
)

// Utility functions
const generateErrorId = (): string => {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  return `ERR-${timestamp}-${random}`.toUpperCase()
}

const getCurrentUserId = (): string | undefined => {
  // This would integrate with your auth system
  try {
    // Return current user ID from your auth store
    return 'current-user-id' // Placeholder
  } catch {
    return undefined
  }
}

// Error message utility following Foundation.md principles
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection and try again.',
  SEARCH_FAILED: 'Search is temporarily unavailable. Please try again in a moment.',
  SAVE_FAILED: 'Unable to save your changes. Please try again.',
  LOAD_FAILED: 'Unable to load your data. Please refresh and try again.',
  CAMERA_PERMISSION: 'Camera access is needed to scan barcodes. Please enable camera permissions in settings.',
  DATABASE_ERROR: 'Unable to access your data. Please try again.',
  IMPORT_FAILED: 'Unable to import recipe. Please check the source and try again.',
  SYNC_FAILED: 'Unable to sync your data. Changes will be saved when connection is restored.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again or contact support if the problem persists.'
} as const

export class ErrorHandler {
  static getErrorMessage(error: unknown): string {
    if (error instanceof NetworkError) {
      return ERROR_MESSAGES.NETWORK_ERROR
    }

    if (error instanceof ValidationError) {
      return `Please check: ${(error as any).field}`
    }

    if (error instanceof PermissionError) {
      return ERROR_MESSAGES.CAMERA_PERMISSION
    }

    if (error instanceof DatabaseError) {
      return ERROR_MESSAGES.DATABASE_ERROR
    }

    if (error instanceof Error) {
      // Map specific error messages to user-friendly versions
      const message = error.message.toLowerCase()

      if (message.includes('network') || message.includes('fetch')) {
        return ERROR_MESSAGES.NETWORK_ERROR
      }

      if (message.includes('permission')) {
        return ERROR_MESSAGES.CAMERA_PERMISSION
      }

      if (message.includes('database') || message.includes('supabase')) {
        return ERROR_MESSAGES.DATABASE_ERROR
      }
    }

    return ERROR_MESSAGES.UNKNOWN_ERROR
  }

  static logError(error: unknown, context: Record<string, any> = {}): void {
    logger.error('Application error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...context
    })
  }
}

// Custom error types for better error handling
export class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class PermissionError extends Error {
  constructor(message: string, public permission?: string) {
    super(message)
    this.name = 'PermissionError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public query?: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

const styles = StyleSheet.create({
  // Global error styles
  globalErrorContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa'
  },
  globalErrorContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  globalErrorIcon: {
    fontSize: 64,
    marginBottom: 20
  },
  globalErrorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center'
  },
  globalErrorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 300
  },

  // Feature error styles
  featureErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa'
  },
  featureErrorIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  featureErrorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center'
  },
  featureErrorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 280
  },

  // Component error styles
  componentErrorContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 10
  },
  componentErrorIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  componentErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4
  },
  componentErrorMessage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12
  },

  // Action buttons
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  restartButton: {
    backgroundColor: '#333',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center'
  },
  smallRetryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6
  },
  smallRetryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600'
  },

  // Error details
  errorDetails: {
    alignItems: 'center'
  },
  errorId: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 8
  },
  smallErrorId: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
    marginTop: 8
  },
  errorHelp: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16
  }
})

export default ErrorBoundary