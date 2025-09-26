import { NutrientVector, FoodItem } from '@domain/models'
import { logger } from '@lib/logger'

export interface PortionCalculatorService {
  calculateNutrients(baseNutrients: NutrientVector, fromAmount: number, toAmount: number, fromUnit: string, toUnit: string): NutrientVector
  getCommonServingSizes(foodType: string): ServingSize[]
  convertUnits(amount: number, fromUnit: string, toUnit: string): number | null
  suggestServingSizes(food: FoodItem): ServingSize[]
  calculateCaloriesFromMacros(protein: number, carbs: number, fat: number): number
}

export interface ServingSize {
  label: string
  amount: number
  unit: string
  category: 'metric' | 'imperial' | 'common'
  description?: string
}

// Common serving sizes by food category
const SERVING_SIZES_BY_TYPE: Record<string, ServingSize[]> = {
  'fruit': [
    { label: '1 small', amount: 100, unit: 'g', category: 'common', description: 'Small apple, orange' },
    { label: '1 medium', amount: 150, unit: 'g', category: 'common', description: 'Medium apple, orange' },
    { label: '1 large', amount: 200, unit: 'g', category: 'common', description: 'Large apple, orange' },
    { label: '1 cup chopped', amount: 150, unit: 'g', category: 'common' },
    { label: '1/2 cup', amount: 75, unit: 'g', category: 'common' }
  ],
  'vegetable': [
    { label: '1 cup raw', amount: 100, unit: 'g', category: 'common' },
    { label: '1/2 cup cooked', amount: 75, unit: 'g', category: 'common' },
    { label: '1 medium', amount: 120, unit: 'g', category: 'common', description: 'Medium carrot, bell pepper' },
    { label: '1 small', amount: 80, unit: 'g', category: 'common' }
  ],
  'grain': [
    { label: '1 slice bread', amount: 30, unit: 'g', category: 'common' },
    { label: '1/2 cup cooked', amount: 100, unit: 'g', category: 'common', description: 'Rice, pasta, quinoa' },
    { label: '1 cup cooked', amount: 200, unit: 'g', category: 'common' },
    { label: '1 oz dry', amount: 30, unit: 'g', category: 'common' }
  ],
  'protein': [
    { label: '1 oz', amount: 30, unit: 'g', category: 'common' },
    { label: '3 oz', amount: 85, unit: 'g', category: 'common', description: 'Deck of cards size' },
    { label: '4 oz', amount: 115, unit: 'g', category: 'common', description: 'Palm size' },
    { label: '6 oz', amount: 170, unit: 'g', category: 'common' },
    { label: '1 egg', amount: 50, unit: 'g', category: 'common' }
  ],
  'dairy': [
    { label: '1 cup', amount: 240, unit: 'ml', category: 'common' },
    { label: '1/2 cup', amount: 120, unit: 'ml', category: 'common' },
    { label: '1 oz cheese', amount: 30, unit: 'g', category: 'common' },
    { label: '1 slice cheese', amount: 20, unit: 'g', category: 'common' },
    { label: '1 tbsp', amount: 15, unit: 'ml', category: 'common' }
  ],
  'nuts_seeds': [
    { label: '1 oz', amount: 30, unit: 'g', category: 'common', description: 'Small handful' },
    { label: '1 tbsp', amount: 15, unit: 'g', category: 'common' },
    { label: '1/4 cup', amount: 30, unit: 'g', category: 'common' },
    { label: '12 almonds', amount: 15, unit: 'g', category: 'common' },
    { label: '6 walnut halves', amount: 15, unit: 'g', category: 'common' }
  ],
  'beverage': [
    { label: '1 cup', amount: 240, unit: 'ml', category: 'common' },
    { label: '1 glass', amount: 200, unit: 'ml', category: 'common' },
    { label: '1 bottle', amount: 500, unit: 'ml', category: 'common' },
    { label: '1 can', amount: 355, unit: 'ml', category: 'common' },
    { label: '1 shot', amount: 30, unit: 'ml', category: 'common' }
  ],
  'default': [
    { label: '1 tbsp', amount: 15, unit: 'g', category: 'common' },
    { label: '1/4 cup', amount: 60, unit: 'g', category: 'common' },
    { label: '1/2 cup', amount: 120, unit: 'g', category: 'common' },
    { label: '1 cup', amount: 240, unit: 'g', category: 'common' },
    { label: '1 oz', amount: 30, unit: 'g', category: 'common' }
  ]
}

