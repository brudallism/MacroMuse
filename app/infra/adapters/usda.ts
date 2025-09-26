import { FoodSearchResult, NutrientVector } from '@domain/models'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

interface UsdaApiFood {
  fdcId: number
  description: string
  foodNutrients: Array<{
    nutrientId: number
    value: number
    unitName: string
  }>
  servingSize?: number
  servingSizeUnit?: string
}

interface UsdaSearchResponse {
  foods: UsdaApiFood[]
  totalHits: number
}

interface UsdaFoodResponse {
  fdcId: number
  description: string
  foodNutrients: Array<{
    nutrient: {
      id: number
      name: string
      unitName: string
    }
    amount: number
  }>
  servingSize?: number
  servingSizeUnit?: string
}

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1'
const DEFAULT_PAGE_SIZE = 25

const NUTRIENT_ID_MAP: Record<number, keyof NutrientVector> = {
  1008: 'calories',
  1003: 'protein_g',
  1005: 'carbs_g',
  1004: 'fat_g',
  1079: 'fiber_g',
  1258: 'saturatedFat_g',
  1292: 'monounsaturatedFat_g',
  1293: 'polyunsaturatedFat_g',
  1257: 'transFat_g',
  1253: 'cholesterol_mg',
  2000: 'totalSugars_g',
  1093: 'sodium_mg',
  1092: 'potassium_mg',
  1087: 'calcium_mg',
  1089: 'iron_mg',
  1090: 'magnesium_mg',
  1095: 'zinc_mg',
  1091: 'phosphorus_mg',
  1098: 'copper_mg',
  1101: 'manganese_mg',
  1103: 'selenium_µg',
  1106: 'vitaminA_µg',
  1162: 'vitaminC_mg',
  1114: 'vitaminD_µg',
  1109: 'vitaminE_mg',
  1185: 'vitaminK_µg',
  1165: 'thiaminB1_mg',
  1166: 'riboflavinB2_mg',
  1167: 'niacinB3_mg',
  1175: 'vitaminB6_mg',
  1177: 'folateB9_µg',
  1178: 'vitaminB12_µg',
  1170: 'pantothenicAcidB5_mg',
  1180: 'choline_mg'
}

export class UsdaAdapter {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('USDA API key is required')
    }
  }

  async search(query: string): Promise<FoodSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const cacheKey = `search:${query.toLowerCase()}`
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(`${USDA_API_BASE}/foods/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          query: query.trim(),
          dataType: ['Foundation', 'SR Legacy'],
          pageSize: DEFAULT_PAGE_SIZE,
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        })
      })

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('USDA API rate limit hit', { query })
          return []
        }
        throw new Error(`USDA API error: ${response.status}`)
      }

      const data: UsdaSearchResponse = await response.json()
      const results = this.normalizeSearchResults(data.foods, query)

      this.setCachedData(cacheKey, results)

      eventBus.emit('food_search_completed', {
        query,
        results,
        source: 'usda'
      })

      return results
    } catch (error) {
      logger.error('USDA search failed', { query, error })
      throw error
    }
  }

  async getFood(usdaId: string): Promise<NutrientVector> {
    const cacheKey = `food:${usdaId}`
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(`${USDA_API_BASE}/food/${usdaId}`, {
        headers: {
          'X-Api-Key': this.apiKey
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Food not found: ${usdaId}`)
        }
        if (response.status === 429) {
          logger.warn('USDA API rate limit hit', { usdaId })
          throw new Error('Rate limit exceeded')
        }
        throw new Error(`USDA API error: ${response.status}`)
      }

      const data: UsdaFoodResponse = await response.json()
      const nutrients = this.normalizeNutrients(data.foodNutrients)

      this.setCachedData(cacheKey, nutrients)

      eventBus.emit('food_data_cached', {
        foodId: usdaId,
        source: 'usda',
        nutrients
      })

      return nutrients
    } catch (error) {
      logger.error('USDA food fetch failed', { usdaId, error })
      throw error
    }
  }

  private normalizeSearchResults(foods: UsdaApiFood[], query: string): FoodSearchResult[] {
    return foods.map(food => {
      const nutrients = this.normalizeNutrientsFromSearch(food.foodNutrients)
      const confidence = this.calculateConfidence(food.description, query)

      return {
        id: food.fdcId.toString(),
        name: food.description,
        source: 'usda' as const,
        nutrients,
        servingSize: {
          amount: food.servingSize || 100,
          unit: food.servingSizeUnit || 'g'
        },
        confidence
      }
    }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  private normalizeNutrientsFromSearch(foodNutrients: UsdaApiFood['foodNutrients']): NutrientVector {
    const nutrients: NutrientVector = {}

    for (const nutrient of foodNutrients) {
      const key = NUTRIENT_ID_MAP[nutrient.nutrientId]
      if (key && nutrient.value != null) {
        nutrients[key] = nutrient.value
      }
    }

    return nutrients
  }

  private normalizeNutrients(foodNutrients: UsdaFoodResponse['foodNutrients']): NutrientVector {
    const nutrients: NutrientVector = {}

    for (const nutrient of foodNutrients) {
      const key = NUTRIENT_ID_MAP[nutrient.nutrient.id]
      if (key && nutrient.amount != null) {
        nutrients[key] = nutrient.amount
      }
    }

    return nutrients
  }

  private calculateConfidence(description: string, query: string): number {
    const lowerDesc = description.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // Exact match gets highest confidence
    if (lowerDesc === lowerQuery) {
      return 1.0
    }

    // Starts with query gets high confidence
    if (lowerDesc.startsWith(lowerQuery)) {
      return 0.9
    }

    // Contains all query words
    const queryWords = lowerQuery.split(/\s+/)
    const descWords = lowerDesc.split(/\s+/)
    const matchedWords = queryWords.filter(word =>
      descWords.some(descWord => descWord.includes(word))
    )

    if (matchedWords.length === queryWords.length) {
      return 0.8 - (0.1 * (queryWords.length - 1))
    }

    // Partial match
    const matchRatio = matchedWords.length / queryWords.length
    return Math.max(0.3, matchRatio * 0.7)
  }

  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private cleanupCache(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key)
      }
    }
  }
}