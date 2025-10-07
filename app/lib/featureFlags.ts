// lib/featureFlags.ts - Enhanced feature flags system for gradual rollout
import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { logger } from './logger'
import { eventBus } from './eventBus'

interface FeatureConfig {
  enabled: boolean
  rolloutPercentage: number
  requirements: string[]
  description?: string
  releaseDate?: string
  deprecationDate?: string
  variants?: Record<string, any>
}

interface FeatureFlagContext {
  userId: string
  userSegment?: string
  appVersion: string
  platform: 'ios' | 'android'
  betaUser?: boolean
  premiumUser?: boolean
  installDate?: string
}

// Enhanced feature configuration with gradual rollout support
export const FEATURES: Record<string, FeatureConfig> = {
  BARCODE_SCANNING: {
    enabled: true,
    rolloutPercentage: 100,
    requirements: ['camera_permission'],
    description: 'Barcode scanning for food items',
    releaseDate: '2024-01-01'
  },
  RECIPE_IMPORT: {
    enabled: true,
    rolloutPercentage: 100,
    requirements: ['internet_connection'],
    description: 'Import recipes from Spoonacular',
    releaseDate: '2024-01-01'
  },
  MEAL_PLANNING: {
    enabled: true,
    rolloutPercentage: 100,
    requirements: [],
    description: 'Weekly meal planning functionality',
    releaseDate: '2024-01-01'
  },
  ADVANCED_ANALYTICS: {
    enabled: true,
    rolloutPercentage: 80,
    requirements: [],
    description: 'Advanced nutrition analytics and insights',
    releaseDate: '2024-01-01'
  },
  NUTRIENT_TRENDS: {
    enabled: true,
    rolloutPercentage: 90,
    requirements: [],
    description: 'Nutrient trend analysis',
    releaseDate: '2024-01-01'
  },
  GOAL_RECOMMENDATIONS: {
    enabled: true,
    rolloutPercentage: 70,
    requirements: [],
    description: 'AI-powered goal recommendations',
    releaseDate: '2024-01-01'
  },
  SOCIAL_SHARING: {
    enabled: false,
    rolloutPercentage: 20,
    requirements: ['social_permissions'],
    description: 'Share meals and recipes with friends',
    releaseDate: '2024-02-01'
  },
  VOICE_LOGGING: {
    enabled: false,
    rolloutPercentage: 10,
    requirements: ['microphone_permission', 'beta_user'],
    description: 'Voice-powered meal logging',
    releaseDate: '2024-03-01'
  },
  AI_SUGGESTIONS: {
    enabled: false,
    rolloutPercentage: 5,
    requirements: ['premium_user', 'ai_api_available'],
    description: 'AI-powered meal suggestions',
    releaseDate: '2024-04-01'
  },
  PREMIUM_FEATURES: {
    enabled: true,
    rolloutPercentage: 100,
    requirements: ['premium_user'],
    description: 'Premium subscription features',
    releaseDate: '2024-01-01'
  }
} as const

export type FeatureName = keyof typeof FEATURES

