import { NutrientVector } from '@domain/models'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

interface OpenFoodFactsProduct {
  product?: {
    product_name?: string
    brands?: string
    ingredients_text?: string
    allergens?: string
    serving_size?: string
    nutrition_grade_fr?: string
    nova_group?: number

    // Nutritional values per 100g
    nutriments?: {
      'energy-kj_100g'?: number
      'energy-kcal_100g'?: number
      'carbohydrates_100g'?: number
      'proteins_100g'?: number
      'fat_100g'?: number
      'saturated-fat_100g'?: number
      'monounsaturated-fat_100g'?: number
      'polyunsaturated-fat_100g'?: number
      'trans-fat_100g'?: number
      'cholesterol_100g'?: number
      'sugars_100g'?: number
      'fiber_100g'?: number
      'sodium_100g'?: number
      'salt_100g'?: number
      'potassium_100g'?: number
      'calcium_100g'?: number
      'iron_100g'?: number
      'magnesium_100g'?: number
      'zinc_100g'?: number
      'phosphorus_100g'?: number
      'vitamin-a_100g'?: number
      'vitamin-c_100g'?: number
      'vitamin-d_100g'?: number
      'vitamin-e_100g'?: number
      'vitamin-k_100g'?: number
      'vitamin-b1_100g'?: number
      'vitamin-b2_100g'?: number
      'vitamin-b3_100g'?: number
      'vitamin-b6_100g'?: number
      'vitamin-b9_100g'?: number
      'vitamin-b12_100g'?: number
      'choline_100g'?: number
    }

    // Serving size nutritional values
    serving_quantity?: number
    serving_size_unit?: string
  }
  status: number
  status_verbose?: string
}

export interface BarcodeProduct {
  barcode: string
  name: string
  brand?: string
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  ingredients?: string
  allergens?: string
  nutritionGrade?: string
  isProcessed?: boolean
  dataQuality: {
    isComplete: boolean
    isSuspicious: boolean
    warnings: string[]
  }
}

interface DataQualityAssessment {
  isComplete: boolean
  isSuspicious: boolean
  warnings: string[]
}

const OPEN_FOOD_FACTS_API = 'https://world.openfoodfacts.org/api/v2'

export class BarcodeAdapter {
  private cache = new Map<string, { product: BarcodeProduct; timestamp: number }>()
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours for barcode data

  async lookup(barcode: string): Promise<BarcodeProduct | null> {
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      logger.warn('Invalid barcode format', { barcode })
      return null
    }

    // Check cache first
    const cached = this.getCachedProduct(barcode)
    if (cached) {
      logger.debug('Returning cached barcode product', { barcode })
      return cached
    }

