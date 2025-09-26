// TargetsRepository.ts - Goal precedence with menstrual cycle integration
import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '../../types/database'
import { TargetVector } from '../../domain/models'
import { computeMacros } from '../../domain/services/macros'
import { eventBus } from '../../lib/eventBus'

import { UserProfile } from './ProfileRepository'

interface GoalEntry {
  id: string
  user_id: string
  goal_type: 'base' | 'weekly' | 'menstrual'
  start_date: string
  end_date: string | null
  target_goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
  target_calories?: number
  target_protein_g?: number
  target_carbs_g?: number
  target_fat_g?: number
  target_fiber_g?: number
  active: boolean
  created_at: string
}

export class TargetsRepository {
  private cache = new Map<string, { targets: TargetVector; expires: number }>()

  constructor(private supabase: SupabaseClient<Database>) {}

  // Get targets with precedence: menstrual > weekly > base
  async getTargets(userId: string, date: string): Promise<TargetVector> {
    const cacheKey = `${userId}:${date}`
    const cached = this.cache.get(cacheKey)

    // Return cached if still valid (cache for 1 hour)
    if (cached && Date.now() < cached.expires) {
      return cached.targets
    }

    // Get active goals in precedence order
    const { data: goals, error } = await this.supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .lte('start_date', date)
      .or(`end_date.is.null,end_date.gte.${date}`)
      .order('goal_type', { ascending: false }) // menstrual > weekly > base

    if (error) {
      throw new Error(`Failed to fetch goals: ${error.message}`)
    }

    let activeGoal: GoalEntry | null = null

    // Apply precedence logic
    for (const goal of goals) {
      if (goal.goal_type === 'menstrual') {
        activeGoal = goal
        break // Highest precedence
      } else if (goal.goal_type === 'weekly' && !activeGoal) {
        activeGoal = goal
      } else if (goal.goal_type === 'base' && !activeGoal) {
        activeGoal = goal
      }
    }

    let targets: TargetVector

    if (activeGoal?.target_calories) {
      // Use explicit targets if provided
      targets = {
        calories: activeGoal.target_calories,
        protein_g: activeGoal.target_protein_g || 0,
        carbs_g: activeGoal.target_carbs_g || 0,
        fat_g: activeGoal.target_fat_g || 0,
        fiber_g: activeGoal.target_fiber_g,
      }
    } else {
      // Calculate from profile using macro service
      const profile = await this.getUserProfile(userId)
      if (!profile) {
        throw new Error('User profile not found')
      }

      const goalType = activeGoal?.target_goal || profile.current_goal
      const macros = computeMacros({
        sex: profile.sex,
        age_years: profile.age_years,
        height: { value: profile.height_cm, unit: 'cm' },
        weight: { value: profile.weight_kg, unit: 'kg' },
        activity_level: profile.activity_level,
      }, goalType)

      targets = {
        calories: macros.kcal_target,
        protein_g: macros.protein_g,
        carbs_g: macros.carb_g,
        fat_g: macros.fat_g,
        fiber_g: macros.fiber_g,
      }
    }

    // Cache the result
    this.cache.set(cacheKey, {
      targets,
      expires: Date.now() + 3600000 // 1 hour
    })

    return targets
  }

  async setBaseGoal(userId: string, goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'): Promise<void> {
    // Deactivate existing base goals
    await this.supabase
      .from('goals')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('goal_type', 'base')

    // Create new base goal
    const { error } = await this.supabase
      .from('goals')
      .insert({
        user_id: userId,
        goal_type: 'base',
        start_date: new Date().toISOString().split('T')[0],
        target_goal: goal,
        active: true,
      })

    if (error) {
      throw new Error(`Failed to set base goal: ${error.message}`)
    }

    // Clear cache for user
    this.clearUserCache(userId)

    eventBus.emit('goals_updated', { userId, type: 'base', goal })
  }

  async setWeeklyGoal(
    userId: string,
    goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition',
    startDate: string,
    endDate: string
  ): Promise<void> {
    // Deactivate conflicting weekly goals
    await this.supabase
      .from('goals')
      .update({ active: false })
      .eq('user_id', userId)
      .eq('goal_type', 'weekly')
      .lte('start_date', endDate)
      .gte('end_date', startDate)

    const { error } = await this.supabase
      .from('goals')
      .insert({
        user_id: userId,
        goal_type: 'weekly',
        start_date: startDate,
        end_date: endDate,
        target_goal: goal,
        active: true,
      })

    if (error) {
      throw new Error(`Failed to set weekly goal: ${error.message}`)
    }

    this.clearUserCache(userId)
    eventBus.emit('goals_updated', { userId, type: 'weekly', goal, startDate, endDate })
  }

  async setMenstrualGoal(
    userId: string,
    adjustments: Partial<TargetVector>,
    startDate: string,
    endDate: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('goals')
      .insert({
        user_id: userId,
        goal_type: 'menstrual',
        start_date: startDate,
        end_date: endDate,
        target_calories: adjustments.calories,
        target_protein_g: adjustments.protein_g,
        target_carbs_g: adjustments.carbs_g,
        target_fat_g: adjustments.fat_g,
        target_fiber_g: adjustments.fiber_g,
        active: true,
      })

    if (error) {
      throw new Error(`Failed to set menstrual goal: ${error.message}`)
    }

    this.clearUserCache(userId)
    eventBus.emit('goals_updated', { userId, type: 'menstrual', adjustments, startDate, endDate })
  }

  private async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) return null
    return data as UserProfile
  }

  private clearUserCache(userId: string): void {
    // Clear all cache entries for this user
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.cache.delete(key)
      }
    }
  }

  // Clear cache when profile is updated
  clearCacheForUser(userId: string): void {
    this.clearUserCache(userId)
  }
}