// domain/services/plans.ts - Pure TypeScript meal planning services
import {
  WeeklyMealPlan,
  DayMealPlan,
  PlannedMeal,
  ShoppingItem,
  TargetVector,
  NutrientVector,
  LogEntry,
  RecipeData
} from '../models'

export interface PlanService {
  createWeek(startISO: string, userId: string): Promise<string>
  get(planId: string): Promise<WeeklyMealPlan | null>
  getByUser(userId: string): Promise<WeeklyMealPlan[]>
  update(planId: string, data: Partial<WeeklyMealPlan>): Promise<void>
  delete(planId: string): Promise<void>
  addMealToPlan(planId: string, day: number, mealType: string, meal: PlannedMeal): Promise<void>
  removeMealFromPlan(planId: string, mealId: string): Promise<void>
  moveMeal(planId: string, mealId: string, targetDay: number, targetMealType: string): Promise<void>
  applyToLedger(planId: string, userId: string): Promise<void>
  shoppingList(planId: string): Promise<ShoppingItem[]>
  duplicate(planId: string, userId: string, newStartDate: string): Promise<string>
}

export interface PlanRepository {
  save(plan: WeeklyMealPlan): Promise<string>
  update(id: string, data: Partial<WeeklyMealPlan>): Promise<void>
  findById(id: string): Promise<WeeklyMealPlan | null>
  findByUserId(userId: string): Promise<WeeklyMealPlan[]>
  delete(id: string): Promise<void>
  addPlannedMeal(planId: string, day: number, mealType: string, meal: PlannedMeal): Promise<void>
  removePlannedMeal(planId: string, mealId: string): Promise<void>
  updatePlannedMeal(planId: string, mealId: string, updates: Partial<PlannedMeal>): Promise<void>
}

// Pure calculation functions for meal planning
export const calculateDayNutrients = (dayPlan: DayMealPlan): NutrientVector => {
  const allMeals = [
    ...dayPlan.meals.breakfast,
    ...dayPlan.meals.lunch,
    ...dayPlan.meals.dinner,
    ...dayPlan.meals.snacks
  ]

  return allMeals.reduce((total, meal) => {
    return addNutrients(total, meal.nutrients)
  }, {} as NutrientVector)
}

export const calculateWeekNutrients = (plan: WeeklyMealPlan): NutrientVector => {
  return plan.days.reduce((total, day) => {
    const dayNutrients = calculateDayNutrients(day)
    return addNutrients(total, dayNutrients)
  }, {} as NutrientVector)
}

