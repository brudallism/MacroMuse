// domain/services/suggestions.ts
import { TargetVector, NutrientVector } from '@domain/models'

export interface SuggestionService {
  remainingMacros(
    _box: TargetVector,
    _prefs: Record<string, unknown>
  ): Promise<Array<{ optionId: string; score: number }>>
  gapFoods(
    _nutrientKey: keyof NutrientVector,
    _prefs: Record<string, unknown>
  ): Promise<Array<{ optionId: string; score: number }>>
}
