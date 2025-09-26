// SettingsFacade.ts - UI controller for profile and settings management
import { TargetsServiceImpl } from '../domain/services/targets'
import { ProfileRepository, UserProfile } from '../infra/repositories/ProfileRepository'
import { eventBus } from '../lib/eventBus'
import { trackOperation } from '../lib/performance'

export interface SettingsState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
  hasChanges: boolean
}

export interface GoalPeriod {
  id: string
  type: 'weekly' | 'menstrual'
  goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
  startDate: string
  endDate: string
  active: boolean
}

export class SettingsFacade {
  constructor(
    private profileRepository: ProfileRepository,
    private targetsService: TargetsServiceImpl
  ) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      return await this.profileRepository.findById(userId)
    } catch (error) {
      eventBus.emit('settings_error', {
        error: error instanceof Error ? error.message : 'Failed to load profile'
      })
      return null
    }
  }

  async updateProfile(userId: string, changes: Partial<UserProfile>): Promise<{ success: boolean; error?: string; profile?: UserProfile }> {
    // Call ProfileRepository
    // Trigger target recalculation
    // Update appStore via events

    return await trackOperation('profile_update', async () => {
      try {
        // Validate changes
        const validationError = this.validateProfileChanges(changes)
        if (validationError) {
          return { success: false, error: validationError }
        }

        const updatedProfile = await this.profileRepository.update(userId, changes)

        // Clear targets cache when profile changes affect calculations
        const affectsTargets = ['sex', 'age_years', 'height_cm', 'weight_kg', 'activity_level', 'current_goal']
        const shouldRecalculateTargets = affectsTargets.some(key => changes.hasOwnProperty(key))

        if (shouldRecalculateTargets) {
          // Emit event to trigger target recalculation
          eventBus.emit('profile_updated_targets_affected', {
            userId,
            changes,
            timestamp: new Date().toISOString()
          })
        }

        return { success: true, profile: updatedProfile }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to update profile'

        eventBus.emit('settings_error', { error: errorMessage })

        return { success: false, error: errorMessage }
      }
    })
  }

  async setBaseGoal(
    userId: string,
    goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.targetsService.setBaseGoal(userId, goal)

      eventBus.emit('base_goal_updated', {
        userId,
        goal,
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set base goal'
      return { success: false, error: errorMessage }
    }
  }

  async setWeeklyGoal(
    userId: string,
    goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition',
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate date range
      if (new Date(startDate) >= new Date(endDate)) {
        return { success: false, error: 'End date must be after start date' }
      }

      await this.targetsService.setWeeklyGoal(userId, goal, startDate, endDate)

      eventBus.emit('weekly_goal_updated', {
        userId,
        goal,
        startDate,
        endDate,
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set weekly goal'
      return { success: false, error: errorMessage }
    }
  }

  async setMenstrualGoal(
    userId: string,
    adjustments: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number },
    startDate: string,
    endDate: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate adjustments
      if (adjustments.calories && adjustments.calories < 1000) {
        return { success: false, error: 'Calories cannot be less than 1000' }
      }

      await this.targetsService.setMenstrualGoal(userId, adjustments, startDate, endDate)

      eventBus.emit('menstrual_goal_updated', {
        userId,
        adjustments,
        startDate,
        endDate,
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to set menstrual goal'
      return { success: false, error: errorMessage }
    }
  }

  async deleteProfile(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.profileRepository.delete(userId)

      eventBus.emit('profile_deleted', {
        userId,
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete profile'
      return { success: false, error: errorMessage }
    }
  }

  // Validation helpers
  private validateProfileChanges(changes: Partial<UserProfile>): string | null {
    if (changes.age_years !== undefined) {
      if (changes.age_years < 13 || changes.age_years > 120) {
        return 'Age must be between 13 and 120 years'
      }
    }

    if (changes.height_cm !== undefined) {
      if (changes.height_cm < 100 || changes.height_cm > 250) {
        return 'Height must be between 100 and 250 cm'
      }
    }

    if (changes.weight_kg !== undefined) {
      if (changes.weight_kg < 30 || changes.weight_kg > 300) {
        return 'Weight must be between 30 and 300 kg'
      }
    }

    return null
  }

  // Calculate estimated targets without saving
  async previewTargets(
    userId: string,
    profileChanges: Partial<UserProfile>,
    goal?: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
  ): Promise<{ calories: number; protein_g: number; carbs_g: number; fat_g: number } | null> {
    try {
      const currentProfile = await this.getProfile(userId)
      if (!currentProfile) return null

      const previewProfile = { ...currentProfile, ...profileChanges }

      // Import computeMacros directly for preview
      const { computeMacros } = await import('../domain/services/macros')

      const macros = computeMacros({
        sex: previewProfile.sex,
        age_years: previewProfile.age_years,
        height: { value: previewProfile.height_cm, unit: 'cm' },
        weight: { value: previewProfile.weight_kg, unit: 'kg' },
        activity_level: previewProfile.activity_level,
      }, goal || previewProfile.current_goal)

      return {
        calories: macros.kcal_target,
        protein_g: macros.protein_g,
        carbs_g: macros.carb_g,
        fat_g: macros.fat_g,
      }
    } catch {
      return null
    }
  }
}