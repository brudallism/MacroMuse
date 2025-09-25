// domain/services/totals.ts
import { NutrientVector, TargetVector } from '@domain/models'

export interface TotalsService {
  getDaily(
    _dateISO: string
  ): Promise<NutrientVector & { pctOfTarget: Partial<Record<keyof TargetVector, number>> }>
}
