// domain/services/DietaryFilterService.ts - Pure dietary filtering functions
// Extracted from legacy services and adapted to Foundation architecture

import type {
  DietaryRestrictions,
  DietaryFlags,
  FilteredFoodResult,
  SpoonacularQuery
} from '@domain/models/dietary'
import type { NutrientVector } from '@domain/models/nutrients'
import {
  getDietExclusions,
  getAllergenExclusions,
  expandSynonyms,
  normalizeName,
  EXCLUDE_SYNONYMS
} from './dietary-presets'

/**
 * Pure function to check if food item violates dietary restrictions
 * No side effects, can be cached, testable
 */
export function checkDietaryCompliance(
  food: {
    id: string
    name: string
    ingredients?: string[]
    nutrients?: Partial<NutrientVector>
  },
  restrictions: DietaryRestrictions
): DietaryFlags {
  const warnings: string[] = []
  let violatesRestrictions = false
  let confidence = 1.0

  // Early return if no restrictions
  if (restrictions.diets.length === 0 &&
      restrictions.allergies.length === 0 &&
      restrictions.exclusions.length === 0) {
    return { violatesRestrictions: false, warnings: [], confidence: 1.0 }
  }

  // Normalize food ingredients for matching
  const normalizedIngredients = (food.ingredients || [])
    .map(ingredient => normalizeName(ingredient))

  // Check diet exclusions
  restrictions.diets.forEach(diet => {
    const dietExclusions = getDietExclusions(diet, restrictions.strictFodmap)
    const violations = checkIngredientViolations(normalizedIngredients, dietExclusions)

    if (violations.length > 0) {
      violatesRestrictions = true
      warnings.push(`${diet} diet: contains ${violations.join(', ')}`)
    }
  })

  // Check allergen exclusions
  const allergenExclusions = getAllergenExclusions(restrictions.allergies)
  const allergenViolations = checkIngredientViolations(normalizedIngredients, allergenExclusions)

  if (allergenViolations.length > 0) {
    violatesRestrictions = true
    warnings.push(`Allergen: contains ${allergenViolations.join(', ')}`)
  }

  // Check custom exclusions
  const customViolations = checkIngredientViolations(normalizedIngredients, restrictions.exclusions)

  if (customViolations.length > 0) {
    violatesRestrictions = true
    warnings.push(`Excluded: contains ${customViolations.join(', ')}`)
  }

  // Reduce confidence if ingredients list is incomplete
  if (!food.ingredients || food.ingredients.length === 0) {
    confidence = 0.3
    warnings.push('Warning: No ingredient list available for analysis')
  } else if (food.ingredients.length < 3) {
    confidence = 0.6
    warnings.push('Warning: Limited ingredient information available')
  }

  return {
    violatesRestrictions,
    warnings,
    confidence
  }
}

/**
 * Check for violations between ingredient lists
 * Pure function with synonym expansion
 */
function checkIngredientViolations(
  ingredients: string[],
  exclusions: string[]
): string[] {
  const violations: string[] = []

  exclusions.forEach(exclusion => {
    const normalizedExclusion = normalizeName(exclusion)
    const synonyms = expandSynonyms(normalizedExclusion)

    // Check if any ingredient matches exclusion or its synonyms
    const matchingIngredient = ingredients.find(ingredient =>
      synonyms.some(synonym =>
        ingredient.includes(synonym) || synonym.includes(ingredient)
      )
    )

    if (matchingIngredient) {
      violations.push(exclusion)
    }
  })

  return violations
}

/**
 * Filter array of foods by dietary restrictions
 * Pure function - no side effects
 */