// Standard metric and imperial conversions
const UNIVERSAL_SERVING_SIZES: ServingSize[] = [
  // Metric weight
  { label: '1 g', amount: 1, unit: 'g', category: 'metric' },
  { label: '5 g', amount: 5, unit: 'g', category: 'metric' },
  { label: '10 g', amount: 10, unit: 'g', category: 'metric' },
  { label: '25 g', amount: 25, unit: 'g', category: 'metric' },
  { label: '50 g', amount: 50, unit: 'g', category: 'metric' },
  { label: '100 g', amount: 100, unit: 'g', category: 'metric' },
  { label: '250 g', amount: 250, unit: 'g', category: 'metric' },
  { label: '500 g', amount: 500, unit: 'g', category: 'metric' },

  // Metric volume
  { label: '1 ml', amount: 1, unit: 'ml', category: 'metric' },
  { label: '5 ml', amount: 5, unit: 'ml', category: 'metric' },
  { label: '15 ml', amount: 15, unit: 'ml', category: 'metric' },
  { label: '30 ml', amount: 30, unit: 'ml', category: 'metric' },
  { label: '50 ml', amount: 50, unit: 'ml', category: 'metric' },
  { label: '100 ml', amount: 100, unit: 'ml', category: 'metric' },
  { label: '250 ml', amount: 250, unit: 'ml', category: 'metric' },
  { label: '500 ml', amount: 500, unit: 'ml', category: 'metric' },

  // Imperial weight
  { label: '1/4 oz', amount: 7, unit: 'g', category: 'imperial' },
  { label: '1/2 oz', amount: 14, unit: 'g', category: 'imperial' },
  { label: '1 oz', amount: 28, unit: 'g', category: 'imperial' },
  { label: '2 oz', amount: 57, unit: 'g', category: 'imperial' },
  { label: '4 oz', amount: 113, unit: 'g', category: 'imperial' },
  { label: '8 oz', amount: 227, unit: 'g', category: 'imperial' },
  { label: '1 lb', amount: 454, unit: 'g', category: 'imperial' },

  // Imperial volume
  { label: '1 tsp', amount: 5, unit: 'ml', category: 'imperial' },
  { label: '1 tbsp', amount: 15, unit: 'ml', category: 'imperial' },
  { label: '1/4 cup', amount: 60, unit: 'ml', category: 'imperial' },
  { label: '1/3 cup', amount: 80, unit: 'ml', category: 'imperial' },
  { label: '1/2 cup', amount: 120, unit: 'ml', category: 'imperial' },
  { label: '3/4 cup', amount: 180, unit: 'ml', category: 'imperial' },
  { label: '1 cup', amount: 240, unit: 'ml', category: 'imperial' },
  { label: '1 pint', amount: 473, unit: 'ml', category: 'imperial' },
  { label: '1 quart', amount: 946, unit: 'ml', category: 'imperial' }
]

// Unit conversion factors to grams/ml
const UNIT_CONVERSIONS: Record<string, { factor: number; type: 'weight' | 'volume' }> = {
  // Weight units
  'g': { factor: 1, type: 'weight' },
  'kg': { factor: 1000, type: 'weight' },
  'oz': { factor: 28.35, type: 'weight' },
  'lb': { factor: 453.6, type: 'weight' },

  // Volume units
  'ml': { factor: 1, type: 'volume' },
  'l': { factor: 1000, type: 'volume' },
  'fl oz': { factor: 29.57, type: 'volume' },
  'cup': { factor: 240, type: 'volume' },
  'tbsp': { factor: 15, type: 'volume' },
  'tsp': { factor: 5, type: 'volume' },
  'pint': { factor: 473, type: 'volume' },
  'quart': { factor: 946, type: 'volume' },
  'gallon': { factor: 3785, type: 'volume' }
}

export class PortionCalculatorServiceImpl implements PortionCalculatorService {
  calculateNutrients(
    baseNutrients: NutrientVector,
    fromAmount: number,
    toAmount: number,
    fromUnit: string,
    toUnit: string
  ): NutrientVector {
    try {
      // Convert both amounts to the same base unit
      const baseFromAmount = this.convertToBaseUnit(fromAmount, fromUnit)
      const baseToAmount = this.convertToBaseUnit(toAmount, toUnit)

      if (baseFromAmount === null || baseToAmount === null) {
        logger.warn('Unit conversion failed', { fromAmount, fromUnit, toAmount, toUnit })
        return baseNutrients
      }

      // Calculate ratio
      const ratio = baseToAmount / baseFromAmount

      // Apply ratio to all nutrients
      const scaledNutrients: Partial<NutrientVector> = {}

      Object.entries(baseNutrients).forEach(([key, value]) => {
        if (typeof value === 'number') {
          scaledNutrients[key as keyof NutrientVector] = Math.round((value * ratio) * 100) / 100
        }
      })

      return scaledNutrients as NutrientVector

    } catch (error) {
      logger.error('Failed to calculate nutrients', { fromAmount, fromUnit, toAmount, toUnit, error })
      return baseNutrients
    }
  }

  getCommonServingSizes(foodType: string): ServingSize[] {
    const specificSizes = SERVING_SIZES_BY_TYPE[foodType] || SERVING_SIZES_BY_TYPE['default']

    // Combine specific sizes with universal sizes
    return [...specificSizes, ...UNIVERSAL_SERVING_SIZES]
      .sort((a, b) => {
        // Sort by category priority, then by amount
        const categoryOrder = { 'common': 0, 'metric': 1, 'imperial': 2 }
        const categoryDiff = categoryOrder[a.category] - categoryOrder[b.category]
        if (categoryDiff !== 0) return categoryDiff

        // Convert to base units for comparison
        const aBase = this.convertToBaseUnit(a.amount, a.unit) || 0
        const bBase = this.convertToBaseUnit(b.amount, b.unit) || 0
        return aBase - bBase
      })
  }