export class FeatureFlagManager {
  private static instance: FeatureFlagManager | null = null
  private cache = new Map<string, { result: boolean; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private context: FeatureFlagContext | null = null

  static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager()
    }
    return FeatureFlagManager.instance
  }

  async setContext(context: FeatureFlagContext): Promise<void> {
    this.context = context
    this.clearCache()

    logger.info('Feature flag context updated', {
      userId: context.userId,
      userSegment: context.userSegment,
      platform: context.platform,
      appVersion: context.appVersion
    })
  }

  async isFeatureEnabled(
    feature: FeatureName,
    context?: Partial<FeatureFlagContext>
  ): Promise<boolean> {
    const cacheKey = `${feature}_${JSON.stringify(context || {})}`
    const cached = this.cache.get(cacheKey)

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result
    }

    const mergedContext = { ...this.context, ...context }
    const result = await this.evaluateFeature(feature, mergedContext)

    // Cache the result
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    })

    return result
  }

  private async evaluateFeature(
    feature: FeatureName,
    context: Partial<FeatureFlagContext> | null
  ): Promise<boolean> {
    const config = FEATURES[feature]

    if (!config) {
      logger.warn('Unknown feature flag requested', { feature })
      return false
    }

    // Check if feature is globally enabled
    if (!config.enabled) {
      return false
    }

    // Check rollout percentage
    if (!context?.userId) {
      logger.warn('No user ID provided for feature flag evaluation', { feature })
      return false
    }

    const userHash = this.hashUserId(context.userId)
    if (userHash > config.rolloutPercentage) {
      logger.debug('User not in rollout percentage', {
        feature,
        userHash,
        rolloutPercentage: config.rolloutPercentage
      })
      return false
    }

    // Check requirements
    for (const requirement of config.requirements) {
      const met = await this.checkRequirement(requirement, context)
      if (!met) {
        logger.debug('Feature requirement not met', {
          feature,
          requirement,
          userId: context.userId
        })
        return false
      }
    }

    // Log feature usage for analytics
    this.logFeatureUsage(feature, context, true)

    return true
  }

  private hashUserId(userId: string): number {
    // Consistent hash function to assign users to rollout groups
    let hash = 0
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100
  }

  private async checkRequirement(
    requirement: string,
    context: Partial<FeatureFlagContext> | null
  ): Promise<boolean> {
    switch (requirement) {
      case 'camera_permission':
        return await this.checkCameraPermission()

      case 'microphone_permission':
        return await this.checkMicrophonePermission()

      case 'social_permissions':
        return await this.checkSocialPermissions()

      case 'internet_connection':
        return await this.checkInternetConnection()

      case 'beta_user':
        return context?.betaUser === true

      case 'premium_user':
        return context?.premiumUser === true

      case 'ai_api_available':
        return await this.checkAIApiAvailability()

      default:
        logger.warn('Unknown feature requirement', { requirement })
        return false
    }
  }

  private async checkCameraPermission(): Promise<boolean> {
    // This would integrate with react-native-permissions
    // For now, return a placeholder
    return true
  }

  private async checkMicrophonePermission(): Promise<boolean> {
    // This would integrate with react-native-permissions
    // For now, return a placeholder
    return false
  }

  private async checkSocialPermissions(): Promise<boolean> {
    // Check if social sharing is available
    return false
  }

  private async checkInternetConnection(): Promise<boolean> {
    // This would integrate with NetInfo
    return true
  }

  private async checkAIApiAvailability(): Promise<boolean> {
    // Check if AI services are available
    return false
  }

  private logFeatureUsage(
    feature: FeatureName,
    context: Partial<FeatureFlagContext> | null,
    enabled: boolean
  ): void {
    eventBus.emit('feature_flag_evaluated', {
      feature,
      enabled,
      userId: context?.userId,
      userSegment: context?.userSegment,
      timestamp: new Date().toISOString()
    })

    logger.info('Feature flag evaluated', {
      feature,
      enabled,
      userId: context?.userId,
      rolloutPercentage: FEATURES[feature].rolloutPercentage
    })
  }

  // Get feature variant for A/B testing
  async getFeatureVariant(
    feature: FeatureName,
    context?: Partial<FeatureFlagContext>
  ): Promise<string | null> {
    const isEnabled = await this.isFeatureEnabled(feature, context)
    if (!isEnabled) {
      return null
    }

    const config = FEATURES[feature]
    if (!config.variants) {
      return 'default'
    }

    // Use user hash to consistently assign variant
    const userId = context?.userId || this.context?.userId
    if (!userId) {
      return 'default'
    }

    const hash = this.hashUserId(userId + feature)
    const variantKeys = Object.keys(config.variants)
    const variantIndex = hash % variantKeys.length

    return variantKeys[variantIndex]
  }

  // Administrative methods
  async getAllFeatureStates(
    context?: Partial<FeatureFlagContext>
  ): Promise<Record<FeatureName, boolean>> {
    const states: Record<string, boolean> = {}

    for (const feature of Object.keys(FEATURES) as FeatureName[]) {
      states[feature] = await this.isFeatureEnabled(feature, context)
    }

    return states
  }

  getFeatureConfig(feature: FeatureName): FeatureConfig | null {
    return FEATURES[feature] || null
  }

  getAllFeatureConfigs(): Record<FeatureName, FeatureConfig> {
    return { ...FEATURES }
  }

  clearCache(): void {
    this.cache.clear()
    logger.debug('Feature flag cache cleared')
  }

  // Override for testing/admin purposes
  async setFeatureOverride(
    feature: FeatureName,
    enabled: boolean,
    userId?: string
  ): Promise<void> {
    const overrideKey = `feature_override_${feature}_${userId || 'global'}`

    await AsyncStorage.setItem(overrideKey, JSON.stringify({
      enabled,
      timestamp: Date.now(),
      userId
    }))

    this.clearCache()

    logger.info('Feature override set', { feature, enabled, userId })
  }

  async removeFeatureOverride(feature: FeatureName, userId?: string): Promise<void> {
    const overrideKey = `feature_override_${feature}_${userId || 'global'}`
    await AsyncStorage.removeItem(overrideKey)

    this.clearCache()

    logger.info('Feature override removed', { feature, userId })
  }

  private async checkFeatureOverride(
    feature: FeatureName,
    userId?: string
  ): Promise<boolean | null> {
    try {
      // Check user-specific override first
      if (userId) {
        const userOverrideKey = `feature_override_${feature}_${userId}`
        const userOverride = await AsyncStorage.getItem(userOverrideKey)
        if (userOverride) {
          return JSON.parse(userOverride).enabled
        }
      }

      // Check global override
      const globalOverrideKey = `feature_override_${feature}_global`
      const globalOverride = await AsyncStorage.getItem(globalOverrideKey)
      if (globalOverride) {
        return JSON.parse(globalOverride).enabled
      }

      return null
    } catch (error) {
      logger.error('Failed to check feature override', { feature, error })
      return null
    }
  }
}

