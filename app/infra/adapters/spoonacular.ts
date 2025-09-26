import { FoodSearchResult, NutrientVector } from '@domain/models'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

interface SpoonacularRecipe {
  id: number
  title: string
  servings: number
  readyInMinutes: number
  extendedIngredients: Array<{
    id: number
    name: string
    amount: number
    unit: string
  }>
}

interface SpoonacularSearchResponse {
  results: Array<{
    id: number
    title: string
    readyInMinutes: number
    servings: number
    image: string
  }>
  totalResults: number
}

interface SpoonacularNutrients {
  nutrients: Array<{
    name: string
    amount: number
    unit: string
  }>
}

interface SpoonacularRecipeResponse {
  id: number
  title: string
  servings: number
  extendedIngredients: Array<{
    id: number
    name: string
    amount: number
    unit: string
  }>
  nutrition: SpoonacularNutrients
}

const SPOONACULAR_API_BASE = 'https://api.spoonacular.com'
const DEFAULT_SEARCH_LIMIT = 25

const NUTRIENT_NAME_MAP: Record<string, keyof NutrientVector> = {
  'Calories': 'calories',
  'Protein': 'protein_g',
  'Carbohydrates': 'carbs_g',
  'Fat': 'fat_g',
  'Fiber': 'fiber_g',
  'Saturated Fat': 'saturatedFat_g',
  'Monounsaturated Fat': 'monounsaturatedFat_g',
  'Polyunsaturated Fat': 'polyunsaturatedFat_g',
  'Trans Fat': 'transFat_g',
  'Cholesterol': 'cholesterol_mg',
  'Sugar': 'totalSugars_g',
  'Sodium': 'sodium_mg',
  'Potassium': 'potassium_mg',
  'Calcium': 'calcium_mg',
  'Iron': 'iron_mg',
  'Magnesium': 'magnesium_mg',
  'Zinc': 'zinc_mg',
  'Phosphorus': 'phosphorus_mg',
  'Copper': 'copper_mg',
  'Manganese': 'manganese_mg',
  'Selenium': 'selenium_µg',
  'Vitamin A': 'vitaminA_µg',
  'Vitamin C': 'vitaminC_mg',
  'Vitamin D': 'vitaminD_µg',
  'Vitamin E': 'vitaminE_mg',
  'Vitamin K': 'vitaminK_µg',
  'Vitamin B1': 'thiaminB1_mg',
  'Vitamin B2': 'riboflavinB2_mg',
  'Vitamin B3': 'niacinB3_mg',
  'Vitamin B6': 'vitaminB6_mg',
  'Vitamin B9': 'folateB9_µg',
  'Vitamin B12': 'vitaminB12_µg',
  'Vitamin B5': 'pantothenicAcidB5_mg',
  'Choline': 'choline_mg'
}

export interface RecipeSearchResult {
  id: string
  name: string
  servings: number
  readyInMinutes: number
  confidence?: number
}

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: string
}

export class SpoonacularAdapter {
  private cache = new Map<string, { data: any; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('Spoonacular API key is required')
    }
  }

  async searchRecipes(query: string): Promise<RecipeSearchResult[]> {
    if (!query.trim()) {
      return []
    }

    const cacheKey = `recipe_search:${query.toLowerCase()}`
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(
        `${SPOONACULAR_API_BASE}/recipes/complexSearch?query=${encodeURIComponent(query)}&number=${DEFAULT_SEARCH_LIMIT}&addRecipeInformation=true&apiKey=${this.apiKey}`
      )

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('Spoonacular API rate limit hit', { query })
          return []
        }
        throw new Error(`Spoonacular API error: ${response.status}`)
      }

      const data: SpoonacularSearchResponse = await response.json()
      const results = this.normalizeRecipeSearchResults(data.results, query)

      this.setCachedData(cacheKey, results)

      eventBus.emit('food_search_completed', {
        query,
        results: [], // Convert to FoodSearchResult if needed
        source: 'spoonacular'
      })

      return results
    } catch (error) {
      logger.error('Spoonacular recipe search failed', { query, error })
      throw error
    }
  }

  async getRecipe(spoonId: string): Promise<{ingredients: Ingredient[], nutrients: NutrientVector}> {
    const cacheKey = `recipe:${spoonId}`
    const cached = this.getCachedData(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const response = await fetch(
        `${SPOONACULAR_API_BASE}/recipes/${spoonId}/information?includeNutrition=true&apiKey=${this.apiKey}`
      )

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Recipe not found: ${spoonId}`)
        }
        if (response.status === 429) {
          logger.warn('Spoonacular API rate limit hit', { spoonId })
          throw new Error('Rate limit exceeded')
        }
        throw new Error(`Spoonacular API error: ${response.status}`)
      }

      const data: SpoonacularRecipeResponse = await response.json()
      const ingredients = this.normalizeIngredients(data.extendedIngredients)
      const nutrients = this.normalizeNutrients(data.nutrition.nutrients)

      const result = { ingredients, nutrients }
      this.setCachedData(cacheKey, result)

      eventBus.emit('food_data_cached', {
        foodId: spoonId,
        source: 'spoonacular',
        nutrients
      })

      return result
    } catch (error) {
      logger.error('Spoonacular recipe fetch failed', { spoonId, error })
      throw error
    }
  }

  private normalizeRecipeSearchResults(recipes: SpoonacularSearchResponse['results'], query: string): RecipeSearchResult[] {
    return recipes.map(recipe => {
      const confidence = this.calculateConfidence(recipe.title, query)

      return {
        id: recipe.id.toString(),
        name: recipe.title,
        servings: recipe.servings,
        readyInMinutes: recipe.readyInMinutes,
        confidence
      }
    }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  private normalizeIngredients(ingredients: SpoonacularRecipeResponse['extendedIngredients']): Ingredient[] {
    return ingredients.map(ingredient => ({
      id: ingredient.id.toString(),
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit
    }))
  }

  private normalizeNutrients(nutrients: SpoonacularNutrients['nutrients']): NutrientVector {
    const normalized: NutrientVector = {}

    for (const nutrient of nutrients) {
      const key = NUTRIENT_NAME_MAP[nutrient.name]
      if (key && nutrient.amount != null) {
        // Convert units if necessary
        let amount = nutrient.amount
        if (nutrient.unit === 'mg' && key.includes('_g')) {
          amount = amount / 1000 // Convert mg to g
        } else if (nutrient.unit === 'µg' && key.includes('_mg')) {
          amount = amount / 1000 // Convert µg to mg
        }

        normalized[key] = amount
      }
    }

    return normalized
  }

  private calculateConfidence(title: string, query: string): number {
    const lowerTitle = title.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // Exact match gets highest confidence
    if (lowerTitle === lowerQuery) {
      return 1.0
    }

    // Contains query gets high confidence
    if (lowerTitle.includes(lowerQuery)) {
      return 0.9
    }

    // Contains all query words
    const queryWords = lowerQuery.split(/\s+/)
    const titleWords = lowerTitle.split(/\s+/)
    const matchedWords = queryWords.filter(word =>
      titleWords.some(titleWord => titleWord.includes(word))
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
}