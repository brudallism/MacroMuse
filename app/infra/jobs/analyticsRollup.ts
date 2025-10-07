// infra/jobs/analyticsRollup.ts - Idempotent analytics rollup jobs following Foundation.md
import { SupabaseClient } from '@supabase/supabase-js'

import { NutrientVector } from '@domain/models'

import { trackOperation } from '@lib/performance'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface AnalyticsRollupJob {
  runDailyRollup(userId: string, date: string): Promise<void>
  runWeeklyRollup(userId: string, year: number, week: number): Promise<void>
  runMonthlyRollup(userId: string, year: number, month: number): Promise<void>
  backfillUserRollups(userId: string, startDate: string, endDate: string): Promise<void>
}

export class AnalyticsRollupJobImpl implements AnalyticsRollupJob {
  constructor(private supabase: SupabaseClient) {}

  async runDailyRollup(userId: string, date: string): Promise<void> {
    await trackOperation('analyticsRollup', async () => {
      try {
        logger.info(`Starting daily rollup for user ${userId} on ${date}`)

        // Get all intake entries for the day
        const { data: entries, error: entriesError } = await this.supabase
          .from('intake_log')
          .select('*')
          .eq('user_id', userId)
          .gte('logged_at', `${date}T00:00:00.000Z`)
          .lt('logged_at', `${date}T23:59:59.999Z`)

        if (entriesError) {
          throw new Error(`Failed to fetch intake entries: ${entriesError.message}`)
        }

        // Aggregate nutrients
        const aggregatedNutrients = await trackOperation('nutrientAggregation', async () => {
          return this.aggregateNutrients(entries || [])
        })

        // Upsert daily rollup (idempotent)
        const { error: upsertError } = await this.supabase
          .from('nutrient_daily')
          .upsert({
            user_id: userId,
            date,
            ...this.convertNutrientVectorToDbFields(aggregatedNutrients),
            entry_count: entries?.length || 0,
            computed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,date'
          })

        if (upsertError) {
          throw new Error(`Failed to upsert daily rollup: ${upsertError.message}`)
        }

        // Emit success event
        eventBus.emit('analytics_rollup_completed', {
          userId,
          period: 'daily',
          date
        })

        logger.info(`Completed daily rollup for user ${userId} on ${date}`)
      } catch (error) {
        logger.error(`Daily rollup failed for user ${userId} on ${date}`, error)
        throw error
      }
    })
  }

  async runWeeklyRollup(userId: string, year: number, week: number): Promise<void> {
    await trackOperation('weeklyRollup', async () => {
      try {
        logger.info(`Starting weekly rollup for user ${userId}, year ${year}, week ${week}`)

        // Calculate week start date (Monday)
        const weekStartDate = this.getWeekStartDate(year, week)
        const weekEndDate = new Date(weekStartDate)
        weekEndDate.setDate(weekEndDate.getDate() + 6)

        // Get daily rollups for the week
        const { data: dailyData, error: dailyError } = await this.supabase
          .from('nutrient_daily')
          .select('*')
          .eq('user_id', userId)
          .gte('date', weekStartDate.toISOString().split('T')[0])
          .lte('date', weekEndDate.toISOString().split('T')[0])

        if (dailyError) {
          throw new Error(`Failed to fetch daily data: ${dailyError.message}`)
        }

        if (!dailyData || dailyData.length === 0) {
          logger.warn(`No daily data found for weekly rollup: user ${userId}, year ${year}, week ${week}`)
          return
        }

        // Calculate weekly averages
        const weeklyAverages = this.calculateWeeklyAverages(dailyData)

        // Upsert weekly rollup (idempotent)
        const { error: upsertError } = await this.supabase
          .from('nutrient_weekly')
          .upsert({
            user_id: userId,
            year,
            week,
            week_start_date: weekStartDate.toISOString().split('T')[0],
            ...weeklyAverages,
            days_with_data: dailyData.length,
            total_entries: dailyData.reduce((sum, day) => sum + (day.entry_count || 0), 0),
            computed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,year,week'
          })

        if (upsertError) {
          throw new Error(`Failed to upsert weekly rollup: ${upsertError.message}`)
        }

        eventBus.emit('analytics_rollup_completed', {
          userId,
          period: 'weekly',
          date: weekStartDate.toISOString().split('T')[0]
        })

        logger.info(`Completed weekly rollup for user ${userId}, year ${year}, week ${week}`)
      } catch (error) {
        logger.error(`Weekly rollup failed for user ${userId}, year ${year}, week ${week}`, error)
        throw error
      }
    })
  }

