// lib/featureFlags.ts
export const FEATURES = {
  BARCODE: { enabled: true },
  ADVANCED_ANALYTICS: { enabled: true },
  AI_ASSISTANT: { enabled: false }, // post-V1
} as const

export type FeatureName = keyof typeof FEATURES

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURES[feature].enabled
}