    try {
      const response = await fetch(`${OPEN_FOOD_FACTS_API}/product/${barcode}.json`, {
        headers: {
          'User-Agent': 'MacroMuse/1.0.0 (nutrition tracker app)'
        }
      })

      if (!response.ok) {
        logger.warn('Open Food Facts API error', { barcode, status: response.status })
        return null
      }

      const data: OpenFoodFactsProduct = await response.json()

      if (data.status !== 1 || !data.product) {
        logger.info('Product not found in Open Food Facts', { barcode })
        return null
      }

      const product = this.normalizeProduct(barcode, data.product)

      // Cache the result
      this.setCachedProduct(barcode, product)

      // Emit events
      eventBus.emit('food_search_completed', {
        query: barcode,
        results: [],
        source: 'barcode'
      })

      eventBus.emit('food_data_cached', {
        foodId: barcode,
        source: 'barcode',
        nutrients: product.nutrients
      })

      logger.info('Barcode lookup successful', {
        barcode,
        productName: product.name,
        dataQuality: product.dataQuality
      })

      return product

    } catch (error) {
      logger.error('Barcode lookup failed', { barcode, error })
      return null
    }
  }

  private normalizeProduct(barcode: string, product: OpenFoodFactsProduct['product']): BarcodeProduct {
    if (!product) {
      throw new Error('Product data is required for normalization')
    }

    const nutrients = this.normalizeNutrients(product.nutriments || {})
    const dataQuality = this.assessDataQuality(product, nutrients)

    return {
      barcode,
      name: product.product_name || 'Unknown Product',
      brand: product.brands || undefined,
      nutrients,
      servingSize: this.determineServingSize(product),
      ingredients: product.ingredients_text || undefined,
      allergens: product.allergens || undefined,
      nutritionGrade: product.nutrition_grade_fr || undefined,
      isProcessed: product.nova_group ? product.nova_group >= 3 : undefined,
      dataQuality
    }
  }

  private normalizeNutrients(nutriments: NonNullable<OpenFoodFactsProduct['product']>['nutriments']): NutrientVector {
    if (!nutriments) return {}

    const normalized: NutrientVector = {}

    // Energy (prefer kcal, fallback to kJ conversion)
    if (nutriments['energy-kcal_100g'] !== undefined) {
      normalized.calories = nutriments['energy-kcal_100g']
    } else if (nutriments['energy-kj_100g'] !== undefined) {
      normalized.calories = Math.round(nutriments['energy-kj_100g'] / 4.184) // kJ to kcal
    }

    // Macronutrients
    if (nutriments.proteins_100g !== undefined) {
      normalized.protein_g = nutriments.proteins_100g
    }
    if (nutriments.carbohydrates_100g !== undefined) {
      normalized.carbs_g = nutriments.carbohydrates_100g
    }
    if (nutriments.fat_100g !== undefined) {
      normalized.fat_g = nutriments.fat_100g
    }
    if (nutriments.fiber_100g !== undefined) {
      normalized.fiber_g = nutriments.fiber_100g
    }

    // Fat types
    if (nutriments['saturated-fat_100g'] !== undefined) {
      normalized.saturatedFat_g = nutriments['saturated-fat_100g']
    }
    if (nutriments['monounsaturated-fat_100g'] !== undefined) {
      normalized.monounsaturatedFat_g = nutriments['monounsaturated-fat_100g']
    }
    if (nutriments['polyunsaturated-fat_100g'] !== undefined) {
      normalized.polyunsaturatedFat_g = nutriments['polyunsaturated-fat_100g']
    }
    if (nutriments['trans-fat_100g'] !== undefined) {
      normalized.transFat_g = nutriments['trans-fat_100g']
    }
    if (nutriments.cholesterol_100g !== undefined) {
      normalized.cholesterol_mg = nutriments.cholesterol_100g
    }

    // Sugars
    if (nutriments.sugars_100g !== undefined) {
      normalized.totalSugars_g = nutriments.sugars_100g
    }

    // Sodium (convert from salt if needed)
    if (nutriments.sodium_100g !== undefined) {
      normalized.sodium_mg = nutriments.sodium_100g * 1000 // g to mg
    } else if (nutriments.salt_100g !== undefined) {
      // Convert salt to sodium (salt = sodium * 2.5)
      normalized.sodium_mg = (nutriments.salt_100g / 2.5) * 1000
    }

    // Minerals (convert g to mg/μg as needed)
    if (nutriments.potassium_100g !== undefined) {
      normalized.potassium_mg = nutriments.potassium_100g * 1000
    }
    if (nutriments.calcium_100g !== undefined) {
      normalized.calcium_mg = nutriments.calcium_100g * 1000
    }
    if (nutriments.iron_100g !== undefined) {
      normalized.iron_mg = nutriments.iron_100g * 1000
    }
    if (nutriments.magnesium_100g !== undefined) {
      normalized.magnesium_mg = nutriments.magnesium_100g * 1000
    }
    if (nutriments.zinc_100g !== undefined) {
      normalized.zinc_mg = nutriments.zinc_100g * 1000
    }
    if (nutriments.phosphorus_100g !== undefined) {
      normalized.phosphorus_mg = nutriments.phosphorus_100g * 1000
    }

    // Vitamins (convert to appropriate units)
    if (nutriments['vitamin-a_100g'] !== undefined) {
      normalized.vitaminA_µg = nutriments['vitamin-a_100g'] * 1000000 // g to μg
    }
    if (nutriments['vitamin-c_100g'] !== undefined) {
      normalized.vitaminC_mg = nutriments['vitamin-c_100g'] * 1000 // g to mg
    }
    if (nutriments['vitamin-d_100g'] !== undefined) {
      normalized.vitaminD_µg = nutriments['vitamin-d_100g'] * 1000000 // g to μg
    }
    if (nutriments['vitamin-e_100g'] !== undefined) {
      normalized.vitaminE_mg = nutriments['vitamin-e_100g'] * 1000 // g to mg
    }
    if (nutriments['vitamin-k_100g'] !== undefined) {
      normalized.vitaminK_µg = nutriments['vitamin-k_100g'] * 1000000 // g to μg
    }

    // B Vitamins
    if (nutriments['vitamin-b1_100g'] !== undefined) {
      normalized.thiaminB1_mg = nutriments['vitamin-b1_100g'] * 1000
    }
    if (nutriments['vitamin-b2_100g'] !== undefined) {
      normalized.riboflavinB2_mg = nutriments['vitamin-b2_100g'] * 1000
    }
    if (nutriments['vitamin-b3_100g'] !== undefined) {
      normalized.niacinB3_mg = nutriments['vitamin-b3_100g'] * 1000
    }
    if (nutriments['vitamin-b6_100g'] !== undefined) {
      normalized.vitaminB6_mg = nutriments['vitamin-b6_100g'] * 1000
    }
    if (nutriments['vitamin-b9_100g'] !== undefined) {
      normalized.folateB9_µg = nutriments['vitamin-b9_100g'] * 1000000
    }
    if (nutriments['vitamin-b12_100g'] !== undefined) {
      normalized.vitaminB12_µg = nutriments['vitamin-b12_100g'] * 1000000
    }
    if (nutriments.choline_100g !== undefined) {
      normalized.choline_mg = nutriments.choline_100g * 1000
    }

    return normalized
  }

  private determineServingSize(product: NonNullable<OpenFoodFactsProduct['product']>): { amount: number; unit: string } {
    // Try to extract serving size from serving_size field
    if (product.serving_size) {
      const match = product.serving_size.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/)
      if (match) {
        return {
          amount: parseFloat(match[1]),
          unit: match[2].toLowerCase()
        }
      }
    }

    // Try serving_quantity and serving_size_unit
    if (product.serving_quantity && product.serving_size_unit) {
      return {
        amount: product.serving_quantity,
        unit: product.serving_size_unit
      }
    }

    // Default to 100g
    return {
      amount: 100,
      unit: 'g'
    }
  }

  private assessDataQuality(
    product: NonNullable<OpenFoodFactsProduct['product']>,
    nutrients: NutrientVector
  ): DataQualityAssessment {
    const warnings: string[] = []
    let isComplete = true
    let isSuspicious = false

    // Check for basic nutritional completeness
    const requiredNutrients = ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const
    const missingNutrients = requiredNutrients.filter(nutrient =>
      nutrients[nutrient] === undefined || nutrients[nutrient] === null
    )

    if (missingNutrients.length > 0) {
      isComplete = false
      warnings.push(`Missing basic nutrients: ${missingNutrients.join(', ')}`)
    }

    // Detect suspicious nutritional data
    const calories = nutrients.calories || 0
    const protein = nutrients.protein_g || 0
    const carbs = nutrients.carbs_g || 0
    const fat = nutrients.fat_g || 0

    // Calculate expected calories from macros
    const expectedCalories = (protein * 4) + (carbs * 4) + (fat * 9)
    const calorieDiscrepancy = Math.abs(calories - expectedCalories)

    if (calories > 0 && expectedCalories > 0 && calorieDiscrepancy > calories * 0.2) {
      isSuspicious = true
      warnings.push('Calorie count doesn\'t match macronutrient breakdown')
    }

    // Flag zero calories for high-calorie foods (based on fat content)
    if (calories === 0 && fat > 10) {
      isSuspicious = true
      warnings.push('Zero calories claimed for high-fat product')
    }

    // Flag unrealistic values
    if (calories > 900) { // Very high calorie density
      isSuspicious = true
      warnings.push('Unusually high calorie density')
    }

    if ((protein + carbs + fat) > 110) { // Macros sum to more than 110% (allowing for rounding)
      isSuspicious = true
      warnings.push('Macronutrients sum exceeds 100% of product weight')
    }

    // Check for incomplete product information
    if (!product.product_name || product.product_name.trim().length < 3) {
      warnings.push('Product name is missing or incomplete')
    }

    if (!product.ingredients_text) {
      warnings.push('Ingredients list is missing')
    }

    return {
      isComplete,
      isSuspicious,
      warnings
    }
  }

  private getCachedProduct(barcode: string): BarcodeProduct | null {
    const cached = this.cache.get(barcode)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(barcode)
      return null
    }

    return cached.product
  }

  private setCachedProduct(barcode: string, product: BarcodeProduct): void {
    this.cache.set(barcode, {
      product,
      timestamp: Date.now()
    })
  }

  // Cleanup expired cache entries
  cleanupCache(): void {
    const now = Date.now()
    for (const [barcode, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(barcode)
      }
    }
  }
}