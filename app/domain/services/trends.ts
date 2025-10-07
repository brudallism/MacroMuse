// domain/services/trends.ts - Trend analysis and progress tracking following Foundation.md
import { NutrientVector, TrendData, TargetVector } from '@domain/models'

import { trackOperation } from '@lib/performance'

export interface TrendAnalysisService {
  calculateTrends(
    userId: string,
    range: { start: string; end: string },
    nutrients: (keyof NutrientVector)[]
  ): Promise<TrendData[]>

  calculateProgressMetrics(
    userId: string,
    range: { start: string; end: string }
  ): Promise<ProgressMetrics>

  detectStreaks(
    userId: string,
    range: { start: string; end: string }
  ): Promise<StreakData[]>

  calculateWeeklyAverages(
    userId: string,
    weekCount: number
  ): Promise<Record<string, number>>
}

export type ProgressMetrics = {
  overallAdherence: number
  improvingNutrients: Array<{
    nutrient: keyof NutrientVector
    improvementPercent: number
    currentAverage: number
    previousAverage: number
  }>
  decliningNutrients: Array<{
    nutrient: keyof NutrientVector
    declinePercent: number
    currentAverage: number
    previousAverage: number
  }>
  consistencyScore: number
  goalMilestones: Array<{
    nutrient: keyof NutrientVector
    milestone: 'first_time_met' | 'three_day_streak' | 'week_streak' | 'month_streak'
    achievedOn: string
  }>
}

export type StreakData = {
  nutrient: keyof NutrientVector
  type: 'meeting_goal' | 'exceeding_goal' | 'under_goal'
  currentStreak: number
  maxStreak: number
  isActive: boolean
  streakStart: string
  streakEnd?: string
  averageValue: number
  targetValue: number
}

export class TrendAnalysisEngine {
  static calculateTrend(
    values: Array<{ date: string; value: number; targetValue?: number }>,
    windowSize: number = 7
  ): TrendData {
    if (values.length === 0) {
      throw new Error('Cannot calculate trend with empty data')
    }

    const nutrient = 'calories' as keyof NutrientVector // This should be passed as parameter

    // Sort by date to ensure chronological order
    const sortedValues = values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Calculate 7-day rolling averages to smooth out daily variations
    const smoothedValues = this.calculateRollingAverages(sortedValues, windowSize)

    // Determine trend direction
    const trend = this.determineTrendDirection(smoothedValues)

    // Calculate percentage change over the period
    const changePercent = this.calculatePercentageChange(smoothedValues)

    return {
      nutrient,
      values: sortedValues,
      trend,
      changePercent
    }
  }

  static calculateRollingAverages(
    values: Array<{ date: string; value: number; targetValue?: number }>,
    windowSize: number
  ): Array<{ date: string; value: number; targetValue?: number }> {
    if (values.length < windowSize) {
      return values
    }

    const result: Array<{ date: string; value: number; targetValue?: number }> = []

    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1)
      const averageValue = window.reduce((sum, item) => sum + item.value, 0) / windowSize
      const averageTarget = window.reduce((sum, item) => sum + (item.targetValue || 0), 0) / windowSize

