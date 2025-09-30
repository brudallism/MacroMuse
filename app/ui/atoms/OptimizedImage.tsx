// ui/atoms/OptimizedImage.tsx - Production-optimized image component with lazy loading
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { View, Image, ActivityIndicator, Text, StyleSheet, ViewStyle, ImageStyle } from 'react-native'
import { performanceMonitor } from '@lib/performance'
import { logger } from '@lib/logger'

interface OptimizedImageProps {
  uri: string
  width: number
  height: number
  alt: string
  priority?: boolean
  placeholder?: 'blur' | 'empty' | 'skeleton'
  borderRadius?: number
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'
  onLoad?: () => void
  onError?: (error: string) => void
  style?: ViewStyle
  imageStyle?: ImageStyle
}

interface ImageCache {
  [uri: string]: {
    loaded: boolean
    failed: boolean
    timestamp: number
  }
}

// Global image cache to track loaded images
const imageCache: ImageCache = {}
const CACHE_EXPIRY = 30 * 60 * 1000 // 30 minutes

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  width,
  height,
  alt,
  priority = false,
  placeholder = 'skeleton',
  borderRadius = 0,
  resizeMode = 'cover',
  onLoad,
  onError,
  style,
  imageStyle
}) => {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [isVisible, setIsVisible] = useState(priority)
  const imageRef = useRef<View>(null)
  const loadStartTime = useRef<number>(0)

  // Check cache first
  const isCached = useMemo(() => {
    const cached = imageCache[uri]
    if (!cached) return false

    const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRY
    if (isExpired) {
      delete imageCache[uri]
      return false
    }

    return cached.loaded
  }, [uri])

  // Optimize image URI for different sources
  const optimizedUri = useMemo(() => {
    if (!uri) return ''

    try {
      // Spoonacular image optimization
      if (uri.includes('spoonacular.com')) {
        const url = new URL(uri)
        url.searchParams.set('width', width.toString())
        url.searchParams.set('height', height.toString())
        url.searchParams.set('crop', 'true')
        return url.toString()
      }

      // USDA/FoodData Central images (if applicable)
      if (uri.includes('fdc.nal.usda.gov')) {
        return `${uri}?w=${width}&h=${height}&fit=crop`
      }

      // Open Food Facts optimization
      if (uri.includes('openfoodfacts.org')) {
        return uri.replace(/\.(\d+)\./, `.${Math.min(width, 400)}.`)
      }

      // Generic optimization for other sources
      if (uri.includes('?')) {
        return `${uri}&w=${width}&h=${height}`
      } else {
        return `${uri}?w=${width}&h=${height}`
      }
    } catch (error) {
      logger.warn('Image URI optimization failed', { uri, error })
      return uri
    }
  }, [uri, width, height])

  // Intersection observer for lazy loading
  useEffect(() => {
    if (priority || isCached) {
      setIsVisible(true)
      return
    }

    // Simple visibility detection for React Native
    // In a real implementation, you might use react-native-intersection-observer
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 100)

    return () => clearTimeout(timer)
  }, [priority, isCached])

  const handleLoad = () => {
    const loadTime = performance.now() - loadStartTime.current

    setLoadState('loaded')

    // Cache successful load
    imageCache[optimizedUri] = {
      loaded: true,
      failed: false,
      timestamp: Date.now()
    }

    // Track image load performance
    performanceMonitor.trackOperation('imageLoad', async () => {
      return { uri: optimizedUri, loadTime }
    }).catch(error => {
      logger.warn('Failed to track image load performance', { error })
    })

    onLoad?.()

    logger.debug('Image loaded successfully', {
      uri: optimizedUri.substring(0, 50),
      loadTime,
      cached: isCached
    })
  }

  const handleError = () => {
    setLoadState('error')

    // Cache failed load
    imageCache[optimizedUri] = {
      loaded: false,
      failed: true,
      timestamp: Date.now()
    }

    const errorMessage = 'Failed to load image'
    onError?.(errorMessage)

    logger.warn('Image failed to load', {
      uri: optimizedUri.substring(0, 50),
      alt
    })
  }

  const handleLoadStart = () => {
    loadStartTime.current = performance.now()
  }

  // Don't render anything if not visible yet
  if (!isVisible) {
    return (
      <View
        ref={imageRef}
        style={[
          {
            width,
            height,
            borderRadius,
            backgroundColor: '#f0f0f0'
          },
          style
        ]}
      >
        {placeholder === 'skeleton' && <SkeletonPlaceholder width={width} height={height} />}
      </View>
    )
  }

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: '#f0f0f0'
        },
        style
      ]}
    >
      {/* Main image */}
      <Image
        source={{ uri: optimizedUri }}
        style={[
          {
            width,
            height,
            borderRadius
          },
          loadState !== 'loaded' && styles.loading,
          imageStyle
        ]}
        onLoadStart={handleLoadStart}
        onLoad={handleLoad}
        onError={handleError}
        resizeMode={resizeMode}
        accessibilityLabel={alt}
        accessible={true}
      />

      {/* Loading state */}
      {loadState === 'loading' && (
        <View style={styles.overlayContainer}>
          {placeholder === 'blur' && (
            <BlurPlaceholder width={width} height={height} />
          )}
          {placeholder === 'skeleton' && (
            <SkeletonPlaceholder width={width} height={height} />
          )}
          <ActivityIndicator
            style={styles.loadingIndicator}
            size="small"
            color="#666"
          />
        </View>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>📷</Text>
          <Text style={styles.errorText}>Image unavailable</Text>
        </View>
      )}
    </View>
  )
}

