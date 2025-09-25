// domain/services/analytics.ts
import { NutrientVector } from '@domain/models'

export interface AnalyticsService {
  rollup(_range: { start: string; end: string }): Promise<void>
  trends(
    _range: { start: string; end: string },
    _keys: (keyof NutrientVector)[]
  ): Promise<Record<string, unknown>>
}
