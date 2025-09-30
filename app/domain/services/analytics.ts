// domain/services/analytics.ts - Pure analytics domain service following Foundation.md
import { NutrientVector, TrendData } from '@domain/models'

export interface AnalyticsService {
  rollup(range: { start: string; end: string }): Promise<void>
  trends(
    range: { start: string; end: string },
    keys: (keyof NutrientVector)[]
  ): Promise<TrendData[]>
  calculateAdherence(
    actual: NutrientVector,
    target: NutrientVector,
    keys: (keyof NutrientVector)[]
  ): Promise<number>
  detectPatterns(
    range: { start: string; end: string },
    threshold: number
  ): Promise<AnalyticsPattern[]>
}

export type AnalyticsPattern = {
  type: 'streak' | 'trend' | 'variance' | 'ratio'
  nutrient: keyof NutrientVector
  direction: 'increasing' | 'decreasing' | 'stable' | 'volatile'
  confidence: number
  data: Array<{ date: string; value: number }>
  recommendation?: string
}

export type AnalyticsData = {
  date: string
  nutrients: NutrientVector
  targets: NutrientVector
  adherence: number
  entryCount: number
}

export class AnalyticsEngine {
  static calculateMacroBalance(nutrients: NutrientVector): {
    proteinPercent: number
    carbsPercent: number
    fatPercent: number
    totalCalories: number
  } {
    const protein = nutrients.protein_g || 0
    const carbs = nutrients.carbs_g || 0
    const fat = nutrients.fat_g || 0

    const proteinCals = protein * 4
    const carbsCals = carbs * 4
    const fatCals = fat * 9
    const totalCals = proteinCals + carbsCals + fatCals

    if (totalCals === 0) {
      return { proteinPercent: 0, carbsPercent: 0, fatPercent: 0, totalCalories: 0 }
    }

    return {
      proteinPercent: (proteinCals / totalCals) * 100,
      carbsPercent: (carbsCals / totalCals) * 100,
      fatPercent: (fatCals / totalCals) * 100,
      totalCalories: totalCals
    }
  }

  static calculateNutrientAdherence(
    actual: number,
    target: number,
    nutrient: keyof NutrientVector
  ): number {
    if (target === 0) return actual === 0 ? 100 : 0

    const ratio = actual / target

    // Different adherence logic for nutrients to minimize vs maximize
    const minimizeNutrients = ['sodium_mg', 'saturatedFat_g', 'transFat_g', 'addedSugars_g']
    if (minimizeNutrients.includes(nutrient)) {
      // For nutrients to minimize, adherence decreases as actual exceeds target
      return ratio <= 1 ? 100 : Math.max(0, 100 - ((ratio - 1) * 100))
    }

    // For nutrients to maximize, adherence is percentage of target achieved
    return Math.min(100, ratio * 100)
  }

  static detectNutrientTrend(
    values: Array<{ date: string; value: number }>,
    windowSize: number = 7
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < windowSize) return 'stable'

    const recent = values.slice(-windowSize)
    const earlier = values.slice(-(windowSize * 2), -windowSize)

    if (earlier.length === 0) return 'stable'

    const recentAvg = recent.reduce((sum, v) => sum + v.value, 0) / recent.length
    const earlierAvg = earlier.reduce((sum, v) => sum + v.value, 0) / earlier.length

    const percentChange = ((recentAvg - earlierAvg) / earlierAvg) * 100

    if (Math.abs(percentChange) < 5) return 'stable'
    return percentChange > 0 ? 'increasing' : 'decreasing'
  }

  static detectStreak(
    values: Array<{ date: string; value: number; target: number }>,
    condition: (value: number, target: number) => boolean
  ): { length: number; current: boolean } {
    if (values.length === 0) return { length: 0, current: false }

    let currentStreak = 0
    let maxStreak = 0

    for (let i = values.length - 1; i >= 0; i--) {
      const { value, target } = values[i]
      if (condition(value, target)) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        if (i === values.length - 1) currentStreak = 0
        break
      }
    }

    return { length: maxStreak, current: currentStreak > 0 }
  }
}
