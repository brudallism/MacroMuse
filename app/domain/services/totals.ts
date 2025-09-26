// domain/services/totals.ts - Daily totals calculation with concrete implementation
import { NutrientVector, TargetVector } from '../models'
import { LogRepository } from '../../infra/repositories/LogRepository'
import { TargetsRepository } from '../../infra/repositories/TargetsRepository'

export interface TotalsService {
  getDaily(
    userId: string,
    dateISO: string
  ): Promise<NutrientVector & { pctOfTarget: Partial<Record<keyof TargetVector, number>> }>
}

export class TotalsServiceImpl implements TotalsService {
  constructor(
    private logRepository: LogRepository,
    private targetsRepository: TargetsRepository
  ) {}

  async getDaily(userId: string, dateISO: string): Promise<NutrientVector & { pctOfTarget: Partial<Record<keyof TargetVector, number>> }> {
    // Calculate daily totals from intake_log
    // Include percentage of targets achieved
    // Real-time calculation with caching

    const entries = await this.logRepository.findByUserAndDate(userId, dateISO)
    const targets = await this.targetsRepository.getTargets(userId, dateISO)

    // Sum all nutrients for the day
    const totals: NutrientVector = entries.reduce((acc, entry) => ({
      calories: (acc.calories || 0) + (entry.nutrients?.calories || 0),
      protein_g: (acc.protein_g || 0) + (entry.nutrients?.protein_g || 0),
      carbs_g: (acc.carbs_g || 0) + (entry.nutrients?.carbs_g || 0),
      fat_g: (acc.fat_g || 0) + (entry.nutrients?.fat_g || 0),
      fiber_g: (acc.fiber_g || 0) + (entry.nutrients?.fiber_g || 0),
      sodium_mg: (acc.sodium_mg || 0) + (entry.nutrients?.sodium_mg || 0),
      vitaminC_mg: (acc.vitaminC_mg || 0) + (entry.nutrients?.vitaminC_mg || 0),
      calcium_mg: (acc.calcium_mg || 0) + (entry.nutrients?.calcium_mg || 0),
      iron_mg: (acc.iron_mg || 0) + (entry.nutrients?.iron_mg || 0),
    }), {})

    // Calculate percentages of targets
    const pctOfTarget: Partial<Record<keyof TargetVector, number>> = {}

    if (targets.calories && totals.calories) {
      pctOfTarget.calories = Math.round((totals.calories / targets.calories) * 100)
    }
    if (targets.protein_g && totals.protein_g) {
      pctOfTarget.protein_g = Math.round((totals.protein_g / targets.protein_g) * 100)
    }
    if (targets.carbs_g && totals.carbs_g) {
      pctOfTarget.carbs_g = Math.round((totals.carbs_g / targets.carbs_g) * 100)
    }
    if (targets.fat_g && totals.fat_g) {
      pctOfTarget.fat_g = Math.round((totals.fat_g / targets.fat_g) * 100)
    }

    return {
      ...totals,
      pctOfTarget,
    }
  }
}