  async runMonthlyRollup(userId: string, year: number, month: number): Promise<void> {
    await trackOperation('monthlyRollup', async () => {
      try {
        logger.info(`Starting monthly rollup for user ${userId}, year ${year}, month ${month}`)

        // Get daily rollups for the month
        const monthStart = new Date(year, month - 1, 1)
        const monthEnd = new Date(year, month, 0)

        const { data: dailyData, error: dailyError } = await this.supabase
          .from('nutrient_daily')
          .select('*')
          .eq('user_id', userId)
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', monthEnd.toISOString().split('T')[0])

        if (dailyError) {
          throw new Error(`Failed to fetch daily data: ${dailyError.message}`)
        }

        if (!dailyData || dailyData.length === 0) {
          logger.warn(`No daily data found for monthly rollup: user ${userId}, year ${year}, month ${month}`)
          return
        }

        // Calculate monthly averages
        const monthlyAverages = this.calculateMonthlyAverages(dailyData)

        // Upsert monthly rollup (idempotent)
        const { error: upsertError } = await this.supabase
          .from('nutrient_monthly')
          .upsert({
            user_id: userId,
            year,
            month,
            ...monthlyAverages,
            days_with_data: dailyData.length,
            total_entries: dailyData.reduce((sum, day) => sum + (day.entry_count || 0), 0),
            computed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,year,month'
          })

        if (upsertError) {
          throw new Error(`Failed to upsert monthly rollup: ${upsertError.message}`)
        }

        eventBus.emit('analytics_rollup_completed', {
          userId,
          period: 'monthly',
          date: monthStart.toISOString().split('T')[0]
        })

        logger.info(`Completed monthly rollup for user ${userId}, year ${year}, month ${month}`)
      } catch (error) {
        logger.error(`Monthly rollup failed for user ${userId}, year ${year}, month ${month}`, error)
        throw error
      }
    })
  }