export function filterFoodsByDiet(
  foods: Array<{
    id: string
    name: string
    source: 'usda' | 'spoonacular' | 'barcode' | 'custom'
    ingredients?: string[]
    nutrients?: Partial<NutrientVector>
  }>,
  restrictions: DietaryRestrictions
): FilteredFoodResult[] {

  return foods.map(food => {
    const dietaryFlags = checkDietaryCompliance(food, restrictions)

    return {
      id: food.id,
      name: food.name,
      source: food.source,
      dietaryFlags,
      nutrients: {
        calories: food.nutrients?.calories,
        protein_g: food.nutrients?.protein_g,
        carbs_g: food.nutrients?.carbs_g,
        fat_g: food.nutrients?.fat_g,
        fiber_g: food.nutrients?.fiber_g
      }
    }
  }).filter(result => !result.dietaryFlags.violatesRestrictions)
}

/**
 * Build comprehensive exclusion list from restrictions
 * Pure function for Spoonacular API integration
 */
export function buildExclusionsList(restrictions: DietaryRestrictions): string[] {
  const excludes = new Set<string>()

  // Add diet-implied exclusions
  restrictions.diets.forEach(diet => {
    const dietExclusions = getDietExclusions(diet, restrictions.strictFodmap)
    dietExclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))
  })

  // Add allergen exclusions
  const allergenExclusions = getAllergenExclusions(restrictions.allergies)
  allergenExclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))

  // Add custom exclusions
  restrictions.exclusions.forEach(exclusion => excludes.add(normalizeName(exclusion)))

  // Expand all with synonyms
  const expandedExcludes = new Set<string>()
  Array.from(excludes).forEach(exclude => {
    const synonyms = expandSynonyms(exclude)
    synonyms.forEach(synonym => expandedExcludes.add(synonym))
  })

  return Array.from(expandedExcludes).sort()
}

/**
 * Validate restrictions for potential issues
 * Pure function returning validation warnings
 */
export function validateRestrictions(restrictions: DietaryRestrictions): string[] {
  const warnings: string[] = []

  // Check for conflicting diets
  if (restrictions.diets.includes('vegan') && restrictions.diets.includes('pescatarian')) {
    warnings.push('Conflicting diets: vegan and pescatarian cannot be combined')
  }

  if (restrictions.diets.includes('ketogenic') && restrictions.diets.includes('low-fodmap')) {
    warnings.push('Warning: ketogenic + low-fodmap is very restrictive')
  }

  // Check for excessive restrictions
  if (restrictions.allergies.length > 5) {
    warnings.push('Many allergies may severely limit food options')
  }

  if (restrictions.exclusions.length > 15) {
    warnings.push('Many excluded ingredients may severely limit food options')
  }

  // Check for redundant restrictions
  if (restrictions.allergies.includes('gluten') && restrictions.allergies.includes('wheat')) {
    warnings.push('Redundant: wheat allergy covers gluten intolerance')
  }

  if (restrictions.diets.includes('vegan') && restrictions.allergies.includes('dairy')) {
    warnings.push('Redundant: vegan diet already excludes dairy')
  }

  return warnings
}

/**
 * Calculate restriction "score" for ranking food matches
 * Pure function returning 0-1 score (higher = better match)
 */
export function calculateDietScore(
  food: {
    name: string
    ingredients?: string[]
    nutrients?: Partial<NutrientVector>
  },
  restrictions: DietaryRestrictions
): number {
  const flags = checkDietaryCompliance(food, restrictions)

  if (flags.violatesRestrictions) {
    return 0
  }

  let score = flags.confidence

  // Boost score for foods that align with preferences
  if (restrictions.preferences.includes('organic_preferred') &&
      food.name.toLowerCase().includes('organic')) {
    score = Math.min(1.0, score + 0.1)
  }

  if (restrictions.preferences.includes('minimal_processing') &&
      food.name.toLowerCase().includes('raw') ||
      food.name.toLowerCase().includes('fresh')) {
    score = Math.min(1.0, score + 0.1)
  }

  // Penalize for warnings
  const warningPenalty = flags.warnings.length * 0.05
  score = Math.max(0, score - warningPenalty)

  return score
}