// domain/services/insights.ts - Pattern detection rule engine following Foundation.md
import { Insight, NutrientVector } from '@domain/models'
import { AnalyticsData, AnalyticsEngine } from './analytics'

export interface InsightRuleEngine {
  evaluate(range: { start: string; end: string }): Promise<Insight[]>
  evaluateForUser(userId: string, range: { start: string; end: string }): Promise<Insight[]>
}

export type InsightRule = {
  key: string
  name: string
  evaluate: (data: AnalyticsData[]) => Insight | null
  priority: number
}

export class InsightEngine {
  private static readonly IRON_TARGET_FEMALE = 18 // mg
  private static readonly IRON_TARGET_MALE = 8 // mg
  private static readonly FIBER_TARGET = 25 // g
  private static readonly SODIUM_LIMIT = 2300 // mg

  static readonly RULES: InsightRule[] = [
    {
      key: 'iron_low_streak',
      name: 'Iron Deficiency Pattern',
      priority: 1,
      evaluate: (data: AnalyticsData[]) => {
        const ironValues = data.map(d => ({
          date: d.date,
          value: d.nutrients.iron_mg || 0,
          target: d.targets.iron_mg || InsightEngine.IRON_TARGET_FEMALE
        }))

        const streak = AnalyticsEngine.detectStreak(
          ironValues,
          (value, target) => value < target * 0.7 // Less than 70% of target
        )

        if (streak.length >= 3) {
          const avgDeficit = ironValues.slice(-streak.length)
            .reduce((sum, v) => sum + Math.max(0, v.target - v.value), 0) / streak.length

          return {
            id: `iron_low_streak_${Date.now()}`,
            dateRange: {
              start: data[0].date,
              end: data[data.length - 1].date
            },
            key: 'iron_low_streak',
            severity: streak.length >= 7 ? 'high' : 'warn',
            message: `Iron intake has been consistently low for ${streak.length} days. Average deficit: ${avgDeficit.toFixed(1)}mg daily.`,
            details: {
              streakLength: streak.length,
              avgDeficit,
              recommendations: [
                'Include iron-rich foods: spinach, lean beef, lentils, tofu',
                'Pair with vitamin C sources to improve absorption',
                'Consider consulting a healthcare provider if this continues'
              ]
            }
          }
        }
        return null
      }
    },

    {
      key: 'macro_imbalance',
      name: 'Macro Balance Issue',
      priority: 2,
      evaluate: (data: AnalyticsData[]) => {
        if (data.length < 7) return null

        const recentWeek = data.slice(-7)
        const balances = recentWeek.map(d => AnalyticsEngine.calculateMacroBalance(d.nutrients))

        const avgProtein = balances.reduce((sum, b) => sum + b.proteinPercent, 0) / balances.length
        const avgCarbs = balances.reduce((sum, b) => sum + b.carbsPercent, 0) / balances.length
        const avgFat = balances.reduce((sum, b) => sum + b.fatPercent, 0) / balances.length

        // Check for extreme imbalances
        if (avgProtein < 10 || avgProtein > 35 || avgCarbs < 20 || avgCarbs > 65 || avgFat < 15 || avgFat > 40) {
          const severity = (avgProtein < 5 || avgProtein > 40 || avgCarbs < 10 || avgCarbs > 75) ? 'high' : 'warn'

          return {
            id: `macro_imbalance_${Date.now()}`,
            dateRange: {
              start: recentWeek[0].date,
              end: recentWeek[recentWeek.length - 1].date
            },
            key: 'macro_imbalance',
            severity,
            message: `Macro balance may need adjustment. Current averages: ${avgProtein.toFixed(1)}% protein, ${avgCarbs.toFixed(1)}% carbs, ${avgFat.toFixed(1)}% fat.`,
            details: {
              proteinPercent: avgProtein,
              carbsPercent: avgCarbs,
              fatPercent: avgFat,
              recommendations: [
                avgProtein < 15 ? 'Increase protein intake with lean meats, legumes, or protein powder' : null,
                avgCarbs > 60 ? 'Consider reducing refined carbohydrates' : null,
                avgFat < 20 ? 'Include healthy fats like avocado, nuts, and olive oil' : null
              ].filter(Boolean)
            }
          }
        }
        return null
      }
    },

    {
      key: 'weekend_pattern',
      name: 'Weekend Eating Pattern',
      priority: 3,
      evaluate: (data: AnalyticsData[]) => {
        if (data.length < 14) return null

        const weekends: AnalyticsData[] = []
        const weekdays: AnalyticsData[] = []

        data.forEach(d => {
          const dayOfWeek = new Date(d.date).getDay()
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            weekends.push(d)
          } else {
            weekdays.push(d)
          }
        })

        if (weekends.length < 4 || weekdays.length < 8) return null

        const weekendAvgCals = weekends.reduce((sum, d) => sum + (d.nutrients.calories || 0), 0) / weekends.length
        const weekdayAvgCals = weekdays.reduce((sum, d) => sum + (d.nutrients.calories || 0), 0) / weekdays.length

        const calorieDiff = weekendAvgCals - weekdayAvgCals
        const percentDiff = (calorieDiff / weekdayAvgCals) * 100

        if (Math.abs(percentDiff) > 25) {
          return {
            id: `weekend_pattern_${Date.now()}`,
            dateRange: {
              start: data[0].date,
              end: data[data.length - 1].date
            },
            key: 'weekend_pattern',
            severity: Math.abs(percentDiff) > 40 ? 'warn' : 'info',
            message: `Weekend eating differs significantly from weekdays. ${percentDiff > 0 ? 'Higher' : 'Lower'} weekend intake by ${Math.abs(percentDiff).toFixed(1)}%.`,
            details: {
              weekendAvgCals,
              weekdayAvgCals,
              percentDiff,
              recommendations: [
                'Consider meal planning for weekends',
                'Be mindful of social eating situations',
                'Maintain consistent eating patterns across the week'
              ]
            }
          }
        }
        return null
      }
    },

