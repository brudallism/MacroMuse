// infra/adapters/SpoonacularRecipeAdapter.ts - Recipe import from Spoonacular API
// Foundation-compliant adapter that normalizes to RecipeData format
import {
  RecipeData,
  RecipeIngredient,
  RecipeStep,
  NutrientVector,
  FoodSearchResult
} from '../../domain/models'
import { calculateRecipeNutrients } from '../../domain/services/recipes'

// Spoonacular API types
interface SpoonacularRecipeResponse {
  id: number
  title: string
  summary?: string
  servings: number
  readyInMinutes?: number
  preparationMinutes?: number
  cookingMinutes?: number
  spoonacularScore?: number
  image?: string
  dishTypes?: string[]
  extendedIngredients: SpoonacularIngredient[]
  analyzedInstructions: SpoonacularInstructionGroup[]
  nutrition?: SpoonacularNutrition
}

interface SpoonacularIngredient {
  id: number
  name: string
  nameClean?: string
  original: string
  amount: number
  unit: string
  measures: {
    metric: { amount: number; unitShort: string; unitLong: string }
    us: { amount: number; unitShort: string; unitLong: string }
  }
  nutrition?: SpoonacularNutrientInfo[]
}

interface SpoonacularInstructionGroup {
  steps: SpoonacularInstructionStep[]
}

interface SpoonacularInstructionStep {
  number: number
  step: string
  length?: { number: number; unit: string }
}

interface SpoonacularNutrition {
  nutrients: SpoonacularNutrientInfo[]
}

interface SpoonacularNutrientInfo {
  name: string
  amount: number
  unit: string
}

