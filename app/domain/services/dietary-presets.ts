// domain/services/dietary-presets.ts - Diet exclusions and allergen data
// Extracted from legacy presets.ts and adapted to Foundation architecture

import type { DietType, AllergenType } from '@domain/models/dietary'

/**
 * Diet exclusion mappings - extracted from legacy
 * Maps diet types to ingredients that should be excluded
 */
export const DIET_EXCLUDES: Record<DietType, string[]> = {
  'vegan': ['gelatin', 'whey', 'casein', 'lactose', 'egg', 'meat', 'fish', 'shellfish', 'honey'],
  'vegetarian': ['gelatin', 'meat', 'fish', 'shellfish'],
  'pescatarian': ['beef', 'pork', 'chicken', 'lamb'],
  'ketogenic': ['sugar', 'corn syrup', 'wheat flour', 'white rice', 'maple syrup'],
  'paleo': ['legumes', 'peanuts', 'beans', 'grains', 'wheat', 'rice', 'dairy'],
  'primal': ['legumes', 'peanuts', 'beans', 'grains', 'wheat', 'rice'],
  'low-fodmap': [], // Rely on strictFodmap flag + FODMAP_STRICT_EXCLUDES
  'whole30': ['added sugar', 'alcohol', 'grains', 'legumes', 'dairy'],
  'none': []
}

/**
 * Gluten-free exclusions
 */
export const GLUTEN_FREE_EXCLUDES = ['barley', 'rye', 'farro', 'spelt']

/**
 * Strict FODMAP exclusions for enhanced low-FODMAP filtering
 */
export const FODMAP_STRICT_EXCLUDES = [
  'onion', 'garlic', 'wheat flour', 'honey', 'agave', 'apples', 'pears',
  'cauliflower', 'kidney beans'
]

/**
 * Common ingredient synonyms for better matching
 * Extracted from legacy synonym mappings
 */
export const EXCLUDE_SYNONYMS: Record<string, string[]> = {
  'cilantro': ['coriander leaf'],
  'scallion': ['green onion', 'spring onion'],
  'chickpea': ['garbanzo'],
  'bell pepper': ['capsicum'],
  'zucchini': ['courgette'],
  'eggplant': ['aubergine'],
  'shrimp': ['prawns'],
  'lima bean': ['butter bean'],
  'snap pea': ['sugar snap pea'],
  'snow pea': ['mangetout'],
  'corn': ['maize'],
  'sweet potato': ['yam'],
  'arugula': ['rocket'],
  'endive': ['chicory'],
  'bok choy': ['pak choi'],
  'chinese cabbage': ['napa cabbage'],
}

/**
 * Common exclusions (top 20) for UI selection
 */
export const COMMON_EXCLUDES_20 = [
  'onion', 'garlic', 'cilantro', 'mushrooms', 'olives', 'capers',
  'bell pepper', 'tomato', 'eggplant', 'zucchini', 'celery', 'cucumber',
  'broccoli', 'cauliflower', 'brussels sprouts', 'spinach', 'kale',
  'nuts', 'seeds', 'cheese'
]

/**
 * Allergen definitions with Spoonacular API mapping
 * Extracted from legacy allergen database
 */
export interface AllergenDefinition {
  name: string
  displayName: string
  description: string
  spoonacularName: string
  severity: 'mild' | 'moderate' | 'severe'
}

export const ALLERGEN_DEFINITIONS: Record<AllergenType, AllergenDefinition> = {
  'dairy': {
    name: 'dairy',
    displayName: 'Dairy',
    description: 'Milk and dairy products',
    spoonacularName: 'dairy',
    severity: 'moderate'
  },
  'eggs': {
    name: 'eggs',
    displayName: 'Eggs',
    description: 'Chicken eggs and egg products',
    spoonacularName: 'egg',
    severity: 'severe'
  },
  'gluten': {
    name: 'gluten',
    displayName: 'Gluten',
    description: 'Gluten intolerance or celiac disease',
    spoonacularName: 'gluten',
    severity: 'severe'
  },
  'grain': {
    name: 'grain',
    displayName: 'Grains',
    description: 'All grains',
    spoonacularName: 'grain',
    severity: 'moderate'
  },
  'peanuts': {
    name: 'peanuts',
    displayName: 'Peanuts',
    description: 'Peanut allergy',
    spoonacularName: 'peanut',
    severity: 'severe'
  },
  'fish': {
    name: 'fish',
    displayName: 'Fish',
    description: 'All fish',
    spoonacularName: 'seafood',
    severity: 'severe'
  },
  'seafood': {
    name: 'seafood',
    displayName: 'Seafood',
    description: 'Fish and seafood allergy',
    spoonacularName: 'seafood',
    severity: 'severe'
  },
  'sesame': {
    name: 'sesame',
    displayName: 'Sesame',
    description: 'Sesame allergy',
    spoonacularName: 'sesame',
    severity: 'severe'
  },
  'shellfish': {
    name: 'shellfish',
    displayName: 'Shellfish',
    description: 'Shellfish allergy',
    spoonacularName: 'shellfish',
    severity: 'severe'
  },
  'soy': {
    name: 'soy',
    displayName: 'Soy',
    description: 'Soy allergy or intolerance',
    spoonacularName: 'soy',
    severity: 'moderate'
  },
  'tree_nuts': {
    name: 'tree_nuts',
    displayName: 'Tree Nuts',
    description: 'Tree nut allergies',
    spoonacularName: 'tree nut',
    severity: 'severe'
  },
  'wheat': {
    name: 'wheat',
    displayName: 'Wheat',
    description: 'Wheat allergy',
    spoonacularName: 'wheat',
    severity: 'severe'
  }
}

/**
 * Utility functions extracted from legacy
 */

/**
 * Expand ingredient name to include all synonyms
 * Pure function - no side effects
 */
export function expandSynonyms(ingredient: string): string[] {
  const normalized = ingredient.toLowerCase().trim()
  const synonyms = EXCLUDE_SYNONYMS[normalized] || []
  return [normalized, ...synonyms]
}

/**
 * Normalize ingredient name for consistent matching
 * Pure function - no side effects
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
}

/**
 * Get all exclusions for a diet type
 * Pure function - no side effects
 */
export function getDietExclusions(diet: DietType, strictFodmap: boolean = false): string[] {
  const baseExclusions = DIET_EXCLUDES[diet] || []

  if (diet === 'low-fodmap' && strictFodmap) {
    return [...baseExclusions, ...FODMAP_STRICT_EXCLUDES]
  }

  return baseExclusions
}

/**
 * Get all exclusions for allergen types
 * Pure function - no side effects
 */
export function getAllergenExclusions(allergens: AllergenType[]): string[] {
  return allergens.flatMap(allergen => {
    const definition = ALLERGEN_DEFINITIONS[allergen]
    return definition ? [definition.name] : []
  })
}