// lib/analyticsEventWiring.ts - Event bus wiring for analytics following Foundation.md
import { InsightEngine } from '@domain/services/insights'
import { TrendAnalysisEngine } from '@domain/services/trends'
import { TargetsServiceImpl } from '@domain/services/targets'
import { AnalyticsData } from '@domain/services/analytics'

import { AnalyticsRollupJobImpl } from '@infra/jobs/analyticsRollup'

import { trackOperation } from './performance'
import { logger } from './logger'
import { eventBus } from './eventBus'

export class AnalyticsEventWiring {
  constructor(
    private analyticsRollupJob: AnalyticsRollupJobImpl,
    private targetsService: TargetsServiceImpl
  ) {
    this.wireAnalyticsEvents()
  }

  private wireAnalyticsEvents(): void {
    // Trigger rollup when meals are logged
    eventBus.on('meal_logged', async ({ userId, entry }) => {
      try {
        const date = entry.loggedAt.split('T')[0]
        logger.debug(`Triggering daily rollup for user ${userId} on ${date}`)

        // Run daily rollup (idempotent)
        await this.analyticsRollupJob.runDailyRollup(userId, date)

        // Calculate and emit goal adherence
        await this.calculateAndEmitGoalAdherence(userId, date)

        logger.debug(`Analytics updated for user ${userId} on ${date}`)
      } catch (error) {
        logger.error('Failed to update analytics after meal logging', error)
      }
    })

    // Trigger insights generation when daily rollup completes
    eventBus.on('analytics_rollup_completed', async ({ userId, period, date }) => {
      if (period === 'daily') {
        try {
          await this.generateAndEmitInsights(userId, date)
        } catch (error) {
          logger.error(`Failed to generate insights for user ${userId}`, error)
        }
      }
    })

    // Trigger weekly rollup when goals are updated
    eventBus.on('goal_updated', async ({ date }) => {
      // Note: This event doesn't include userId, might need to be enhanced
      logger.debug(`Goal updated on ${date}, considering weekly rollup trigger`)
    })

    // Celebrate milestones when streaks are achieved
    eventBus.on('streak_milestone_reached', async ({ userId, nutrient, days, type }) => {
      await this.celebrateProgress(userId, nutrient, days, type)
    })

    // Handle performance budget violations for analytics
    eventBus.on('performance_budget_exceeded', ({ operation, actualMs, budgetMs }) => {
      if (operation.includes('analytics') || operation.includes('insight') || operation.includes('trend')) {
        logger.warn(`Analytics performance budget exceeded: ${operation} took ${actualMs}ms (budget: ${budgetMs}ms)`)

        // Could trigger alerts or performance optimization measures
        this.handleAnalyticsPerformanceIssue(operation, actualMs, budgetMs)
      }
    })
  }

  private async calculateAndEmitGoalAdherence(userId: string, date: string): Promise<void> {
    await trackOperation('goalAdherence', async () => {
      try {
        // Get targets for the date
        const targets = await this.targetsService.get(userId, date)

        // Get actual intake for the date (would need repository access)
        // For now, we'll emit a placeholder event
        const adherence = 85 // This would be calculated from actual data

        eventBus.emit('goal_adherence_calculated', {
          userId,
          date,
          adherence
        })

        logger.debug(`Goal adherence calculated for user ${userId} on ${date}: ${adherence}%`)
      } catch (error) {
        logger.error(`Failed to calculate goal adherence for user ${userId}`, error)
      }
    })
  }

  private async generateAndEmitInsights(userId: string, date: string): Promise<void> {
    await trackOperation('insightGeneration', async () => {
      try {
        // Get data for insight analysis (last 14 days)
        const endDate = new Date(date)
        const startDate = new Date(endDate)
        startDate.setDate(startDate.getDate() - 14)

        // This would fetch actual analytics data from repository
        const analyticsData: AnalyticsData[] = await this.getAnalyticsData(
          userId,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        )

        // Generate insights using the rule engine
        const insights = InsightEngine.evaluateRules(analyticsData)

        if (insights.length > 0) {
          eventBus.emit('insights_generated', { userId, insights })

          // Emit specific pattern alerts
          for (const insight of insights) {
            this.emitSpecificPatternEvents(userId, insight)
          }

          logger.info(`Generated ${insights.length} insights for user ${userId}`)
        }
      } catch (error) {
        logger.error(`Failed to generate insights for user ${userId}`, error)
      }
    })
  }