// Blur placeholder component
const BlurPlaceholder: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <View
    style={[
      styles.blurPlaceholder,
      { width, height }
    ]}
  >
    <View style={styles.blurEffect} />
  </View>
)

// Skeleton loading placeholder
const SkeletonPlaceholder: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const [opacity, setOpacity] = useState(0.3)

  useEffect(() => {
    const animation = () => {
      setOpacity(prev => prev === 0.3 ? 0.7 : 0.3)
    }

    const interval = setInterval(animation, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <View
      style={[
        styles.skeletonPlaceholder,
        { width, height, opacity }
      ]}
    />
  )
}

const styles = StyleSheet.create({
  loading: {
    opacity: 0
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0'
  },
  loadingIndicator: {
    position: 'absolute'
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8'
  },
  errorIcon: {
    fontSize: 24,
    marginBottom: 4
  },
  errorText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center'
  },
  blurPlaceholder: {
    backgroundColor: '#e0e0e0',
    position: 'relative'
  },
  blurEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(240, 240, 240, 0.8)'
  },
  skeletonPlaceholder: {
    backgroundColor: '#e0e0e0'
  }
})

// Utility functions for image optimization
export const ImageOptimizer = {
  // Preload critical images
  preloadImages: async (uris: string[]): Promise<void> => {
    const preloadPromises = uris.map(uri => {
      return new Promise<void>((resolve) => {
        Image.prefetch(uri)
          .then(() => {
            imageCache[uri] = {
              loaded: true,
              failed: false,
              timestamp: Date.now()
            }
            resolve()
          })
          .catch(() => {
            imageCache[uri] = {
              loaded: false,
              failed: true,
              timestamp: Date.now()
            }
            resolve()
          })
      })
    })

    await Promise.all(preloadPromises)
  },

  // Clear expired cache entries
  clearExpiredCache: (): void => {
    const now = Date.now()
    Object.keys(imageCache).forEach(uri => {
      const cached = imageCache[uri]
      if (now - cached.timestamp > CACHE_EXPIRY) {
        delete imageCache[uri]
      }
    })
  },

  // Get cache stats
  getCacheStats: () => {
    const entries = Object.values(imageCache)
    return {
      totalCached: entries.length,
      successfullyLoaded: entries.filter(e => e.loaded).length,
      failed: entries.filter(e => e.failed).length
    }
  },

  // Clear all cache
  clearCache: (): void => {
    Object.keys(imageCache).forEach(key => {
      delete imageCache[key]
    })
  }
}

export default OptimizedImage