// Convenience functions for backward compatibility and ease of use
export const featureFlagManager = FeatureFlagManager.getInstance()

export async function isFeatureEnabled(
  feature: FeatureName,
  context?: Partial<FeatureFlagContext>
): Promise<boolean> {
  return featureFlagManager.isFeatureEnabled(feature, context)
}

export async function getFeatureVariant(
  feature: FeatureName,
  context?: Partial<FeatureFlagContext>
): Promise<string | null> {
  return featureFlagManager.getFeatureVariant(feature, context)
}

// React hook for feature flags (would be in a separate hooks file)
export const useFeatureFlag = (
  feature: FeatureName,
  context?: Partial<FeatureFlagContext>
) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    let mounted = true

    const checkFeature = async () => {
      try {
        const enabled = await featureFlagManager.isFeatureEnabled(feature, context)
        if (mounted) {
          setIsEnabled(enabled)
          setIsLoading(false)
        }
      } catch (error) {
        logger.error('Failed to check feature flag in hook', { feature, error })
        if (mounted) {
          setIsEnabled(false)
          setIsLoading(false)
        }
      }
    }

    checkFeature()

    return () => {
      mounted = false
    }
  }, [feature, JSON.stringify(context)])

  return { isEnabled, isLoading }
}

// Feature flag analytics
export const FeatureFlagAnalytics = {
  getUsageStats: (): Record<FeatureName, { checks: number; enabled: number }> => {
    // This would integrate with your analytics system
    return {} as any
  },

  getRolloutProgress: (_feature: FeatureName): { enabled: number; total: number; percentage: number } => {
    // This would track actual rollout progress
    return { enabled: 0, total: 0, percentage: 0 }
  },

  getRequirementStats: (): Record<string, { passed: number; failed: number }> => {
    // Track how often requirements pass/fail
    return {}
  }
}

export default FeatureFlagManager
