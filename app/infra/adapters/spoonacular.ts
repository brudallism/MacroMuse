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

interface SpoonacularIngredientMeasures {
  amount: number
  unitShort: string
  unitLong: string
}

interface SpoonacularExtendedIngredient {
  id: number
  aisle?: string
  image?: string
  consistency?: string
  name: string
  nameClean?: string
  original: string
  originalName?: string
  amount: number
  unit: string
  meta?: string[]
  measures?: {
    us: SpoonacularIngredientMeasures
    metric: SpoonacularIngredientMeasures
  }
}

interface SpoonacularInstructionStep {
  number: number
  step: string
  ingredients?: Array<{ id: number; name: string; localizedName: string; image: string }>
  equipment?: Array<{ id: number; name: string; localizedName: string; image: string }>
  length?: { number: number; unit: string }
}

interface SpoonacularAnalyzedInstruction {
  name: string
  steps: SpoonacularInstructionStep[]
}

interface SpoonacularSearchResponse {
  results: Array<{
    // Basic Info
    id: number
    title: string
    image: string
    imageType?: string

    // Timing
    readyInMinutes?: number
    preparationMinutes?: number
    cookingMinutes?: number

    // Servings & Nutrition
    servings: number
    healthScore?: number
    spoonacularScore?: number
    pricePerServing?: number
    weightWatcherSmartPoints?: number

    // Dietary Attributes
    diets?: string[]
    vegan?: boolean
    vegetarian?: boolean
    glutenFree?: boolean
    dairyFree?: boolean
    veryHealthy?: boolean
    cheap?: boolean
    veryPopular?: boolean
    sustainable?: boolean
    lowFodmap?: boolean
    ketogenic?: boolean
    whole30?: boolean
    gaps?: string

    // Classification
    dishTypes?: string[]
    cuisines?: string[]
    occasions?: string[]

    // Content
    summary?: string
    instructions?: string
    extendedIngredients?: SpoonacularExtendedIngredient[]
    analyzedInstructions?: SpoonacularAnalyzedInstruction[]

    // Source Attribution
    creditsText?: string
    sourceName?: string
    sourceUrl?: string
    spoonacularSourceUrl?: string
    license?: string
    originalId?: number

    // Engagement Metrics
    aggregateLikes?: number
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

interface SpoonacularNutritionWeightPerServing {
  amount: number
  unit: string
}

interface SpoonacularCaloricBreakdown {
  percentProtein: number
  percentFat: number
  percentCarbs: number
}

interface SpoonacularNutritionData {
  nutrients: Array<{
    name: string
    amount: number
    unit: string
    percentOfDailyNeeds?: number
  }>
  properties?: Array<{
    name: string
    amount: number
    unit: string
  }>
  flavonoids?: Array<{
    name: string
    amount: number
    unit: string
  }>
  ingredients?: Array<{
    id: number
    name: string
    amount: number
    unit: string
    nutrients: Array<{
      name: string
      amount: number
      unit: string
      percentOfDailyNeeds?: number
    }>
  }>
  caloricBreakdown?: SpoonacularCaloricBreakdown
  weightPerServing?: SpoonacularNutritionWeightPerServing
}

interface SpoonacularWinePairing {
  pairedWines?: string[]
  pairingText?: string
  productMatches?: Array<{
    id: number
    title: string
    description: string
    price: string
    imageUrl: string
    averageRating: number
    ratingCount: number
    score: number
    link: string
  }>
}

interface SpoonacularRecipeResponse {
  // Basic Info
  id: number
  title: string
  image?: string
  imageType?: string

  // Timing
  readyInMinutes?: number
  preparationMinutes?: number
  cookingMinutes?: number

  // Servings & Nutrition
  servings: number
  healthScore?: number
  spoonacularScore?: number
  pricePerServing?: number
  weightWatcherSmartPoints?: number

  // Dietary Attributes
  diets?: string[]
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  dairyFree?: boolean
  veryHealthy?: boolean
  cheap?: boolean
  veryPopular?: boolean
  sustainable?: boolean
  lowFodmap?: boolean
  ketogenic?: boolean
  whole30?: boolean
  gaps?: string

  // Classification
  dishTypes?: string[]
  cuisines?: string[]
  occasions?: string[]

  // Content
  summary?: string
  instructions?: string
  extendedIngredients: SpoonacularExtendedIngredient[]
  analyzedInstructions?: SpoonacularAnalyzedInstruction[]

  // Source Attribution
  creditsText?: string
  sourceName?: string
  sourceUrl?: string
  spoonacularSourceUrl?: string
  license?: string
  originalId?: number

  // Engagement Metrics
  aggregateLikes?: number

  // Nutrition (when includeNutrition=true)
  nutrition?: SpoonacularNutritionData

  // Wine Pairing (optional)
  winePairing?: SpoonacularWinePairing
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
  // Basic Info
  id: string
  name: string
  image?: string
  imageType?: string

  // Timing
  servings: number
  readyInMinutes?: number
  preparationMinutes?: number
  cookingMinutes?: number

  // Preview Metrics (for card display)
  healthScore?: number
  pricePerServing?: number
  aggregateLikes?: number

  // Dietary Tags (for card badges: "high protein", "low carb", etc.)
  diets?: string[]
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  dairyFree?: boolean
  veryHealthy?: boolean
  cheap?: boolean
  veryPopular?: boolean
  sustainable?: boolean
  lowFodmap?: boolean
  ketogenic?: boolean

  // Classification
  dishTypes?: string[]
  cuisines?: string[]

  // Preview Content (for card description)
  summary?: string

  // Search Metadata
  confidence?: number
}

export interface Ingredient {
  id: string
  name: string
  amount: number
  unit: string
  aisle?: string
  image?: string
  original?: string
  measures?: {
    us: { amount: number; unitShort: string; unitLong: string }
    metric: { amount: number; unitShort: string; unitLong: string }
  }
}

export interface RecipeInstructionStep {
  number: number
  step: string
  ingredients?: Array<{ id: number; name: string; image: string }>
  equipment?: Array<{ id: number; name: string; image: string }>
  duration?: { number: number; unit: string }
}

export interface RecipeInstruction {
  name: string
  steps: RecipeInstructionStep[]
}

export interface RecipeDetail {
  // Basic Info
  id: string
  name: string
  image?: string
  imageType?: string

  // Timing
  servings: number
  readyInMinutes?: number
  preparationMinutes?: number
  cookingMinutes?: number

  // Metrics
  healthScore?: number
  spoonacularScore?: number
  pricePerServing?: number
  weightWatcherSmartPoints?: number
  aggregateLikes?: number

  // Dietary Attributes
  diets?: string[]
  vegan?: boolean
  vegetarian?: boolean
  glutenFree?: boolean
  dairyFree?: boolean
  veryHealthy?: boolean
  cheap?: boolean
  veryPopular?: boolean
  sustainable?: boolean
  lowFodmap?: boolean
  ketogenic?: boolean
  whole30?: boolean
  gaps?: string

  // Classification
  dishTypes?: string[]
  cuisines?: string[]
  occasions?: string[]

  // Content
  summary?: string
  instructions?: string
  ingredients: Ingredient[]
  analyzedInstructions?: RecipeInstruction[]

  // Nutrition
  nutrients: NutrientVector
  weightPerServing?: { amount: number; unit: string }
  caloricBreakdown?: {
    percentProtein: number
    percentFat: number
    percentCarbs: number
  }

  // Source Attribution
  creditsText?: string
  sourceName?: string
  sourceUrl?: string
  spoonacularSourceUrl?: string
  license?: string

  // Wine Pairing (optional)
  winePairing?: {
    pairedWines?: string[]
    pairingText?: string
  }
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

  async getRecipe(spoonId: string): Promise<RecipeDetail> {
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
      const nutrients = data.nutrition ? this.normalizeNutrients(data.nutrition.nutrients) : {}
      const analyzedInstructions = this.normalizeInstructions(data.analyzedInstructions)

      const result: RecipeDetail = {
        // Basic Info
        id: data.id.toString(),
        name: data.title,
        image: data.image,
        imageType: data.imageType,

        // Timing
        servings: data.servings,
        readyInMinutes: data.readyInMinutes,
        preparationMinutes: data.preparationMinutes,
        cookingMinutes: data.cookingMinutes,

        // Metrics
        healthScore: data.healthScore,
        spoonacularScore: data.spoonacularScore,
        pricePerServing: data.pricePerServing,
        weightWatcherSmartPoints: data.weightWatcherSmartPoints,
        aggregateLikes: data.aggregateLikes,

        // Dietary Attributes
        diets: data.diets,
        vegan: data.vegan,
        vegetarian: data.vegetarian,
        glutenFree: data.glutenFree,
        dairyFree: data.dairyFree,
        veryHealthy: data.veryHealthy,
        cheap: data.cheap,
        veryPopular: data.veryPopular,
        sustainable: data.sustainable,
        lowFodmap: data.lowFodmap,
        ketogenic: data.ketogenic,
        whole30: data.whole30,
        gaps: data.gaps,

        // Classification
        dishTypes: data.dishTypes,
        cuisines: data.cuisines,
        occasions: data.occasions,

        // Content
        summary: data.summary,
        instructions: data.instructions,
        ingredients,
        analyzedInstructions,

        // Nutrition
        nutrients,
        weightPerServing: data.nutrition?.weightPerServing,
        caloricBreakdown: data.nutrition?.caloricBreakdown,

        // Source Attribution
        creditsText: data.creditsText,
        sourceName: data.sourceName,
        sourceUrl: data.sourceUrl,
        spoonacularSourceUrl: data.spoonacularSourceUrl,
        license: data.license,

        // Wine Pairing
        winePairing: data.winePairing ? {
          pairedWines: data.winePairing.pairedWines,
          pairingText: data.winePairing.pairingText
        } : undefined
      }

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
        // Basic Info
        id: recipe.id.toString(),
        name: recipe.title,
        image: recipe.image,
        imageType: recipe.imageType,

        // Timing
        servings: recipe.servings,
        readyInMinutes: recipe.readyInMinutes,
        preparationMinutes: recipe.preparationMinutes,
        cookingMinutes: recipe.cookingMinutes,

        // Preview Metrics
        healthScore: recipe.healthScore,
        pricePerServing: recipe.pricePerServing,
        aggregateLikes: recipe.aggregateLikes,

        // Dietary Tags (for card badges)
        diets: recipe.diets,
        vegan: recipe.vegan,
        vegetarian: recipe.vegetarian,
        glutenFree: recipe.glutenFree,
        dairyFree: recipe.dairyFree,
        veryHealthy: recipe.veryHealthy,
        cheap: recipe.cheap,
        veryPopular: recipe.veryPopular,
        sustainable: recipe.sustainable,
        lowFodmap: recipe.lowFodmap,
        ketogenic: recipe.ketogenic,

        // Classification
        dishTypes: recipe.dishTypes,
        cuisines: recipe.cuisines,

        // Preview Content
        summary: recipe.summary,

        // Search Metadata
        confidence
      }
    }).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  private normalizeIngredients(ingredients: SpoonacularExtendedIngredient[]): Ingredient[] {
    return ingredients.map(ingredient => ({
      id: ingredient.id.toString(),
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      aisle: ingredient.aisle,
      image: ingredient.image,
      original: ingredient.original,
      measures: ingredient.measures
    }))
  }

  private normalizeInstructions(instructions?: SpoonacularAnalyzedInstruction[]): RecipeInstruction[] | undefined {
    if (!instructions || instructions.length === 0) {
      return undefined
    }

    return instructions.map(instruction => ({
      name: instruction.name,
      steps: instruction.steps.map(step => ({
        number: step.number,
        step: step.step,
        ingredients: step.ingredients,
        equipment: step.equipment,
        duration: step.length
      }))
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