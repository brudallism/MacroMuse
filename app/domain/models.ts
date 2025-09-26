// domain/models.ts - Canonical types from Foundation document
export type NutrientVector = {
  // Core Macros
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number

  // Sub-macros (detail fats + sugars)
  saturatedFat_g?: number // ⚠️ Minimize
  monounsaturatedFat_g?: number
  polyunsaturatedFat_g?: number
  transFat_g?: number // ⚠️ Minimize
  cholesterol_mg?: number // ⚠️ Minimize
  totalSugars_g?: number
  addedSugars_g?: number // ⚠️ Minimize

  // Minerals
  sodium_mg?: number // ⚠️ Minimize
  potassium_mg?: number
  calcium_mg?: number
  iron_mg?: number
  magnesium_mg?: number
  zinc_mg?: number
  phosphorus_mg?: number
  copper_mg?: number
  manganese_mg?: number
  selenium_µg?: number

  // Vitamins
  vitaminA_µg?: number
  vitaminC_mg?: number
  vitaminD_µg?: number
  vitaminE_mg?: number
  vitaminK_µg?: number
  thiaminB1_mg?: number
  riboflavinB2_mg?: number
  niacinB3_mg?: number
  vitaminB6_mg?: number
  folateB9_µg?: number
  vitaminB12_µg?: number
  pantothenicAcidB5_mg?: number
  choline_mg?: number
}

export type TargetVector = Required<
  Pick<NutrientVector, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'>
> & { fiber_g?: number }

export type LogEntry = {
  id?: string
  userId: string
  loggedAt: string // ISO
  source: 'usda' | 'spoonacular' | 'barcode' | 'custom'
  sourceId?: string
  qty: number
  unit: string
  nutrients: NutrientVector
  mealLabel?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeId?: string
}

export type Insight = {
  id: string
  dateRange: { start: string; end: string }
  key: string // e.g. "iron_low_streak"
  severity: 'info' | 'warn' | 'high'
  message: string
  details?: Record<string, unknown>
}

export type UserProfile = {
  id: string
  email: string
  name?: string
  preferences: {
    units: 'metric' | 'imperial'
    diet?: 'standard' | 'vegetarian' | 'vegan' | 'keto' | 'paleo'
    allergies?: string[]
  }
  createdAt: string
  updatedAt: string
}

export type Goal = {
  id: string
  userId: string
  type: 'weight_loss' | 'weight_gain' | 'maintain' | 'muscle_gain'
  targets: TargetVector
  effectiveDate: string
  endDate?: string
}

export type FoodSearchResult = {
  id: string
  name: string
  source: 'usda' | 'spoonacular' | 'barcode' | 'custom'
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  confidence?: number
  brand?: string
  ingredients?: string
  allergens?: string
}

export type RecognizedFood = {
  foodId: string
  name: string
  confidence: number
  suggestedQuantity: number
  suggestedUnit: string
  nutrients: NutrientVector
}

export type TrendData = {
  nutrient: keyof NutrientVector
  values: Array<{
    date: string
    value: number
    targetValue?: number
  }>
  trend: 'increasing' | 'decreasing' | 'stable'
  changePercent: number
}

export type MicronutrientRow = {
  nutrient: keyof NutrientVector
  target: number
  unit: string
  priority: 'high' | 'medium' | 'low'
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodItem = {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'barcode' | 'custom'
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  lastUsed?: string
  usageCount?: number
  isFavorite?: boolean
  isCustom?: boolean
  createdBy?: string
  ingredients?: string
  allergens?: string
}

export type RecentFoodEntry = {
  food: FoodItem
  lastUsed: string
  usageCount: number
  userId: string
}

export type FavoriteFood = {
  food: FoodItem
  addedAt: string
  userId: string
  category?: string
}

export type CustomFood = {
  id: string
  name: string
  brand?: string
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  createdBy: string
  createdAt: string
  isPublic?: boolean
  description?: string
  ingredients?: string
  allergens?: string
}

export type MealTimePreferences = {
  breakfast: { start: string; end: string }
  lunch: { start: string; end: string }
  dinner: { start: string; end: string }
  snack: { flexible: boolean }
}