export const generateShoppingList = (plan: WeeklyMealPlan, recipes: RecipeData[]): ShoppingItem[] => {
  const ingredientMap = new Map<string, {
    totalAmount: number
    unit: string
    recipeNames: Set<string>
    category?: string
  }>()

  // Aggregate ingredients from all planned meals
  for (const day of plan.days) {
    for (const [mealType, meals] of Object.entries(day.meals)) {
      for (const meal of meals) {
        if (meal.type === 'recipe' && meal.recipeId) {
          const recipe = recipes.find(r => r.id === meal.recipeId)
          if (!recipe) continue

          for (const ingredient of recipe.ingredients) {
            const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`
            const existing = ingredientMap.get(key)

            // Scale ingredient amount by meal servings
            const scaledAmount = ingredient.amount * meal.servings

            if (existing) {
              existing.totalAmount += scaledAmount
              existing.recipeNames.add(recipe.name)
            } else {
              ingredientMap.set(key, {
                totalAmount: scaledAmount,
                unit: ingredient.unit,
                recipeNames: new Set([recipe.name]),
                category: categorizeIngredient(ingredient.name)
              })
            }
          }
        }
      }
    }
  }

  // Convert to shopping list format
  return Array.from(ingredientMap.entries())
    .map(([key, data]) => ({
      name: key.split('_')[0],
      amount: Math.ceil(data.totalAmount * 100) / 100, // Round up
      unit: data.unit,
      category: data.category,
      recipeNames: Array.from(data.recipeNames)
    }))
    .sort((a, b) => {
      // Sort by category first, then by name
      if (a.category && b.category && a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.name.localeCompare(b.name)
    })
}

export const convertPlanToLogEntries = (
  plan: WeeklyMealPlan,
  userId: string
): LogEntry[] => {
  const entries: LogEntry[] = []

  for (const day of plan.days) {
    for (const [mealType, meals] of Object.entries(day.meals)) {
      for (const plannedMeal of meals) {
        entries.push({
          userId,
          loggedAt: `${day.date}T12:00:00.000Z`, // Default to midday
          source: plannedMeal.type === 'recipe' ? 'custom' : 'planned',
          sourceId: plannedMeal.foodId || plannedMeal.recipeId,
          qty: plannedMeal.servings,
          unit: plannedMeal.unit,
          nutrients: plannedMeal.nutrients,
          mealLabel: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          recipeId: plannedMeal.type === 'recipe' ? plannedMeal.recipeId : undefined
        })
      }
    }
  }

  return entries
}

export const createEmptyWeekPlan = (
  startDate: string,
  userId: string,
  userTargets: TargetVector
): Omit<WeeklyMealPlan, 'id' | 'createdAt' | 'updatedAt'> => {
  const startDateObj = new Date(startDate)
  const endDateObj = new Date(startDateObj)
  endDateObj.setDate(endDateObj.getDate() + 6)

  const days: DayMealPlan[] = []

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDateObj)
    currentDate.setDate(currentDate.getDate() + i)

    days.push({
      date: currentDate.toISOString().split('T')[0],
      meals: {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      },
      targetNutrients: userTargets,
      plannedNutrients: {}
    })
  }

  return {
    userId,
    startDate: startDateObj.toISOString().split('T')[0],
    endDate: endDateObj.toISOString().split('T')[0],
    days
  }
}

export const validateMealPlan = (plan: Partial<WeeklyMealPlan>): string[] => {
  const errors: string[] = []

  if (!plan.startDate) {
    errors.push('Start date is required')
  }

  if (!plan.endDate) {
    errors.push('End date is required')
  }

  if (plan.startDate && plan.endDate && new Date(plan.startDate) >= new Date(plan.endDate)) {
    errors.push('End date must be after start date')
  }

  if (!plan.days || plan.days.length === 0) {
    errors.push('Meal plan must have at least one day')
  }

  if (plan.days) {
    plan.days.forEach((day, index) => {
      if (!day.date) {
        errors.push(`Day ${index + 1} must have a date`)
      }

      if (!day.meals) {
        errors.push(`Day ${index + 1} must have meal structure`)
      }
    })
  }

  return errors
}

// Helper functions
const addNutrients = (a: NutrientVector, b: NutrientVector): NutrientVector => {
  const result: NutrientVector = {}
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of allKeys) {
    const keyTyped = key as keyof NutrientVector
    const valueA = a[keyTyped] || 0
    const valueB = b[keyTyped] || 0

    if (valueA > 0 || valueB > 0) {
      result[keyTyped] = Math.round((valueA + valueB) * 100) / 100
    }
  }

  return result
}

const categorizeIngredient = (name: string): string => {
  const ingredient = name.toLowerCase()

  if (ingredient.includes('meat') || ingredient.includes('chicken') || ingredient.includes('beef') ||
      ingredient.includes('pork') || ingredient.includes('turkey') || ingredient.includes('fish') ||
      ingredient.includes('salmon') || ingredient.includes('tuna')) {
    return 'meat-seafood'
  }

  if (ingredient.includes('milk') || ingredient.includes('cheese') || ingredient.includes('yogurt') ||
      ingredient.includes('cream') || ingredient.includes('butter')) {
    return 'dairy'
  }

  if (ingredient.includes('apple') || ingredient.includes('banana') || ingredient.includes('orange') ||
      ingredient.includes('berry') || ingredient.includes('grape') || ingredient.includes('fruit')) {
    return 'fruits'
  }

  if (ingredient.includes('carrot') || ingredient.includes('broccoli') || ingredient.includes('spinach') ||
      ingredient.includes('onion') || ingredient.includes('pepper') || ingredient.includes('vegetable')) {
    return 'vegetables'
  }

  if (ingredient.includes('bread') || ingredient.includes('rice') || ingredient.includes('pasta') ||
      ingredient.includes('flour') || ingredient.includes('cereal') || ingredient.includes('oats')) {
    return 'grains'
  }

  if (ingredient.includes('oil') || ingredient.includes('vinegar') || ingredient.includes('sauce') ||
      ingredient.includes('spice') || ingredient.includes('herb') || ingredient.includes('salt')) {
    return 'condiments-spices'
  }

  return 'other'
}