  private async getAnalyticsData(userId: string, startDate: string, endDate: string): Promise<AnalyticsData[]> {
    // This would be implemented with actual repository access
    // For now, return empty array to prevent errors
    logger.debug(`Fetching analytics data for user ${userId} from ${startDate} to ${endDate}`)
    return []
  }

  private emitSpecificPatternEvents(userId: string, insight: any): void {
    // Emit specific events based on insight type
    switch (insight.key) {
      case 'iron_low_streak':
        eventBus.emit('nutrient_deficiency_alert', {
          userId,
          nutrient: 'iron',
          severity: insight.severity,
          streakDays: insight.details?.streakLength || 0
        })
        break

      case 'macro_imbalance':
        eventBus.emit('macro_imbalance_detected', {
          userId,
          imbalance: {
            protein: insight.details?.proteinPercent || 0,
            carbs: insight.details?.carbsPercent || 0,
            fat: insight.details?.fatPercent || 0
          },
          recommendations: insight.details?.recommendations || []
        })
        break

      case 'weekend_pattern':
        eventBus.emit('eating_pattern_detected', {
          userId,
          pattern: 'weekend_overeating',
          confidence: 0.8,
          data: {
            weekendAvgCals: insight.details?.weekendAvgCals,
            weekdayAvgCals: insight.details?.weekdayAvgCals,
            percentDiff: insight.details?.percentDiff
          }
        })
        break

      default:
        logger.debug(`No specific event for insight type: ${insight.key}`)
    }
  }

  private async celebrateProgress(userId: string, nutrient: string, days: number, type: string): Promise<void> {
    let achievement = ''
    const celebrationData: Record<string, unknown> = { nutrient, days, type }

    if (days >= 30) {
      achievement = `month_streak_${nutrient}`
    } else if (days >= 7) {
      achievement = `week_streak_${nutrient}`
    } else if (days >= 3) {
      achievement = `three_day_streak_${nutrient}`
    } else {
      achievement = `first_goal_met_${nutrient}`
    }

    eventBus.emit('progress_celebration_triggered', {
      userId,
      achievement,
      data: celebrationData
    })

    logger.info(`Progress celebration triggered for user ${userId}: ${achievement}`)
  }

  private handleAnalyticsPerformanceIssue(operation: string, actualMs: number, budgetMs: number): void {
    // Could implement performance optimization strategies
    const overagePercent = ((actualMs - budgetMs) / budgetMs) * 100

    if (overagePercent > 50) {
      logger.error(`Severe analytics performance issue: ${operation} exceeded budget by ${overagePercent.toFixed(1)}%`)

      // Could trigger:
      // - Caching adjustments
      // - Query optimization
      // - Background processing queues
      // - Rate limiting
    } else if (overagePercent > 20) {
      logger.warn(`Moderate analytics performance issue: ${operation} exceeded budget by ${overagePercent.toFixed(1)}%`)
    }
  }

  // Cleanup method for testing or shutdown
  public cleanup(): void {
    eventBus.removeAllListeners()
    logger.debug('Analytics event wiring cleaned up')
  }
}

// Factory function to create and wire analytics events
export function createAnalyticsEventWiring(
  analyticsRollupJob: AnalyticsRollupJobImpl,
  targetsService: TargetsServiceImpl
): AnalyticsEventWiring {
  return new AnalyticsEventWiring(analyticsRollupJob, targetsService)
}

// Utility function to trigger manual rollups (for testing or admin)
export async function triggerManualRollup(
  userId: string,
  startDate: string,
  endDate: string,
  analyticsRollupJob: AnalyticsRollupJobImpl
): Promise<void> {
  await trackOperation('analyticsRollup', async () => {
    await analyticsRollupJob.backfillUserRollups(userId, startDate, endDate)
    logger.info(`Manual rollup completed for user ${userId} from ${startDate} to ${endDate}`)
  })
}