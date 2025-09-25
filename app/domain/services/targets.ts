// domain/services/targets.ts
import { TargetVector } from '@domain/models'

export interface TargetsService {
  get(_dateISO: string): Promise<TargetVector> // precedence: menstrual > weekly > base
}