    {
      key: 'fiber_consistently_low',
      name: 'Low Fiber Intake',
      priority: 2,
      evaluate: (data: AnalyticsData[]) => {
        const recentWeek = data.slice(-7)
        const lowFiberDays = recentWeek.filter(d => (d.nutrients.fiber_g || 0) < InsightEngine.FIBER_TARGET * 0.6)

        if (lowFiberDays.length >= 5) {
          const avgFiber = recentWeek.reduce((sum, d) => sum + (d.nutrients.fiber_g || 0), 0) / recentWeek.length

          return {
            id: `fiber_low_${Date.now()}`,
            dateRange: {
              start: recentWeek[0].date,
              end: recentWeek[recentWeek.length - 1].date
            },
            key: 'fiber_consistently_low',
            severity: avgFiber < InsightEngine.FIBER_TARGET * 0.4 ? 'warn' : 'info',
            message: `Fiber intake has been low this week. Current average: ${avgFiber.toFixed(1)}g daily (target: ${InsightEngine.FIBER_TARGET}g).`,
            details: {
              avgFiber,
              target: InsightEngine.FIBER_TARGET,
              deficit: InsightEngine.FIBER_TARGET - avgFiber,
              recommendations: [
                'Add more vegetables to each meal',
                'Choose whole grains over refined grains',
                'Include fruits with skin when possible',
                'Add legumes like beans and lentils to meals'
              ]
            }
          }
        }
        return null
      }
    },

    {
      key: 'sodium_high_trend',
      name: 'High Sodium Intake Trend',
      priority: 1,
      evaluate: (data: AnalyticsData[]) => {
        const sodiumValues = data.map(d => ({
          date: d.date,
          value: d.nutrients.sodium_mg || 0
        }))

        const trend = AnalyticsEngine.detectNutrientTrend(sodiumValues)
        const recentAvg = sodiumValues.slice(-7).reduce((sum, v) => sum + v.value, 0) / 7

        if (trend === 'increasing' && recentAvg > InsightEngine.SODIUM_LIMIT) {
          return {
            id: `sodium_high_${Date.now()}`,
            dateRange: {
              start: data[0].date,
              end: data[data.length - 1].date
            },
            key: 'sodium_high_trend',
            severity: recentAvg > InsightEngine.SODIUM_LIMIT * 1.5 ? 'high' : 'warn',
            message: `Sodium intake is trending upward and exceeds recommended limits. Recent average: ${recentAvg.toFixed(0)}mg daily.`,
            details: {
              recentAvg,
              limit: InsightEngine.SODIUM_LIMIT,
              excess: recentAvg - InsightEngine.SODIUM_LIMIT,
              recommendations: [
                'Reduce processed and packaged foods',
                'Cook more meals at home',
                'Use herbs and spices instead of salt for flavor',
                'Read nutrition labels carefully'
              ]
            }
          }
        }
        return null
      }
    }
  ]

  static evaluateRules(data: AnalyticsData[]): Insight[] {
    const insights: Insight[] = []

    for (const rule of this.RULES) {
      try {
        const insight = rule.evaluate(data)
        if (insight) {
          insights.push(insight)
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.key}:`, error)
      }
    }

    // Sort by priority and severity
    return insights.sort((a, b) => {
      const severityOrder = { high: 3, warn: 2, info: 1 }
      const aSeverity = severityOrder[a.severity]
      const bSeverity = severityOrder[b.severity]

      if (aSeverity !== bSeverity) {
        return bSeverity - aSeverity // Higher severity first
      }

      const aRule = this.RULES.find(r => r.key === a.key)
      const bRule = this.RULES.find(r => r.key === b.key)
      return (aRule?.priority || 99) - (bRule?.priority || 99) // Lower priority number first
    })
  }
}
