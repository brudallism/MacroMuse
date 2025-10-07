// facades/MealPlanningFacade.ts - Application facade for meal planning operations
import {
  WeeklyMealPlan,
  PlannedMeal,
  LogEntry,
  RecipeData,
  TargetVector
} from '../domain/models'
import {
  PlanService,
  convertPlanToLogEntries,
  generateShoppingList,
  createEmptyWeekPlan,
  validateMealPlan
} from '../domain/services/plans'
import { LedgerService } from '../domain/services/ledger'
import { eventBus } from '../lib/eventBus'
import { trackOperation } from '../lib/performance'

export class MealPlanningFacade {
  constructor(
    private planService: PlanService,
    private ledgerService: LedgerService
  ) {}

  /**
   * Create a new weekly meal plan
   */
  async createWeeklyPlan(
    startDate: string,
    userId: string,
    userTargets: TargetVector
  ): Promise<string> {
    return trackOperation('planCreation', async () => {
      try {
        const planId = await this.planService.createWeek(startDate, userId)

        eventBus.emit('meal_plan_created', {
          userId,
          planId,
          startDate
        })

        return planId
      } catch (error) {
        console.error('Error creating weekly plan:', error)
        throw new Error('Failed to create meal plan')
      }
    })
  }

  /**
   * Add a meal to an existing plan
   */
  async addMealToPlan(
    planId: string,
    dayIndex: number,
    mealType: string,
    meal: PlannedMeal
  ): Promise<void> {
    try {
      await this.planService.addMealToPlan(planId, dayIndex, mealType, meal)

      eventBus.emit('meal_added_to_plan', {
        planId,
        day: dayIndex,
        mealType,
        meal
      })
    } catch (error) {
      console.error('Error adding meal to plan:', error)
      throw new Error('Failed to add meal to plan')
    }
  }

  /**
   * Remove a meal from a plan
   */
  async removeMealFromPlan(planId: string, mealId: string): Promise<void> {
    try {
      await this.planService.removeMealFromPlan(planId, mealId)

      eventBus.emit('meal_removed_from_plan', {
        planId,
        mealId
      })
    } catch (error) {
      console.error('Error removing meal from plan:', error)
      throw new Error('Failed to remove meal from plan')
    }
  }

  /**
   * Move a meal within a plan (drag & drop)
   */
  async moveMeal(
    planId: string,
    mealId: string,
    targetDay: number,
    targetMealType: string
  ): Promise<void> {
    try {
      await this.planService.moveMeal(planId, mealId, targetDay, targetMealType)

      eventBus.emit('meal_moved_in_plan', {
        planId,
        mealId,
        targetDay,
        targetMealType
      })
    } catch (error) {
      console.error('Error moving meal in plan:', error)
      throw new Error('Failed to move meal')
    }
  }

  /**
   * Apply meal plan to user's food log
   * This is the core functionality that converts planned meals to log entries
   */
  async applyPlanToLedger(planId: string, userId: string): Promise<void> {
    return trackOperation('planApplication', async () => {
      try {
        // Get the meal plan
        const plan = await this.planService.get(planId)
        if (!plan) {
          throw new Error('Meal plan not found')
        }

        // Validate plan before applying
        const validationErrors = validateMealPlan(plan)
        if (validationErrors.length > 0) {
          throw new Error(`Invalid meal plan: ${validationErrors.join(', ')}`)
        }

        // Convert plan to log entries
        const logEntries = convertPlanToLogEntries(plan, userId)

        if (logEntries.length === 0) {
          throw new Error('No meals to apply from this plan')
        }

        // Use batch operation for efficiency
        await this.ledgerService.addBatch(logEntries)
        const appliedCount = logEntries.length

        // Emit completion event
        eventBus.emit('plan_applied', {
          planId,
          userId,
          entriesCount: appliedCount
        })

        console.log(`Successfully applied ${appliedCount} meals from plan ${planId}`)
      } catch (error) {
        console.error('Error applying plan to ledger:', error)

        eventBus.emit('plan_application_failed', {
          planId,
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })

        throw error
      }
    })
  }

  /**
   * Generate shopping list from meal plan
   */
  async generateShoppingList(
    planId: string,
    recipes: RecipeData[]
  ): Promise<import('../domain/models').ShoppingItem[]> {
    return trackOperation('shoppingListGeneration', async () => {
      try {
        const plan = await this.planService.get(planId)
        if (!plan) {
          throw new Error('Meal plan not found')
        }

        const shoppingItems = generateShoppingList(plan, recipes)

        eventBus.emit('shopping_list_generated', {
          planId,
          itemCount: shoppingItems.length
        })

        return shoppingItems
      } catch (error) {
        console.error('Error generating shopping list:', error)
        throw new Error('Failed to generate shopping list')
      }
    })
  }