  convertUnits(amount: number, fromUnit: string, toUnit: string): number | null {
    try {
      const fromConversion = UNIT_CONVERSIONS[fromUnit.toLowerCase()]
      const toConversion = UNIT_CONVERSIONS[toUnit.toLowerCase()]

      if (!fromConversion || !toConversion) {
        return null
      }

      // Can only convert within the same type (weight to weight, volume to volume)
      if (fromConversion.type !== toConversion.type) {
        return null
      }

      // Convert to base unit, then to target unit
      const baseAmount = amount * fromConversion.factor
      const convertedAmount = baseAmount / toConversion.factor

      return Math.round(convertedAmount * 1000) / 1000 // Round to 3 decimal places

    } catch (error) {
      logger.error('Unit conversion failed', { amount, fromUnit, toUnit, error })
      return null
    }
  }

  suggestServingSizes(food: FoodItem): ServingSize[] {
    try {
      // Determine food type based on name and source
      const foodType = this.categorizeFoodType(food)

      // Get common serving sizes for this food type
      let suggestions = this.getCommonServingSizes(foodType)

      // Add the food's original serving size if it's not already included
      const originalServing: ServingSize = {
        label: `1 ${food.servingSize.unit}`,
        amount: food.servingSize.amount,
        unit: food.servingSize.unit,
        category: 'common',
        description: 'Original serving size'
      }

      const hasOriginal = suggestions.some(s =>
        s.amount === originalServing.amount && s.unit === originalServing.unit
      )

      if (!hasOriginal) {
        suggestions.unshift(originalServing)
      }

      // Limit to reasonable number of suggestions
      return suggestions.slice(0, 12)

    } catch (error) {
      logger.error('Failed to suggest serving sizes', { foodId: food.id, error })
      return UNIVERSAL_SERVING_SIZES.slice(0, 8)
    }
  }

  calculateCaloriesFromMacros(protein: number, carbs: number, fat: number): number {
    return Math.round(((protein * 4) + (carbs * 4) + (fat * 9)) * 100) / 100
  }

  private convertToBaseUnit(amount: number, unit: string): number | null {
    const conversion = UNIT_CONVERSIONS[unit.toLowerCase()]
    return conversion ? amount * conversion.factor : null
  }

  private categorizeFoodType(food: FoodItem): string {
    const name = food.name.toLowerCase()
    const ingredients = food.ingredients?.toLowerCase() || ''

    // Simple categorization based on keywords
    if (name.includes('apple') || name.includes('banana') || name.includes('orange') ||
        name.includes('berry') || name.includes('fruit') || name.includes('grape')) {
      return 'fruit'
    }

    if (name.includes('carrot') || name.includes('broccoli') || name.includes('spinach') ||
        name.includes('vegetable') || name.includes('lettuce') || name.includes('pepper')) {
      return 'vegetable'
    }

    if (name.includes('bread') || name.includes('rice') || name.includes('pasta') ||
        name.includes('cereal') || name.includes('oat') || name.includes('grain')) {
      return 'grain'
    }

    if (name.includes('chicken') || name.includes('beef') || name.includes('fish') ||
        name.includes('egg') || name.includes('turkey') || name.includes('protein') ||
        name.includes('meat') || name.includes('tofu')) {
      return 'protein'
    }

    if (name.includes('milk') || name.includes('cheese') || name.includes('yogurt') ||
        name.includes('dairy') || name.includes('cream')) {
      return 'dairy'
    }

    if (name.includes('almond') || name.includes('walnut') || name.includes('peanut') ||
        name.includes('seed') || name.includes('nut')) {
      return 'nuts_seeds'
    }

    if (name.includes('juice') || name.includes('soda') || name.includes('coffee') ||
        name.includes('tea') || name.includes('water') || name.includes('drink') ||
        name.includes('beverage') || food.servingSize.unit === 'ml' || food.servingSize.unit === 'fl oz') {
      return 'beverage'
    }

    return 'default'
  }

  // Utility method to get all available units
  getAvailableUnits(): { weight: string[]; volume: string[] } {
    const weight: string[] = []
    const volume: string[] = []

    Object.entries(UNIT_CONVERSIONS).forEach(([unit, { type }]) => {
      if (type === 'weight') {
        weight.push(unit)
      } else {
        volume.push(unit)
      }
    })

    return { weight, volume }
  }

  // Quick conversion helpers
  gramsToOunces(grams: number): number {
    return Math.round((grams / 28.35) * 100) / 100
  }

  ouncesToGrams(ounces: number): number {
    return Math.round((ounces * 28.35) * 100) / 100
  }

  mlToFlOz(ml: number): number {
    return Math.round((ml / 29.57) * 100) / 100
  }

  flOzToMl(flOz: number): number {
    return Math.round((flOz * 29.57) * 100) / 100
  }
}

// Singleton instance
export const portionCalculatorService = new PortionCalculatorServiceImpl()