      result.push({
        date: values[i].date,
        value: averageValue,
        targetValue: averageTarget > 0 ? averageTarget : undefined
      })
    }

    return result
  }

  static determineTrendDirection(
    values: Array<{ date: string; value: number }>
  ): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable'

    // Use linear regression to determine trend
    const n = values.length
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumX2 = 0

    values.forEach((point, index) => {
      const x = index
      const y = point.value
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    })

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

    // Calculate correlation coefficient to determine significance
    const meanX = sumX / n
    const meanY = sumY / n
    let numerator = 0
    let denomX = 0
    let denomY = 0

    values.forEach((point, index) => {
      const x = index
      const y = point.value
      numerator += (x - meanX) * (y - meanY)
      denomX += (x - meanX) ** 2
      denomY += (y - meanY) ** 2
    })

    const correlation = numerator / Math.sqrt(denomX * denomY)

    // Only consider significant trends (correlation > 0.3)
    if (Math.abs(correlation) < 0.3) return 'stable'

    return slope > 0 ? 'increasing' : 'decreasing'
  }

  static calculatePercentageChange(
    values: Array<{ date: string; value: number }>
  ): number {
    if (values.length < 2) return 0

    const firstValue = values[0].value
    const lastValue = values[values.length - 1].value

    if (firstValue === 0) return lastValue > 0 ? 100 : 0

    return ((lastValue - firstValue) / firstValue) * 100
  }

  static detectNutrientStreaks(
    values: Array<{ date: string; value: number; target: number }>,
    condition: (value: number, target: number) => boolean
  ): StreakData {
    if (values.length === 0) {
      throw new Error('Cannot detect streaks with empty data')
    }

    let currentStreak = 0
    let maxStreak = 0
    let streakStart = ''
    let streakEnd: string | undefined
    let isActive = false

    // Calculate average value for the streak
    const avgValue = values.reduce((sum, v) => sum + v.value, 0) / values.length
    const avgTarget = values.reduce((sum, v) => sum + v.target, 0) / values.length

    // Iterate through values to find streaks
    for (let i = values.length - 1; i >= 0; i--) {
      const { date, value, target } = values[i]

      if (condition(value, target)) {
        if (currentStreak === 0) {
          streakStart = date
          isActive = i === values.length - 1 // Active if it's the most recent day
        }
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        if (currentStreak > 0) {
          streakEnd = values[i + 1]?.date
          if (i !== values.length - 1) {
            isActive = false
          }
        }
        currentStreak = 0
      }
    }

    // Determine streak type based on condition
    let type: 'meeting_goal' | 'exceeding_goal' | 'under_goal' = 'meeting_goal'
    if (condition === ((v, t) => v >= t)) {
      type = 'meeting_goal'
    } else if (condition === ((v, t) => v >= t * 1.1)) {
      type = 'exceeding_goal'
    } else if (condition === ((v, t) => v < t * 0.9)) {
      type = 'under_goal'
    }

    return {
      nutrient: 'calories' as keyof NutrientVector, // Should be parameterized
      type,
      currentStreak: isActive ? currentStreak : 0,
      maxStreak,
      isActive,
      streakStart,
      streakEnd,
      averageValue: avgValue,
      targetValue: avgTarget
    }
  }

  static calculateConsistencyScore(
    values: Array<{ date: string; value: number; target: number }>
  ): number {
    if (values.length === 0) return 0

    // Calculate how consistent the adherence percentages are
    const adherencePercentages = values.map(v => {
      if (v.target === 0) return v.value === 0 ? 100 : 0
      return (v.value / v.target) * 100
    })

    const mean = adherencePercentages.reduce((sum, p) => sum + p, 0) / adherencePercentages.length
    const variance = adherencePercentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / adherencePercentages.length
    const standardDeviation = Math.sqrt(variance)

    // Convert to consistency score (0-100, where 100 is perfectly consistent)
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 1
    return Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 100)))
  }

  static identifyImprovementOpportunities(
    trends: TrendData[]
  ): Array<{
    nutrient: keyof NutrientVector
    opportunity: 'increase_intake' | 'decrease_intake' | 'improve_consistency'
    priority: 'high' | 'medium' | 'low'
    reasoning: string
  }> {
    const opportunities: Array<{
      nutrient: keyof NutrientVector
      opportunity: 'increase_intake' | 'decrease_intake' | 'improve_consistency'
      priority: 'high' | 'medium' | 'low'
      reasoning: string
    }> = []

    for (const trend of trends) {
      // Identify opportunities based on trend direction and target adherence
      const recentValues = trend.values.slice(-7) // Last week
      const avgAdherence = recentValues.reduce((sum, v) => {
        if (!v.targetValue || v.targetValue === 0) return sum
        return sum + (v.value / v.targetValue) * 100
      }, 0) / recentValues.length

      if (avgAdherence < 70 && trend.trend === 'decreasing') {
        opportunities.push({
          nutrient: trend.nutrient,
          opportunity: 'increase_intake',
          priority: 'high',
          reasoning: `${trend.nutrient} intake is declining and below target (${avgAdherence.toFixed(1)}% of goal)`
        })
      } else if (avgAdherence > 130 && trend.trend === 'increasing') {
        // Only for nutrients that should be limited
        const limitNutrients = ['sodium_mg', 'saturatedFat_g', 'addedSugars_g']
        if (limitNutrients.includes(trend.nutrient)) {
          opportunities.push({
            nutrient: trend.nutrient,
            opportunity: 'decrease_intake',
            priority: 'medium',
            reasoning: `${trend.nutrient} intake is increasing and above recommended limits (${avgAdherence.toFixed(1)}% of limit)`
          })
        }
      } else if (trend.trend === 'stable' && Math.abs(trend.changePercent) < 5) {
        // Check for consistency issues
        const values = trend.values.map(v => ({
          date: v.date,
          value: v.value,
          target: v.targetValue || 0
        }))
        const consistency = this.calculateConsistencyScore(values)

        if (consistency < 60) {
          opportunities.push({
            nutrient: trend.nutrient,
            opportunity: 'improve_consistency',
            priority: 'low',
            reasoning: `${trend.nutrient} intake varies significantly day-to-day (consistency score: ${consistency.toFixed(1)}%)`
          })
        }
      }
    }

    return opportunities.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }
}