// infra/adapters/SpoonacularAdapter.ts - Foundation-compliant Spoonacular translation
// Extracted from legacy translate-to-spoonacular.ts and adapted to Foundation architecture

import type {
  DietaryRestrictions,
  SpoonacularQuery,
  AllergenType,
  DietType
} from '@domain/models/dietary'
import {
  getDietExclusions,
  getAllergenExclusions,
  expandSynonyms,
  normalizeName,
  ALLERGEN_DEFINITIONS
} from '@domain/services/dietary-presets'

/**
 * Infrastructure adapter for Spoonacular API translation
 * Pure functions with no side effects - Foundation compliant
 */

/**
 * Convert DietaryRestrictions to Spoonacular API query parameters
 * Extracted from legacy with Foundation compliance
 */
export function buildSpoonacularQuery(
  restrictions: DietaryRestrictions,
  options: {
    number?: number
    offset?: number
    includeNutrition?: boolean
    includeInstructions?: boolean
    maxReadyTime?: number
    calorieRange?: { min?: number; max?: number }
  } = {}
): SpoonacularQuery {
  const {
    number = 30,
    offset = 0,
    includeNutrition = true,
    includeInstructions = false,
    maxReadyTime,
    calorieRange
  } = options

  // Convert primary diet to Spoonacular format
  const primaryDiet = restrictions.diets[0] // Use first diet if multiple
  const diet = primaryDiet && primaryDiet !== 'none'
    ? convertDietToSpoonacular(primaryDiet)
    : undefined

  // Convert allergies to intolerances string
  const intolerances = restrictions.allergies.length > 0
    ? restrictions.allergies.map(convertAllergenToSpoonacular).join(',')
    : undefined

  // Build comprehensive exclusions list
  const excludedIngredients = buildComprehensiveExclusions(restrictions)

  // Base query structure
  const query: SpoonacularQuery = {
    diet,
    intolerances,
    excludeIngredients: excludedIngredients.length > 0
      ? excludedIngredients.join(',')
      : undefined,
    number,
    offset,
    addRecipeInformation: true,
    addRecipeNutrition: includeNutrition,
    addRecipeInstructions: includeInstructions
  }

  // Add optional constraints
  if (maxReadyTime) {
    query.maxReadyTime = maxReadyTime
  }

  if (calorieRange?.min) {
    query.minCalories = calorieRange.min
  }

  if (calorieRange?.max) {
    query.maxCalories = calorieRange.max
  }

  return query
}

/**
 * Convert Foundation diet type to Spoonacular diet parameter
 * Pure function mapping
 */
function convertDietToSpoonacular(diet: DietType): string | undefined {
  const dietMap: Record<DietType, string | undefined> = {
    'vegan': 'vegan',
    'vegetarian': 'vegetarian',
    'pescatarian': 'pescetarian', // Note: Spoonacular uses "pescetarian"
    'ketogenic': 'ketogenic',
    'paleo': 'paleo',
    'primal': 'primal',
    'low-fodmap': undefined, // Handled through exclusions
    'whole30': 'whole30',
    'none': undefined
  }

  return dietMap[diet]
}

/**
 * Convert Foundation allergen type to Spoonacular intolerance
 * Pure function using our allergen definitions
 */
function convertAllergenToSpoonacular(allergen: AllergenType): string {
  const definition = ALLERGEN_DEFINITIONS[allergen]
  return definition ? definition.spoonacularName : allergen
}

/**
 * Build comprehensive exclusions list from all restriction sources
 * Pure function with synonym expansion
 */
function buildComprehensiveExclusions(restrictions: DietaryRestrictions): string[] {
  const excludes = new Set<string>()

  // Add diet-implied exclusions
  restrictions.diets.forEach(diet => {
    const dietExclusions = getDietExclusions(diet, restrictions.strictFodmap)
    dietExclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))
  })

  // Add allergen-implied exclusions (additional to intolerances param)
  const allergenExclusions = getAllergenExclusions(restrictions.allergies)
  allergenExclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))

  // Add custom exclusions
  restrictions.exclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))

  // Expand with synonyms for better matching
  const expandedExcludes = new Set<string>()
  Array.from(excludes).forEach(exclude => {
    const synonyms = expandSynonyms(exclude)
    synonyms.forEach(synonym => expandedExcludes.add(synonym))
  })

  return Array.from(expandedExcludes).sort()
}

/**
 * Create normalized cache key for query caching
 * Pure function providing stable, deterministic keys
 */
