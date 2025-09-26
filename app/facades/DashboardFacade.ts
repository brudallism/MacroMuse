// DashboardFacade.ts - UI controller for dashboard data orchestration
import { TargetsServiceImpl } from '../domain/services/targets'
import { TotalsServiceImpl } from '../domain/services/totals'
import { NutrientVector, TargetVector } from '../domain/models'
import { trackOperation } from '../lib/performance'

export interface DashboardData {
  targets: TargetVector
  totals: NutrientVector & { pctOfTarget: Partial<Record<keyof TargetVector, number>> }
  isLoading: boolean
  error: string | null
}

export interface MacroRingData {
  label: string
  current: number
  target: number
  percentage: number
  color: string
}

export class DashboardFacade {
  constructor(
    private targetsService: TargetsServiceImpl,
    private totalsService: TotalsServiceImpl
  ) {}

  async getDashboardData(userId: string, date: string): Promise<DashboardData> {
    // Orchestrate: TargetsService + TotalsService
    // Return data structure for dashboard rings
    // Handle loading states and errors

    return await trackOperation('dashboard_load', async () => {
      try {
        const [targets, totals] = await Promise.all([
          this.targetsService.get(userId, date),
          this.totalsService.getDaily(userId, date)
        ])

        return {
          targets,
          totals,
          isLoading: false,
          error: null,
        }
      } catch (error) {
        return {
          targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
          totals: { pctOfTarget: {} },
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })
  }

  getMacroRingsData(data: DashboardData): MacroRingData[] {
    // Transform data for macro rings UI
    const { targets, totals } = data

    return [
      {
        label: 'Calories',
        current: totals.calories || 0,
        target: targets.calories,
        percentage: totals.pctOfTarget.calories || 0,
        color: this.getRingColor(totals.pctOfTarget.calories || 0),
      },
      {
        label: 'Protein',
        current: totals.protein_g || 0,
        target: targets.protein_g,
        percentage: totals.pctOfTarget.protein_g || 0,
        color: this.getRingColor(totals.pctOfTarget.protein_g || 0),
      },
      {
        label: 'Carbs',
        current: totals.carbs_g || 0,
        target: targets.carbs_g,
        percentage: totals.pctOfTarget.carbs_g || 0,
        color: this.getRingColor(totals.pctOfTarget.carbs_g || 0),
      },
      {
        label: 'Fat',
        current: totals.fat_g || 0,
        target: targets.fat_g,
        percentage: totals.pctOfTarget.fat_g || 0,
        color: this.getRingColor(totals.pctOfTarget.fat_g || 0),
      },
    ]
  }

  private getRingColor(percentage: number): string {
    // Color coding based on target achievement
    if (percentage >= 100) return '#10B981' // Green - target achieved
    if (percentage >= 80) return '#F59E0B'  // Amber - close to target
    if (percentage >= 50) return '#EF4444'  // Red - halfway
    return '#6B7280' // Gray - just started
  }

  async refreshDashboard(userId: string, date: string): Promise<DashboardData> {
    // Force refresh of dashboard data
    return await this.getDashboardData(userId, date)
  }

  // Get streak information
  async getStreakData(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
    // This would calculate streaks based on target achievement
    // For now, return mock data - implement based on daily_totals table
    return {
      currentStreak: 3,
      longestStreak: 12,
    }
  }

  // Get quick stats for header
  async getQuickStats(userId: string, date: string): Promise<{
    caloriesRemaining: number
    proteinRemaining: number
    nextMeal: string
  }> {
    const data = await this.getDashboardData(userId, date)

    return {
      caloriesRemaining: Math.max(0, data.targets.calories - (data.totals.calories || 0)),
      proteinRemaining: Math.max(0, data.targets.protein_g - (data.totals.protein_g || 0)),
      nextMeal: this.getNextMealSuggestion(),
    }
  }

  private getNextMealSuggestion(): string {
    const hour = new Date().getHours()

    if (hour < 10) return 'breakfast'
    if (hour < 14) return 'lunch'
    if (hour < 18) return 'snack'
    return 'dinner'
  }
}