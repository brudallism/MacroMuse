// ui/components/LazyLoader.tsx - Feature-based code splitting with performance tracking
import React, { Suspense, lazy, useState, useEffect } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { performanceMonitor } from '@lib/performance'
import { logger } from '@lib/logger'
import { FEATURES } from '@lib/featureFlags'

interface LazyLoaderProps {
  feature: keyof typeof FEATURES
  loader: () => Promise<{ default: React.ComponentType<any> }>
  fallback?: React.ReactNode
  children?: React.ReactNode
  onLoadStart?: () => void
  onLoadComplete?: (loadTime: number) => void
  onLoadError?: (error: Error) => void
}

interface BundleLoadState {
  status: 'loading' | 'loaded' | 'error'
  loadTime?: number
  error?: Error
}

// Cache for loaded components to prevent re-loading
const componentCache = new Map<string, React.ComponentType<any>>()
const bundleStates = new Map<string, BundleLoadState>()

export const LazyLoader: React.FC<LazyLoaderProps> = ({
  feature,
  loader,
  fallback,
  children,
  onLoadStart,
  onLoadComplete,
  onLoadError
}) => {
  const [loadState, setLoadState] = useState<BundleLoadState>(
    bundleStates.get(feature as string) || { status: 'loading' }
  )

  // Check if feature is enabled
  if (!FEATURES[feature]?.enabled) {
    return <FeatureDisabledScreen feature={feature as string} />
  }

  // Create lazy component with performance tracking
  const LazyComponent = React.useMemo(() => {
    const cacheKey = feature as string

    // Return cached component if available
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey)!
    }

    // Create new lazy component with performance tracking
    const component = lazy(async () => {
      const startTime = performance.now()
      onLoadStart?.()

      try {
        setLoadState({ status: 'loading' })
        bundleStates.set(cacheKey, { status: 'loading' })

        const result = await performanceMonitor.trackOperation('bundleLoad', async () => {
          return await loader()
        })

        const loadTime = performance.now() - startTime

        // Cache the loaded component
        componentCache.set(cacheKey, result.default)

        const newState: BundleLoadState = { status: 'loaded', loadTime }
        setLoadState(newState)
        bundleStates.set(cacheKey, newState)

        onLoadComplete?.(loadTime)

        logger.info('Bundle loaded successfully', {
          feature,
          loadTime,
          bundleSize: 'unknown' // Would need build-time analysis for actual size
        })

        return result
      } catch (error) {
        const loadError = error as Error
        const errorState: BundleLoadState = { status: 'error', error: loadError }

        setLoadState(errorState)
        bundleStates.set(cacheKey, errorState)

        onLoadError?.(loadError)

        logger.error('Bundle load failed', {
          feature,
          error: loadError.message,
          loadTime: performance.now() - startTime
        })

        throw error
      }
    })

    return component
  }, [feature, loader, onLoadStart, onLoadComplete, onLoadError])

  const defaultFallback = (
    <LoadingSpinner
      feature={feature as string}
      message={`Loading ${feature}...`}
    />
  )

  return (
    <Suspense fallback={fallback || defaultFallback}>
      <LazyComponent>
        {children}
      </LazyComponent>
    </Suspense>
  )
}

// Loading spinner component
const LoadingSpinner: React.FC<{ feature: string; message: string }> = ({
  feature,
  message
}) => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>{message}</Text>
    <Text style={styles.featureText}>Feature: {feature}</Text>
  </View>
)

// Feature disabled screen
const FeatureDisabledScreen: React.FC<{ feature: string }> = ({ feature }) => (
  <View style={styles.disabledContainer}>
    <Text style={styles.disabledIcon}>🚧</Text>
    <Text style={styles.disabledTitle}>Feature Not Available</Text>
    <Text style={styles.disabledText}>
      The {feature} feature is currently disabled.
    </Text>
  </View>
)

// Bundle size analyzer utility
export class BundleSizeAnalyzer {
  private static bundleMetrics = new Map<string, {
    loadTime: number
    estimatedSize: number
    loadCount: number
    lastLoaded: number
  }>()

  static recordBundleLoad(bundleName: string, loadTime: number, estimatedSize?: number): void {
    const existing = this.bundleMetrics.get(bundleName)

    this.bundleMetrics.set(bundleName, {
      loadTime,
      estimatedSize: estimatedSize || existing?.estimatedSize || 0,
      loadCount: (existing?.loadCount || 0) + 1,
      lastLoaded: Date.now()
    })
  }

  static getBundleStats() {
    const stats = Array.from(this.bundleMetrics.entries()).map(([name, metrics]) => ({
      bundleName: name,
      avgLoadTime: metrics.loadTime,
      estimatedSize: metrics.estimatedSize,
      loadCount: metrics.loadCount,
      lastLoaded: new Date(metrics.lastLoaded).toISOString()
    }))

    return {
      bundles: stats,
      totalBundles: stats.length,
      totalEstimatedSize: stats.reduce((sum, bundle) => sum + bundle.estimatedSize, 0),
      avgLoadTime: stats.reduce((sum, bundle) => sum + bundle.avgLoadTime, 0) / stats.length || 0
    }
  }

  static clearStats(): void {
    this.bundleMetrics.clear()
  }

  static reportLargeBundles(threshold: number = 500000): Array<{ name: string; size: number }> {
    return Array.from(this.bundleMetrics.entries())
      .filter(([, metrics]) => metrics.estimatedSize > threshold)
      .map(([name, metrics]) => ({ name, size: metrics.estimatedSize }))
  }
}

// Pre-defined lazy loaders for different features
export const createFeatureLazyLoader = (feature: keyof typeof FEATURES) => {
  const loaders: Record<string, () => Promise<{ default: React.ComponentType<any> }>> = {
    BARCODE_SCANNING: () => import('@ui/screens/BarcodeFlow'),
    RECIPE_IMPORT: () => import('@ui/screens/RecipeBuilder'),
    MEAL_PLANNING: () => import('@ui/screens/MealPlanningScreen'),
    ADVANCED_ANALYTICS: () => import('@ui/screens/AnalyticsDashboard'),
    AI_SUGGESTIONS: () => import('@ui/screens/AISuggestionsScreen')
  }

  const loader = loaders[feature as string]
  if (!loader) {
    throw new Error(`No lazy loader defined for feature: ${feature}`)
  }

  return (props: any) => (
    <LazyLoader
      feature={feature}
      loader={loader}
      onLoadComplete={(loadTime) => {
        BundleSizeAnalyzer.recordBundleLoad(feature as string, loadTime)
      }}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center'
  },
  featureText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  disabledContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa'
  },
  disabledIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  disabledTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center'
  },
  disabledText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20
  }
})

export default LazyLoader