export function createQueryCacheKey(
  restrictions: DietaryRestrictions,
  options?: any
): string {
  const keyParts = [
    // Diet components
    restrictions.diets.sort().join(','),
    restrictions.allergies.sort().join(','),
    restrictions.exclusions.slice().sort().join(','),
    restrictions.preferences.sort().join(','),
    restrictions.strictFodmap ? 'strict-fodmap' : '',

    // Options
    options?.number || 30,
    options?.offset || 0,
    options?.maxReadyTime || '',
    JSON.stringify(options?.calorieRange || {})
  ]

  return keyParts.filter(Boolean).join('|')
}

/**
 * Validate restrictions before Spoonacular query
 * Pure function returning validation errors
 */
export function validateRestrictionsForQuery(restrictions: DietaryRestrictions): string[] {
  const errors: string[] = []

  // Check for conflicting diet + allergen combinations
  if (restrictions.diets.includes('vegan') &&
      restrictions.exclusions.some(exclusion =>
        ['cheese', 'milk', 'butter', 'meat', 'fish'].includes(exclusion.toLowerCase())
      )) {
    errors.push('Vegan diet conflicts with included animal products')
  }

  // Check for overly restrictive settings
  if (restrictions.allergies.length > 6) {
    errors.push('Too many allergies may severely limit recipe results')
  }

  if (restrictions.exclusions.length > 20) {
    errors.push('Too many excluded ingredients may severely limit recipe results')
  }

  // Check for multiple conflicting diets
  const conflictingDiets = [
    ['vegan', 'pescatarian'],
    ['vegan', 'ketogenic'] // Often difficult to combine
  ]

  conflictingDiets.forEach(([diet1, diet2]) => {
    if (restrictions.diets.includes(diet1 as DietType) &&
        restrictions.diets.includes(diet2 as DietType)) {
      errors.push(`Conflicting diets: ${diet1} and ${diet2} are difficult to combine`)
    }
  })

  return errors
}

/**
 * Get relaxation suggestions for zero-results scenarios
 * Pure function following specification relaxation order
 */
export function getRelaxationSuggestions(
  restrictions: DietaryRestrictions,
  options?: { maxReadyTime?: number; calorieRange?: { min?: number; max?: number } }
): Array<{
  step: string
  description: string
  action: string
  newRestrictions: Partial<DietaryRestrictions>
  newOptions?: any
}> {
  const suggestions = []

  // 1. Time relaxation
  if (options?.maxReadyTime && options.maxReadyTime < 60) {
    suggestions.push({
      step: 'time',
      description: 'Increase cooking time',
      action: `Allow up to ${options.maxReadyTime + 15} minutes`,
      newRestrictions: {},
      newOptions: { ...options, maxReadyTime: options.maxReadyTime + 15 }
    })
  }

  // 2. Non-allergy exclusions relaxation
  if (restrictions.exclusions.length > 0) {
    const commonExcludes = ['onion', 'garlic', 'mushrooms', 'tomato']
    const relaxedExclusions = restrictions.exclusions.filter(exclude =>
      !commonExcludes.includes(exclude.toLowerCase())
    )

    suggestions.push({
      step: 'excludes',
      description: 'Allow common excluded ingredients',
      action: 'Temporarily allow onion, garlic, mushrooms, tomato',
      newRestrictions: { exclusions: relaxedExclusions }
    })
  }

  // 3. Calorie range relaxation
  if (options?.calorieRange?.max) {
    suggestions.push({
      step: 'calories',
      description: 'Widen calorie range',
      action: `Allow up to ${Math.floor(options.calorieRange.max * 1.2)} calories`,
      newRestrictions: {},
      newOptions: {
        ...options,
        calorieRange: {
          ...options.calorieRange,
          max: Math.floor(options.calorieRange.max * 1.2)
        }
      }
    })
  }

  // 4. Diet relaxation (keeping allergies)
  if (restrictions.diets.length > 0 && restrictions.diets[0] !== 'none') {
    suggestions.push({
      step: 'diet',
      description: 'Temporarily ignore diet restrictions',
      action: 'Show all recipes (keeping allergies)',
      newRestrictions: { diets: ['none'] }
    })
  }

  return suggestions
}

/**
 * Apply relaxation step to restrictions
 * Pure function returning new restrictions object
 */
export function applyRelaxation(
  restrictions: DietaryRestrictions,
  options: any,
  relaxationStep: string
): { restrictions: DietaryRestrictions; options: any } {
  const suggestions = getRelaxationSuggestions(restrictions, options)
  const suggestion = suggestions.find(s => s.step === relaxationStep)

  if (!suggestion) {
    return { restrictions, options }
  }

  return {
    restrictions: {
      ...restrictions,
      ...suggestion.newRestrictions
    },
    options: suggestion.newOptions || options
  }
}