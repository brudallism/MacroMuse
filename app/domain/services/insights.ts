// domain/services/insights.ts
import { Insight } from '@domain/models'

export interface InsightRuleEngine {
  evaluate(_range: { start: string; end: string }): Promise<Insight[]>
}