  async backfillUserRollups(userId: string, startDate: string, endDate: string): Promise<void> {
    logger.info(`Starting backfill for user ${userId} from ${startDate} to ${endDate}`)

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Daily rollups
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0]
      try {
        await this.runDailyRollup(userId, dateStr)
      } catch (error) {
        logger.error(`Failed to backfill daily rollup for ${dateStr}`, error)
        // Continue with other dates
      }
    }

    // Weekly rollups
    const weeks = this.getWeeksInRange(start, end)
    for (const { year, week } of weeks) {
      try {
        await this.runWeeklyRollup(userId, year, week)
      } catch (error) {
        logger.error(`Failed to backfill weekly rollup for ${year}-W${week}`, error)
      }
    }

    // Monthly rollups
    const months = this.getMonthsInRange(start, end)
    for (const { year, month } of months) {
      try {
        await this.runMonthlyRollup(userId, year, month)
      } catch (error) {
        logger.error(`Failed to backfill monthly rollup for ${year}-${month}`, error)
      }
    }

    logger.info(`Completed backfill for user ${userId}`)
  }

  private aggregateNutrients(entries: any[]): NutrientVector {
    const result: NutrientVector = {}

    for (const entry of entries) {
      if (entry.nutrients) {
        const nutrients = typeof entry.nutrients === 'string'
          ? JSON.parse(entry.nutrients)
          : entry.nutrients

        for (const [key, value] of Object.entries(nutrients)) {
          if (typeof value === 'number' && value > 0) {
            result[key as keyof NutrientVector] = (result[key as keyof NutrientVector] || 0) + value
          }
        }
      }
    }

    return result
  }

  private convertNutrientVectorToDbFields(nutrients: NutrientVector): Record<string, number> {
    return {
      calories: nutrients.calories || 0,
      protein_g: nutrients.protein_g || 0,
      carbs_g: nutrients.carbs_g || 0,
      fat_g: nutrients.fat_g || 0,
      fiber_g: nutrients.fiber_g || 0,
      saturated_fat_g: nutrients.saturatedFat_g || 0,
      monounsaturated_fat_g: nutrients.monounsaturatedFat_g || 0,
      polyunsaturated_fat_g: nutrients.polyunsaturatedFat_g || 0,
      trans_fat_g: nutrients.transFat_g || 0,
      cholesterol_mg: nutrients.cholesterol_mg || 0,
      total_sugars_g: nutrients.totalSugars_g || 0,
      added_sugars_g: nutrients.addedSugars_g || 0,
      sodium_mg: nutrients.sodium_mg || 0,
      potassium_mg: nutrients.potassium_mg || 0,
      calcium_mg: nutrients.calcium_mg || 0,
      iron_mg: nutrients.iron_mg || 0,
      magnesium_mg: nutrients.magnesium_mg || 0,
      zinc_mg: nutrients.zinc_mg || 0,
      phosphorus_mg: nutrients.phosphorus_mg || 0,
      copper_mg: nutrients.copper_mg || 0,
      manganese_mg: nutrients.manganese_mg || 0,
      selenium_ug: nutrients.selenium_µg || 0,
      vitamin_a_ug: nutrients.vitaminA_µg || 0,
      vitamin_c_mg: nutrients.vitaminC_mg || 0,
      vitamin_d_ug: nutrients.vitaminD_µg || 0,
      vitamin_e_mg: nutrients.vitaminE_mg || 0,
      vitamin_k_ug: nutrients.vitaminK_µg || 0,
      thiamin_b1_mg: nutrients.thiaminB1_mg || 0,
      riboflavin_b2_mg: nutrients.riboflavinB2_mg || 0,
      niacin_b3_mg: nutrients.niacinB3_mg || 0,
      vitamin_b6_mg: nutrients.vitaminB6_mg || 0,
      folate_b9_ug: nutrients.folateB9_µg || 0,
      vitamin_b12_ug: nutrients.vitaminB12_µg || 0,
      pantothenic_acid_b5_mg: nutrients.pantothenicAcidB5_mg || 0,
      choline_mg: nutrients.choline_mg || 0
    }
  }

  private calculateWeeklyAverages(dailyData: any[]): Record<string, number> {
    const dayCount = dailyData.length
    if (dayCount === 0) return {}

    const averages: Record<string, number> = {}
    const numericFields = [
      'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
      'saturated_fat_g', 'monounsaturated_fat_g', 'polyunsaturated_fat_g',
      'trans_fat_g', 'cholesterol_mg', 'total_sugars_g', 'added_sugars_g',
      'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'magnesium_mg',
      'zinc_mg', 'phosphorus_mg', 'copper_mg', 'manganese_mg', 'selenium_ug',
      'vitamin_a_ug', 'vitamin_c_mg', 'vitamin_d_ug', 'vitamin_e_mg',
      'vitamin_k_ug', 'thiamin_b1_mg', 'riboflavin_b2_mg', 'niacin_b3_mg',
      'vitamin_b6_mg', 'folate_b9_ug', 'vitamin_b12_ug', 'pantothenic_acid_b5_mg',
      'choline_mg'
    ]

    for (const field of numericFields) {
      const sum = dailyData.reduce((acc, day) => acc + (day[field] || 0), 0)
      averages[`avg_${field}`] = sum / dayCount
    }

    return averages
  }

  private calculateMonthlyAverages(dailyData: any[]): Record<string, number> {
    // Same logic as weekly but with different prefix
    return this.calculateWeeklyAverages(dailyData)
  }

  private getWeekStartDate(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7)
    const dow = simple.getDay()
    const ISOweekStart = simple
    if (dow <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
    }
    return ISOweekStart
  }

  private getWeeksInRange(start: Date, end: Date): Array<{ year: number; week: number }> {
    const weeks: Array<{ year: number; week: number }> = []
    const current = new Date(start)

    while (current <= end) {
      const year = current.getFullYear()
      const week = this.getISOWeek(current)

      if (!weeks.some(w => w.year === year && w.week === week)) {
        weeks.push({ year, week })
      }

      current.setDate(current.getDate() + 7)
    }

    return weeks
  }

  private getMonthsInRange(start: Date, end: Date): Array<{ year: number; month: number }> {
    const months: Array<{ year: number; month: number }> = []
    const current = new Date(start.getFullYear(), start.getMonth(), 1)

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1
      })
      current.setMonth(current.getMonth() + 1)
    }

    return months
  }

  private getISOWeek(date: Date): number {
    const target = new Date(date.valueOf())
    const dayNr = (date.getDay() + 6) % 7
    target.setDate(target.getDate() - dayNr + 3)
    const firstThursday = target.valueOf()
    target.setMonth(0, 1)
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000)
  }
}