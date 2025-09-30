// domain/services/recipes.ts - Pure TypeScript recipe services
import {
  RecipeData,
  RecipeIngredient,
  NutrientVector,
  PlannedMeal
} from '../models'

export interface RecipeService {
  create(data: Omit<RecipeData, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>
  update(id: string, data: Partial<RecipeData>): Promise<void>
  get(id: string): Promise<RecipeData | null>
  getByUser(userId: string): Promise<RecipeData[]>
  delete(id: string): Promise<void>
  computeNutrients(recipeId: string): Promise<NutrientVector>
  scale(recipeId: string, servings: number): Promise<RecipeData>
  duplicate(recipeId: string, userId: string): Promise<string>
  search(query: string, userId?: string): Promise<RecipeData[]>
}

export interface RecipeRepository {
  save(recipe: RecipeData): Promise<string>
  update(id: string, data: Partial<RecipeData>): Promise<void>
  findById(id: string): Promise<RecipeData | null>
  findByUserId(userId: string): Promise<RecipeData[]>
  delete(id: string): Promise<void>
  search(query: string, userId?: string): Promise<RecipeData[]>
}

// Pure calculation functions for recipe nutrition
export const calculateRecipeNutrients = (ingredients: RecipeIngredient[]): NutrientVector => {
  return ingredients.reduce((total, ingredient) => {
    const scaled = scaleNutrients(ingredient.nutrients, ingredient.amount)
    return addNutrients(total, scaled)
  }, {} as NutrientVector)
}

export const scaleRecipeNutrients = (
  baseNutrients: NutrientVector,
  baseServings: number,
  newServings: number
): NutrientVector => {
  if (baseServings <= 0 || newServings <= 0) {
    throw new Error('Servings must be positive numbers')
  }

  const scaleFactor = newServings / baseServings

  return Object.entries(baseNutrients).reduce((scaled, [key, value]) => {
    if (typeof value === 'number' && value > 0) {
      // Round to 2 decimal places for precision
      scaled[key as keyof NutrientVector] = Math.round(value * scaleFactor * 100) / 100
    }
    return scaled
  }, {} as NutrientVector)
}

export const scaleRecipeIngredients = (
  ingredients: RecipeIngredient[],
  baseServings: number,
  newServings: number
): RecipeIngredient[] => {
  if (baseServings <= 0 || newServings <= 0) {
    throw new Error('Servings must be positive numbers')
  }

  const scaleFactor = newServings / baseServings

  return ingredients.map(ingredient => ({
    ...ingredient,
    amount: Math.round(ingredient.amount * scaleFactor * 100) / 100,
    nutrients: scaleNutrients(ingredient.nutrients, scaleFactor)
  }))
}

export const getRecipePerServing = (recipe: RecipeData): NutrientVector => {
  if (recipe.servings <= 0) {
    throw new Error('Recipe servings must be positive')
  }

  return scaleRecipeNutrients(recipe.nutrients, recipe.servings, 1)
}

export const convertToPlannedMeal = (
  recipe: RecipeData,
  servings: number = 1
): PlannedMeal => {
  const scaledNutrients = scaleRecipeNutrients(
    getRecipePerServing(recipe),
    1,
    servings
  )

  return {
    id: `recipe_${recipe.id}_${Date.now()}`,
    type: 'recipe',
    recipeId: recipe.id,
    name: recipe.name,
    servings,
    unit: 'serving',
    nutrients: scaledNutrients
  }
}

// Helper functions for nutrient calculations
const addNutrients = (a: NutrientVector, b: NutrientVector): NutrientVector => {
  const result: NutrientVector = {}

  // Get all unique keys from both nutrient vectors
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of allKeys) {
    const keyTyped = key as keyof NutrientVector
    const valueA = a[keyTyped] || 0
    const valueB = b[keyTyped] || 0

    if (valueA > 0 || valueB > 0) {
      result[keyTyped] = Math.round((valueA + valueB) * 100) / 100
    }
  }

  return result
}

const scaleNutrients = (nutrients: NutrientVector, factor: number): NutrientVector => {
  if (factor <= 0) {
    return {}
  }

  return Object.entries(nutrients).reduce((scaled, [key, value]) => {
    if (typeof value === 'number' && value > 0) {
      scaled[key as keyof NutrientVector] = Math.round(value * factor * 100) / 100
    }
    return scaled
  }, {} as NutrientVector)
}

// Recipe validation utilities
export const validateRecipe = (recipe: Partial<RecipeData>): string[] => {
  const errors: string[] = []

  if (!recipe.name || recipe.name.trim().length === 0) {
    errors.push('Recipe name is required')
  }

  if (!recipe.servings || recipe.servings <= 0) {
    errors.push('Recipe must have positive number of servings')
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    errors.push('Recipe must have at least one ingredient')
  }

  if (!recipe.instructions || recipe.instructions.length === 0) {
    errors.push('Recipe must have at least one instruction')
  }

  if (recipe.ingredients) {
    recipe.ingredients.forEach((ingredient, index) => {
      if (!ingredient.name || ingredient.name.trim().length === 0) {
        errors.push(`Ingredient ${index + 1} must have a name`)
      }
      if (!ingredient.amount || ingredient.amount <= 0) {
        errors.push(`Ingredient ${index + 1} must have a positive amount`)
      }
      if (!ingredient.unit || ingredient.unit.trim().length === 0) {
        errors.push(`Ingredient ${index + 1} must have a unit`)
      }
    })
  }

  if (recipe.instructions) {
    recipe.instructions.forEach((instruction, index) => {
      if (!instruction.instruction || instruction.instruction.trim().length === 0) {
        errors.push(`Instruction ${index + 1} cannot be empty`)
      }
    })
  }

  return errors
}

export const getEmptyRecipe = (userId: string): Omit<RecipeData, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  description: '',
  servings: 1,
  prepTime: 0,
  cookTime: 0,
  difficulty: 'easy',
  ingredients: [],
  instructions: [],
  tags: [],
  nutrients: {},
  source: 'custom',
  userId
})
