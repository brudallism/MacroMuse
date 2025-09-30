// domain/services/targets.ts - Enhanced goal precedence for analytics following Foundation.md
import { TargetVector, NutrientVector } from '../models'
import { TargetsRepository } from '../../infra/repositories/TargetsRepository'

export interface TargetsService {
  get(userId: string, dateISO: string): Promise<TargetVector> // precedence: menstrual > weekly > base
  getRange(userId: string, startISO: string, endISO: string): Promise<Record<string, TargetVector>>
  calculateAdherence(actual: NutrientVector, target: TargetVector): Promise<number>
  getGoalAdjustmentRecommendations(userId: string, adherenceHistory: AdherenceHistory[]): Promise<GoalRecommendation[]>
}

export type AdherenceHistory = {
  date: string
  actual: NutrientVector
  target: TargetVector
  adherence: number
}

export type GoalRecommendation = {
  type: 'increase' | 'decrease' | 'maintain'
  nutrient: keyof TargetVector
  currentValue: number
  recommendedValue: number
  reasoning: string
  confidence: number
}

export class TargetsServiceImpl implements TargetsService {
  private readonly cache = new Map<string, { targets: TargetVector; timestamp: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(private targetsRepository: TargetsRepository) {}

  async get(userId: string, dateISO: string): Promise<TargetVector> {
    const cacheKey = `${userId}:${dateISO}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.targets
    }

    // Implement precedence: menstrual > weekly > base
    const targets = await this.targetsRepository.getTargets(userId, dateISO)

    this.cache.set(cacheKey, { targets, timestamp: Date.now() })
    return targets
  }

  async getRange(userId: string, startISO: string, endISO: string): Promise<Record<string, TargetVector>> {
    const targets: Record<string, TargetVector> = {}
    const start = new Date(startISO)
    const end = new Date(endISO)

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      targets[dateStr] = await this.get(userId, dateStr)
    }

    return targets
  }

  async calculateAdherence(actual: NutrientVector, target: TargetVector): Promise<number> {
    const macroNutrients: (keyof TargetVector)[] = ['calories', 'protein_g', 'carbs_g', 'fat_g']
    let totalScore = 0
    let weightedTotal = 0

    for (const nutrient of macroNutrients) {
      const actualValue = actual[nutrient] || 0
      const targetValue = target[nutrient]

      if (targetValue > 0) {
        const adherenceScore = this.calculateNutrientAdherence(actualValue, targetValue, nutrient)
        const weight = this.getNutrientWeight(nutrient)

        totalScore += adherenceScore * weight
        weightedTotal += weight
      }
    }

    return weightedTotal > 0 ? totalScore / weightedTotal : 0
  }

  async getGoalAdjustmentRecommendations(
    userId: string,
    adherenceHistory: AdherenceHistory[]
  ): Promise<GoalRecommendation[]> {
    if (adherenceHistory.length < 7) {
      return [] // Need at least a week of data
    }

    const recommendations: GoalRecommendation[] = []
    const recentWeek = adherenceHistory.slice(-7)
    const avgAdherence = recentWeek.reduce((sum, h) => sum + h.adherence, 0) / recentWeek.length

    // Analyze each macro nutrient
    const macroNutrients: (keyof TargetVector)[] = ['calories', 'protein_g', 'carbs_g', 'fat_g']

    for (const nutrient of macroNutrients) {
      const actualValues = recentWeek.map(h => h.actual[nutrient] || 0)
      const targetValues = recentWeek.map(h => h.target[nutrient])

      const avgActual = actualValues.reduce((sum, v) => sum + v, 0) / actualValues.length
      const avgTarget = targetValues.reduce((sum, v) => sum + v, 0) / targetValues.length

      if (avgTarget > 0) {
        const ratio = avgActual / avgTarget
        const consistency = this.calculateConsistency(actualValues)

        // Generate recommendations based on patterns
        if (ratio < 0.7 && consistency > 0.8) {
          // Consistently under-eating - suggest lower target
          recommendations.push({
            type: 'decrease',
            nutrient,
            currentValue: avgTarget,
            recommendedValue: Math.max(avgTarget * 0.9, avgActual * 1.05),
            reasoning: `Consistently achieving ${(ratio * 100).toFixed(0)}% of target. Consider reducing target to improve adherence.`,
            confidence: Math.min(0.9, consistency)
          })
        } else if (ratio > 1.3 && consistency > 0.8) {
          // Consistently over-eating - suggest higher target if goal allows
          recommendations.push({
            type: 'increase',
            nutrient,
            currentValue: avgTarget,
            recommendedValue: avgTarget * 1.1,
            reasoning: `Consistently exceeding target by ${((ratio - 1) * 100).toFixed(0)}%. Consider adjusting target upward.`,
            confidence: Math.min(0.8, consistency)
          })
        } else if (ratio >= 0.85 && ratio <= 1.15 && consistency > 0.7) {
          // Good adherence - maintain current targets
          recommendations.push({
            type: 'maintain',
            nutrient,
            currentValue: avgTarget,
            recommendedValue: avgTarget,
            reasoning: `Good adherence pattern. Current target is appropriate.`,
            confidence: consistency
          })
        }
      }
    }

    // Sort by confidence and return top recommendations
    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3)
  }

  private calculateNutrientAdherence(actual: number, target: number, nutrient: keyof TargetVector): number {
    if (target === 0) return actual === 0 ? 100 : 0

    const ratio = actual / target

    // Perfect adherence is within 10% of target
    if (ratio >= 0.9 && ratio <= 1.1) return 100

    // Gradual decrease in adherence as you move away from target
    if (ratio < 0.9) {
      return Math.max(0, ratio * 100)
    } else {
      // Penalty for going over target (except calories where slight over is okay)
      const overPenalty = nutrient === 'calories' ? 0.5 : 1.0
      return Math.max(0, 100 - ((ratio - 1) * 100 * overPenalty))
    }
  }

  private getNutrientWeight(nutrient: keyof TargetVector): number {
    const weights: Record<keyof TargetVector, number> = {
      calories: 0.4,    // Most important for overall goal
      protein_g: 0.3,   // Critical for body composition
      carbs_g: 0.15,    // Important for energy
      fat_g: 0.15       // Important for hormones/satiety
    }
    return weights[nutrient] || 0.1
  }

  private calculateConsistency(values: number[]): number {
    if (values.length === 0) return 0

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    const standardDev = Math.sqrt(variance)

    // Convert to consistency score (higher is more consistent)
    const coefficientOfVariation = mean > 0 ? standardDev / mean : 1
    return Math.max(0, 1 - coefficientOfVariation)
  }

  async setBaseGoal(userId: string, goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'): Promise<void> {
    await this.targetsRepository.setBaseGoal(userId, goal)
    this.invalidateCache(userId)
  }

  async setWeeklyGoal(
    userId: string,
    goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition',
    startDate: string,
    endDate: string
  ): Promise<void> {
    await this.targetsRepository.setWeeklyGoal(userId, goal, startDate, endDate)
    this.invalidateCache(userId)
  }

  async setMenstrualGoal(
    userId: string,
    adjustments: Partial<TargetVector>,
    startDate: string,
    endDate: string
  ): Promise<void> {
    await this.targetsRepository.setMenstrualGoal(userId, adjustments, startDate, endDate)
    this.invalidateCache(userId)
  }

  private invalidateCache(userId: string): void {
    // Remove all cache entries for this user
    for (const [key] of this.cache) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key)
      }
    }
  }
}
