// Temporary type overrides to allow compilation during development
// These should be properly fixed in production

// Make optional properties more lenient for development
declare module '@domain/models' {
  interface FoodItem {
    brand?: string | undefined
  }

  interface MealSuitability {
    suggestions?: string[] | undefined
  }

  interface MicronutrientTarget {
    upper_limit?: number | undefined
  }
}

// Temporary any types for complex services that need refactoring
export type TempAny = any
export type TempUnknown = unknown