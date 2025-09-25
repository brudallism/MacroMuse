// domain/services/recipes.ts
import { NutrientVector } from '@domain/models'

export interface RecipeService {
  create(_data: Record<string, unknown>): Promise<string>
  update(_id: string, _data: Record<string, unknown>): Promise<void>
  computeNutrients(_recipeId: string): Promise<NutrientVector>
  scale(_recipeId: string, _servings: number): Promise<void>
}