export class SpoonacularRecipeAdapter {
  private readonly apiKey: string
  private readonly baseUrl = 'https://api.spoonacular.com/recipes'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  /**
   * Import a recipe from Spoonacular by ID
   * Normalizes to our RecipeData format for use in RecipeForm
   */
  async importRecipe(spoonacularId: string, userId: string): Promise<RecipeData> {
    try {
      const spoonacularRecipe = await this.fetchRecipe(spoonacularId)

      // Normalize ingredients to our format
      const ingredients = await this.normalizeIngredients(spoonacularRecipe.extendedIngredients)

      // Normalize instructions
      const instructions = this.normalizeInstructions(spoonacularRecipe.analyzedInstructions)

      // Calculate nutrition from ingredients
      const nutrients = calculateRecipeNutrients(ingredients)

      // Extract tags from dish types
      const tags = spoonacularRecipe.dishTypes || []

      // Determine difficulty based on ready time and ingredients count
      const difficulty = this.determineDifficulty(
        spoonacularRecipe.readyInMinutes || 0,
        ingredients.length
      )

      const recipeData: RecipeData = {
        name: spoonacularRecipe.title,
        description: this.stripHtmlTags(spoonacularRecipe.summary || ''),
        servings: spoonacularRecipe.servings,
        prepTime: spoonacularRecipe.preparationMinutes,
        cookTime: spoonacularRecipe.cookingMinutes,
        difficulty,
        ingredients,
        instructions,
        tags,
        nutrients,
        imageUrl: spoonacularRecipe.image,
        source: 'spoonacular',
        sourceId: spoonacularId,
        userId
      }

      return recipeData
    } catch (error) {
      console.error('Error importing recipe from Spoonacular:', error)
      throw new Error(`Failed to import recipe: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search for recipes on Spoonacular
   */
  async searchRecipes(
    query: string,
    options: {
      number?: number
      offset?: number
      diet?: string
      intolerances?: string
    } = {}
  ): Promise<{ results: SpoonacularRecipeResponse[]; totalResults: number }> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      query,
      number: (options.number || 12).toString(),
      offset: (options.offset || 0).toString(),
      addRecipeInformation: 'true',
      addRecipeNutrition: 'false', // We'll calculate our own
      fillIngredients: 'true'
    })

    if (options.diet) {
      params.append('diet', options.diet)
    }

    if (options.intolerances) {
      params.append('intolerances', options.intolerances)
    }

    const response = await fetch(`${this.baseUrl}/complexSearch?${params}`)

    if (!response.ok) {
      throw new Error(`Spoonacular API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Fetch detailed recipe information from Spoonacular
   */
  private async fetchRecipe(spoonacularId: string): Promise<SpoonacularRecipeResponse> {
    const params = new URLSearchParams({
      apiKey: this.apiKey,
      includeNutrition: 'true',
      analyzedInstructions: 'true'
    })

    const response = await fetch(`${this.baseUrl}/${spoonacularId}/information?${params}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch recipe ${spoonacularId}: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Normalize Spoonacular ingredients to our RecipeIngredient format
   */
  private async normalizeIngredients(spoonacularIngredients: SpoonacularIngredient[]): Promise<RecipeIngredient[]> {
    const ingredients: RecipeIngredient[] = []

    for (let i = 0; i < spoonacularIngredients.length; i++) {
      const spoonIngredient = spoonacularIngredients[i]

      try {
        // Use metric measurements when available, fall back to US
        const amount = spoonIngredient.measures.metric.amount || spoonIngredient.amount
        const unit = spoonIngredient.measures.metric.unitShort || spoonIngredient.unit

        // Try to get nutrition data for this ingredient
        const nutrients = await this.getIngredientNutrition(
          spoonIngredient.name,
          amount,
          unit
        )

        ingredients.push({
          id: `ingredient_${spoonIngredient.id}`,
          name: spoonIngredient.nameClean || spoonIngredient.name,
          amount,
          unit,
          nutrients,
          orderIndex: i
        })
      } catch (error) {
        console.warn(`Failed to normalize ingredient ${spoonIngredient.name}:`, error)

        // Fallback with empty nutrition
        ingredients.push({
          id: `ingredient_${spoonIngredient.id}`,
          name: spoonIngredient.nameClean || spoonIngredient.name,
          amount: spoonIngredient.amount,
          unit: spoonIngredient.unit,
          nutrients: {},
          orderIndex: i
        })
      }
    }

    return ingredients
  }

  /**
   * Normalize Spoonacular instructions to our RecipeStep format
   */
  private normalizeInstructions(instructionGroups: SpoonacularInstructionGroup[]): RecipeStep[] {
    const instructions: RecipeStep[] = []

    instructionGroups.forEach(group => {
      group.steps.forEach(step => {
        // Extract duration if available
        const duration = step.length?.unit === 'minutes'
          ? step.length.number
          : undefined

        instructions.push({
          id: `instruction_${step.number}`,
          order: step.number,
          instruction: step.step.trim(),
          duration
        })
      })
    })

    return instructions.sort((a, b) => a.order - b.order)
  }

  /**
   * Get nutrition information for an ingredient
   * This could integrate with USDA or use cached nutrition data
   */
  private async getIngredientNutrition(
    name: string,
    amount: number,
    unit: string
  ): Promise<NutrientVector> {
    // For now, return empty nutrients
    // In a full implementation, this would:
    // 1. Search our ingredient database
    // 2. Fall back to USDA API
    // 3. Use Spoonacular ingredient nutrition endpoint as last resort
    return {}
  }

  /**
   * Determine recipe difficulty based on time and complexity
   */
  private determineDifficulty(
    readyInMinutes: number,
    ingredientCount: number
  ): 'easy' | 'medium' | 'hard' {
    // Simple heuristic for difficulty
    if (readyInMinutes <= 30 && ingredientCount <= 5) {
      return 'easy'
    } else if (readyInMinutes <= 60 && ingredientCount <= 10) {
      return 'medium'
    } else {
      return 'hard'
    }
  }

  /**
   * Strip HTML tags from Spoonacular recipe summaries
   */
  private stripHtmlTags(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  /**
   * Convert Spoonacular recipe to a quick preview format
   */
  convertToSearchResult(spoonacularRecipe: SpoonacularRecipeResponse): FoodSearchResult {
    return {
      id: `spoonacular_${spoonacularRecipe.id}`,
      name: spoonacularRecipe.title,
      source: 'spoonacular',
      nutrients: {}, // Would need to calculate from ingredients
      servingSize: {
        amount: 1,
        unit: 'serving'
      },
      confidence: (spoonacularRecipe.spoonacularScore || 50) / 100,
      ingredients: spoonacularRecipe.extendedIngredients
        .map(ing => ing.original)
        .join(', ')
    }
  }

  /**
   * Validate Spoonacular recipe data before import
   */
  validateRecipeData(spoonacularRecipe: SpoonacularRecipeResponse): string[] {
    const errors: string[] = []

    if (!spoonacularRecipe.title || spoonacularRecipe.title.trim().length === 0) {
      errors.push('Recipe must have a title')
    }

    if (!spoonacularRecipe.servings || spoonacularRecipe.servings <= 0) {
      errors.push('Recipe must specify valid number of servings')
    }

    if (!spoonacularRecipe.extendedIngredients || spoonacularRecipe.extendedIngredients.length === 0) {
      errors.push('Recipe must have ingredients')
    }

    if (!spoonacularRecipe.analyzedInstructions ||
        spoonacularRecipe.analyzedInstructions.length === 0 ||
        spoonacularRecipe.analyzedInstructions.every(group => group.steps.length === 0)) {
      errors.push('Recipe must have instructions')
    }

    // Check for extremely long recipes that might not import well
    if (spoonacularRecipe.extendedIngredients && spoonacularRecipe.extendedIngredients.length > 20) {
      errors.push('Recipe has too many ingredients (>20) for optimal import')
    }

    return errors
  }
}

// Export singleton factory
let adapter: SpoonacularRecipeAdapter | null = null

export const getSpoonacularRecipeAdapter = (): SpoonacularRecipeAdapter => {
  if (!adapter) {
    const apiKey = process.env.EXPO_PUBLIC_SPOONACULAR_API_KEY
    if (!apiKey) {
      throw new Error('Spoonacular API key not configured')
    }
    adapter = new SpoonacularRecipeAdapter(apiKey)
  }
  return adapter
}

export default SpoonacularRecipeAdapter