  /**
   * Duplicate an existing meal plan
   */
  async duplicatePlan(
    sourcePlanId: string,
    userId: string,
    newStartDate: string
  ): Promise<string> {
    try {
      const newPlanId = await this.planService.duplicate(sourcePlanId, userId, newStartDate)

      eventBus.emit('meal_plan_duplicated', {
        sourcePlanId,
        newPlanId,
        userId,
        newStartDate
      })

      return newPlanId
    } catch (error) {
      console.error('Error duplicating plan:', error)
      throw new Error('Failed to duplicate meal plan')
    }
  }

  /**
   * Get user's meal plans
   */
  async getUserPlans(userId: string): Promise<WeeklyMealPlan[]> {
    try {
      return await this.planService.getByUser(userId)
    } catch (error) {
      console.error('Error getting user plans:', error)
      throw new Error('Failed to retrieve meal plans')
    }
  }

  /**
   * Delete a meal plan
   */
  async deletePlan(planId: string, userId: string): Promise<void> {
    try {
      await this.planService.delete(planId)

      eventBus.emit('meal_plan_deleted', {
        planId,
        userId
      })
    } catch (error) {
      console.error('Error deleting plan:', error)
      throw new Error('Failed to delete meal plan')
    }
  }

  /**
   * Update meal plan metadata
   */
  async updatePlan(
    planId: string,
    updates: Partial<WeeklyMealPlan>
  ): Promise<void> {
    try {
      await this.planService.update(planId, updates)

      eventBus.emit('meal_plan_updated', {
        planId,
        updates
      })
    } catch (error) {
      console.error('Error updating plan:', error)
      throw new Error('Failed to update meal plan')
    }
  }

  /**
   * Get nutrition summary for a meal plan
   */
  async getPlanNutritionSummary(planId: string): Promise<{
    daily: Record<string, import('../domain/models').NutrientVector>
    weekly: import('../domain/models').NutrientVector
    adherence: {
      calories: number
      protein: number
      carbs: number
      fat: number
    }
  }> {
    try {
      const plan = await this.planService.get(planId)
      if (!plan) {
        throw new Error('Meal plan not found')
      }

      // Calculate daily nutrition totals
      const daily: Record<string, import('../domain/models').NutrientVector> = {}
      const weeklyTotals: import('../domain/models').NutrientVector = {}

      plan.days.forEach(day => {
        const dayTotals = this.calculateDayNutrients(day)
        daily[day.date] = dayTotals

        // Add to weekly totals
        Object.keys(dayTotals).forEach(nutrient => {
          const key = nutrient as keyof import('../domain/models').NutrientVector
          weeklyTotals[key] = (weeklyTotals[key] || 0) + (dayTotals[key] || 0)
        })
      })

      // Calculate adherence percentages
      const adherence = this.calculateAdherence(plan, weeklyTotals)

      return {
        daily,
        weekly: weeklyTotals,
        adherence
      }
    } catch (error) {
      console.error('Error calculating plan nutrition:', error)
      throw new Error('Failed to calculate nutrition summary')
    }
  }

  /**
   * Helper: Calculate nutrition totals for a single day
   */
  private calculateDayNutrients(day: import('../domain/models').DayMealPlan): import('../domain/models').NutrientVector {
    const allMeals = [
      ...day.meals.breakfast,
      ...day.meals.lunch,
      ...day.meals.dinner,
      ...day.meals.snacks
    ]

    return allMeals.reduce((total, meal) => {
      const nutrients = meal.nutrients
      Object.keys(nutrients).forEach(nutrient => {
        const key = nutrient as keyof import('../domain/models').NutrientVector
        total[key] = (total[key] || 0) + (nutrients[key] || 0)
      })
      return total
    }, {} as import('../domain/models').NutrientVector)
  }

  /**
   * Helper: Calculate adherence to targets
   */
  private calculateAdherence(
    plan: WeeklyMealPlan,
    weeklyNutrients: import('../domain/models').NutrientVector
  ): { calories: number; protein: number; carbs: number; fat: number } {
    // Calculate weekly targets (sum of daily targets)
    const weeklyTargets = plan.days.reduce((totals, day) => {
      totals.calories += day.targetNutrients.calories
      totals.protein += day.targetNutrients.protein_g
      totals.carbs += day.targetNutrients.carbs_g
      totals.fat += day.targetNutrients.fat_g
      return totals
    }, { calories: 0, protein: 0, carbs: 0, fat: 0 })

    return {
      calories: weeklyTargets.calories > 0
        ? Math.round(((weeklyNutrients.calories || 0) / weeklyTargets.calories) * 100)
        : 0,
      protein: weeklyTargets.protein > 0
        ? Math.round(((weeklyNutrients.protein_g || 0) / weeklyTargets.protein) * 100)
        : 0,
      carbs: weeklyTargets.carbs > 0
        ? Math.round(((weeklyNutrients.carbs_g || 0) / weeklyTargets.carbs) * 100)
        : 0,
      fat: weeklyTargets.fat > 0
        ? Math.round(((weeklyNutrients.fat_g || 0) / weeklyTargets.fat) * 100)
        : 0
    }
  }
}