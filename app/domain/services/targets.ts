// domain/services/targets.ts - Goal precedence with concrete implementation
import { TargetVector } from '../models'
import { TargetsRepository } from '../../infra/repositories/TargetsRepository'

export interface TargetsService {
  get(userId: string, dateISO: string): Promise<TargetVector> // precedence: menstrual > weekly > base
}

export class TargetsServiceImpl implements TargetsService {
  constructor(private targetsRepository: TargetsRepository) {}

  async get(userId: string, dateISO: string): Promise<TargetVector> {
    // Implement precedence: menstrual > weekly > base
    // Cache today's targets, recalculate only on changes
    // Return required TargetVector with calories, protein_g, carbs_g, fat_g
    return await this.targetsRepository.getTargets(userId, dateISO)
  }

  async setBaseGoal(userId: string, goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'): Promise<void> {
    await this.targetsRepository.setBaseGoal(userId, goal)
  }

  async setWeeklyGoal(
    userId: string,
    goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition',
    startDate: string,
    endDate: string
  ): Promise<void> {
    await this.targetsRepository.setWeeklyGoal(userId, goal, startDate, endDate)
  }

  async setMenstrualGoal(
    userId: string,
    adjustments: Partial<TargetVector>,
    startDate: string,
    endDate: string
  ): Promise<void> {
    await this.targetsRepository.setMenstrualGoal(userId, adjustments, startDate, endDate)
  }
}
