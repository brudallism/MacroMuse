// domain/models/dietary.ts - Dietary preferences domain models
// Extracted from legacy and adapted to Foundation architecture

/**
 * Foundation-compliant dietary restriction types
 * Split from main models.ts to maintain <400 LOC limit
 */

export type DietType =
  | 'vegan'
  | 'vegetarian'
  | 'pescatarian'
  | 'ketogenic'
  | 'paleo'
  | 'primal'
  | 'low-fodmap'
  | 'whole30'
  | 'none'

export type AllergenType =
  | 'dairy'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'tree_nuts'
  | 'peanuts'
  | 'wheat'
  | 'soy'
  | 'sesame'
  | 'gluten'
  | 'grain'
  | 'seafood'

export type PreferenceType =
  | 'organic_preferred'
  | 'local_preferred'
  | 'minimal_processing'
  | 'low_sodium'
  | 'low_sugar'

/**
 * Complete dietary restrictions profile
 * Matches legacy DietaryPreferences but with Foundation naming
 */
export interface DietaryRestrictions {
  diets: DietType[]
  allergies: AllergenType[]
  exclusions: string[] // Custom excluded ingredients
  preferences: PreferenceType[]
  strictFodmap?: boolean // For low-fodmap enhanced filtering
}

/**
 * Dietary validation result for food items
 * Used by filtering services
 */
export interface DietaryFlags {
  violatesRestrictions: boolean
  warnings: string[]
  confidence: number // 0-1, higher = more confident in analysis
}

/**
 * Spoonacular API query structure
 * Extracted from legacy translation service
 */
export interface SpoonacularQuery {
  diet?: string
  intolerances?: string
  includeIngredients?: string
  excludeIngredients?: string
  cuisine?: string
  type?: string
  maxReadyTime?: number
  minCalories?: number
  maxCalories?: number
  minProtein?: number
  maxProtein?: number
  minCarbs?: number
  maxCarbs?: number
  number: number
  offset: number
  addRecipeInformation: true
  addRecipeNutrition?: boolean
  addRecipeInstructions?: boolean
}

/**
 * Filtered food result with dietary analysis
 */
export interface FilteredFoodResult {
  // Base food properties (from existing UnifiedFoodResult)
  id: string
  name: string
  source: 'usda' | 'spoonacular' | 'barcode' | 'custom'

  // Dietary analysis
  dietaryFlags: DietaryFlags

  // Nutritional data (NutrientVector compatible)
  nutrients: {
    calories?: number
    protein_g?: number
    carbs_g?: number
    fat_g?: number
    fiber_g?: number
  }
}