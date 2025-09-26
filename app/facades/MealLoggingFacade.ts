// MealLoggingFacade.ts - UI controller for meal logging operations
import { LedgerServiceImpl } from '../domain/services/ledger'
import { LogEntry, NutrientVector } from '../domain/models'
import { trackOperation } from '../lib/performance'
import { eventBus } from '../lib/eventBus'

export interface MealLoggingState {
  isLogging: boolean
  error: string | null
  recentEntries: LogEntry[]
}

export interface FoodSearchResult {
  id: string
  name: string
  brand?: string
  nutrients: NutrientVector
  serving_size: number
  serving_unit: string
  source: 'usda' | 'spoonacular' | 'barcode'
}

export class MealLoggingFacade {
  constructor(private ledgerService: LedgerServiceImpl) {}

  async logMeal(entry: LogEntry): Promise<{ success: boolean; error?: string }> {
    // Optimistic UI updates
    // Call LedgerService.add()
    // Performance tracking within 1200ms budget
    // Event emission for UI updates

    return await trackOperation('meal_log', async () => {
      try {
        // Optimistic update - emit event immediately for UI responsiveness
        eventBus.emit('meal_logging_started', {
          userId: entry.user_id,
          date: entry.date,
          entry,
          timestamp: new Date().toISOString()
        })

        await this.ledgerService.add(entry)

        // Successful logging
        eventBus.emit('meal_logging_completed', {
          userId: entry.user_id,
          date: entry.date,
          entry,
          success: true,
          timestamp: new Date().toISOString()
        })

        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to log meal'

        eventBus.emit('meal_logging_completed', {
          userId: entry.user_id,
          date: entry.date,
          entry,
          success: false,
          error: errorMessage,
          timestamp: new Date().toISOString()
        })

        return { success: false, error: errorMessage }
      }
    })
  }

  async updateMealEntry(
    entryId: string,
    changes: Partial<LogEntry>
  ): Promise<{ success: boolean; error?: string; entry?: LogEntry }> {
    try {
      const updatedEntry = await this.ledgerService.updateEntry(entryId, changes)

      eventBus.emit('meal_updated', {
        userId: updatedEntry.user_id,
        date: updatedEntry.date,
        entryId,
        changes,
        timestamp: new Date().toISOString()
      })

      return { success: true, entry: updatedEntry }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update meal'
      return { success: false, error: errorMessage }
    }
  }

  async removeMeal(entryId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.ledgerService.remove(entryId)

      eventBus.emit('meal_removed', {
        entryId,
        timestamp: new Date().toISOString()
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove meal'
      return { success: false, error: errorMessage }
    }
  }

  async getRecentMeals(userId: string, days: number = 7): Promise<LogEntry[]> {
    // Get recent meals for quick logging suggestions
    const dates = []
    for (let i = 0; i < days; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      dates.push(date.toISOString().split('T')[0])
    }

    const allEntries: LogEntry[] = []

    for (const date of dates) {
      const entries = await this.ledgerService.getEntriesForDate(userId, date)
      allEntries.push(...entries)
    }

    // Return unique foods sorted by frequency
    const foodFrequency = new Map<string, { entry: LogEntry; count: number }>()

    allEntries.forEach(entry => {
      const key = entry.food_id
      if (foodFrequency.has(key)) {
        foodFrequency.get(key)!.count++
      } else {
        foodFrequency.set(key, { entry, count: 1 })
      }
    })

    return Array.from(foodFrequency.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(item => item.entry)
  }

  async getMealsForDate(userId: string, date: string): Promise<LogEntry[]> {
    return await this.ledgerService.getEntriesForDate(userId, date)
  }

  // Create quick log entry from food search result
  createLogEntry(
    userId: string,
    food: FoodSearchResult,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    servingMultiplier: number = 1
  ): LogEntry {
    const adjustedNutrients: NutrientVector = {}

    // Scale nutrients by serving multiplier
    Object.entries(food.nutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        (adjustedNutrients as any)[key] = Math.round(value * servingMultiplier * 100) / 100
      }
    })

    return {
      id: `${userId}_${Date.now()}_${Math.random()}`,
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      meal_type: mealType,
      food_id: food.id,
      food_name: food.name,
      serving_size: food.serving_size * servingMultiplier,
      serving_unit: food.serving_unit,
      nutrients: adjustedNutrients,
      created_at: new Date().toISOString(),
    }
  }

  // Batch log multiple foods (for recipes or meals)
  async logMultipleFoods(
    userId: string,
    foods: { food: FoodSearchResult; servingMultiplier: number }[],
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  ): Promise<{ success: boolean; errors?: string[] }> {
    const errors: string[] = []

    for (const { food, servingMultiplier } of foods) {
      const entry = this.createLogEntry(userId, food, mealType, servingMultiplier)
      const result = await this.logMeal(entry)

      if (!result.success && result.error) {
        errors.push(`${food.name}: ${result.error}`)
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    }
  }
}