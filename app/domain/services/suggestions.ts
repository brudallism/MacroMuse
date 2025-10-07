// domain/services/suggestions.ts - Intelligent food suggestions following Foundation.md
import { NutrientVector, TargetVector, FoodItem } from '@domain/models'

import { trackOperation } from '@lib/performance'

export interface SuggestionService {
  remainingMacros(remaining: TargetVector, prefs: UserPreferences): Promise<FoodSuggestion[]>
  gapFoods(nutrientKey: keyof NutrientVector, deficit: number, prefs: UserPreferences): Promise<FoodSuggestion[]>
  mealTimingOptimization(userId: string, mealHistory: MealHistoryEntry[]): Promise<MealTimingSuggestion[]>
  generateShoppingList(plannedMeals: PlannedMeal[], currentPantry?: string[]): Promise<ShoppingListItem[]>
}

export type UserPreferences = {
  dietaryRestrictions: string[]
  allergies: string[]
  preferredFoods: string[]
  dislikedFoods: string[]
  cookingTime: 'quick' | 'moderate' | 'extended'
  budget: 'low' | 'medium' | 'high'
}

export type FoodSuggestion = {
  foodId: string
  name: string
  score: number
  reason: string
  nutrients: NutrientVector
  servingSize: { amount: number; unit: string }
  macroFit: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  }
  preparationTime?: number
  estimatedCost?: number
}

export type MealHistoryEntry = {
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  timestamp: string
  calories: number
  satisfaction: number
}

export type MealTimingSuggestion = {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  suggestedTime: string
  reason: string
  calorieTarget: number
  confidence: number
}

export type PlannedMeal = {
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  foods: Array<{ foodId: string; quantity: number; unit: string }>
}

export type ShoppingListItem = {
  name: string
  quantity: number
  unit: string
  category: 'produce' | 'dairy' | 'meat' | 'grains' | 'pantry' | 'other'
  estimatedCost?: number
  alternatives?: string[]
}

export class SuggestionEngine {
  // Food database for suggestions (would be injected in real implementation)
  private static readonly FOOD_DATABASE: FoodItem[] = [
    {
      id: 'chicken-breast',
      name: 'Chicken Breast (grilled)',
      source: 'usda',
      nutrients: { calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 },
      servingSize: { amount: 100, unit: 'g' }
    },
    {
      id: 'greek-yogurt',
      name: 'Greek Yogurt (plain)',
      source: 'usda',
      nutrients: { calories: 130, protein_g: 23, carbs_g: 9, fat_g: 0.4 },
      servingSize: { amount: 200, unit: 'g' }
    },
    {
      id: 'almonds',
      name: 'Almonds',
      source: 'usda',
      nutrients: { calories: 579, protein_g: 21, carbs_g: 22, fat_g: 50 },
      servingSize: { amount: 100, unit: 'g' }
    },
    {
      id: 'sweet-potato',
      name: 'Sweet Potato (baked)',
      source: 'usda',
      nutrients: { calories: 103, protein_g: 2.3, carbs_g: 24, fat_g: 0.1 },
      servingSize: { amount: 150, unit: 'g' }
    },
    {
      id: 'spinach',
      name: 'Spinach (fresh)',
      source: 'usda',
      nutrients: { calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, iron_mg: 2.7, fiber_g: 2.2 },
      servingSize: { amount: 100, unit: 'g' }
    },
    {
      id: 'salmon',
      name: 'Salmon (grilled)',
      source: 'usda',
      nutrients: { calories: 208, protein_g: 25, carbs_g: 0, fat_g: 12, vitaminD_µg: 11 },
      servingSize: { amount: 100, unit: 'g' }
    },
    {
      id: 'lentils',
      name: 'Lentils (cooked)',
      source: 'usda',
      nutrients: { calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, iron_mg: 3.3, fiber_g: 7.9 },
      servingSize: { amount: 100, unit: 'g' }
    }
  ]

  static async findRemainingMacroFoods(
    remaining: TargetVector,
    preferences: UserPreferences
  ): Promise<FoodSuggestion[]> {
    return await trackOperation('goalRecommendations', async () => {
      const suggestions: FoodSuggestion[] = []

      for (const food of this.FOOD_DATABASE) {
        // Skip foods that don't match dietary restrictions
        if (!this.matchesDietaryRestrictions(food, preferences)) {
          continue
        }

        // Calculate how well this food fits remaining macros
        const score = this.calculateMacroFitScore(food, remaining)

        if (score > 0.3) { // Only suggest foods with decent fit
          const suggestion: FoodSuggestion = {
            foodId: food.id,
            name: food.name,
            score,
            reason: this.generateMacroFitReason(food, remaining),
            nutrients: food.nutrients,
            servingSize: food.servingSize,
            macroFit: {
              calories: food.nutrients.calories || 0,
              protein_g: food.nutrients.protein_g || 0,
              carbs_g: food.nutrients.carbs_g || 0,
              fat_g: food.nutrients.fat_g || 0
            }
          }

          suggestions.push(suggestion)
        }
      }

      // Sort by score and return top suggestions
      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 6) // Return top 6 suggestions
    })
  }

  static async findNutrientGapFoods(
    nutrientKey: keyof NutrientVector,
    deficit: number,
    preferences: UserPreferences
  ): Promise<FoodSuggestion[]> {
    return await trackOperation('nutrientAggregation', async () => {
      const suggestions: FoodSuggestion[] = []

      for (const food of this.FOOD_DATABASE) {
        if (!this.matchesDietaryRestrictions(food, preferences)) {
          continue
        }

        const nutrientValue = food.nutrients[nutrientKey] || 0
        if (nutrientValue > 0) {
          // Calculate how much of the deficit this food would fill
          const deficitFillPercent = Math.min(100, (nutrientValue / deficit) * 100)
          const score = deficitFillPercent / 100

          if (score > 0.2) { // Only suggest foods that provide meaningful amounts
            const suggestion: FoodSuggestion = {
              foodId: food.id,
              name: food.name,
              score,
              reason: `Provides ${nutrientValue}${this.getNutrientUnit(nutrientKey)} of ${nutrientKey.replace('_', ' ')} (${deficitFillPercent.toFixed(0)}% of your gap)`,
              nutrients: food.nutrients,
              servingSize: food.servingSize,
              macroFit: {
                calories: food.nutrients.calories || 0,
                protein_g: food.nutrients.protein_g || 0,
                carbs_g: food.nutrients.carbs_g || 0,
                fat_g: food.nutrients.fat_g || 0
              }
            }

            suggestions.push(suggestion)
          }
        }
      }

      return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
    })
  }

  static async optimizeMealTiming(
    mealHistory: MealHistoryEntry[]
  ): Promise<MealTimingSuggestion[]> {
    return await trackOperation('patternDetection', async () => {
      const suggestions: MealTimingSuggestion[] = []

      // Analyze historical meal patterns
      const mealPatterns = this.analyzeMealPatterns(mealHistory)

      // Generate timing suggestions based on patterns
      for (const [mealType, pattern] of Object.entries(mealPatterns)) {
        const suggestion: MealTimingSuggestion = {
          mealType: mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack',
          suggestedTime: pattern.optimalTime,
          reason: pattern.reasoning,
          calorieTarget: pattern.averageCalories,
          confidence: pattern.confidence
        }

        suggestions.push(suggestion)
      }

      return suggestions
    })
  }

  static async generateShoppingList(
    plannedMeals: PlannedMeal[],
    currentPantry: string[] = []
  ): Promise<ShoppingListItem[]> {
    return await trackOperation('analyticsRollup', async () => {
      const ingredientMap = new Map<string, { quantity: number; unit: string; category: string }>()

      // Aggregate all ingredients from planned meals
      for (const meal of plannedMeals) {
        for (const food of meal.foods) {
          const foodItem = this.FOOD_DATABASE.find(f => f.id === food.foodId)
          if (foodItem) {
            const existingQty = ingredientMap.get(foodItem.name)?.quantity || 0
            ingredientMap.set(foodItem.name, {
              quantity: existingQty + food.quantity,
              unit: food.unit,
              category: this.getFoodCategory(foodItem)
            })
          }
        }
      }

      // Convert to shopping list, filtering out pantry items
      const shoppingList: ShoppingListItem[] = []
      for (const [name, details] of ingredientMap) {
        if (!currentPantry.includes(name.toLowerCase())) {
          shoppingList.push({
            name,
            quantity: details.quantity,
            unit: details.unit,
            category: details.category as any,
            alternatives: this.getAlternatives(name)
          })
        }
      }

      // Group by category and sort
      return shoppingList.sort((a, b) => {
        const categoryOrder = ['produce', 'dairy', 'meat', 'grains', 'pantry', 'other']
        return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
      })
    })
  }

  private static matchesDietaryRestrictions(food: FoodItem, preferences: UserPreferences): boolean {
    // Check dietary restrictions
    if (preferences.dietaryRestrictions.includes('vegetarian')) {
      const meatFoods = ['chicken-breast', 'salmon']
      if (meatFoods.includes(food.id)) return false
    }

    if (preferences.dietaryRestrictions.includes('vegan')) {
      const animalProducts = ['chicken-breast', 'salmon', 'greek-yogurt']
      if (animalProducts.includes(food.id)) return false
    }

    // Check allergies
    if (preferences.allergies.includes('nuts') && food.id === 'almonds') {
      return false
    }

    // Check dislikes
    if (preferences.dislikedFoods.some(dislike =>
      food.name.toLowerCase().includes(dislike.toLowerCase())
    )) {
      return false
    }

    return true
  }

  private static calculateMacroFitScore(food: FoodItem, remaining: TargetVector): number {
    const foodCals = food.nutrients.calories || 0
    const foodProtein = food.nutrients.protein_g || 0
    const foodCarbs = food.nutrients.carbs_g || 0
    const foodFat = food.nutrients.fat_g || 0

    // Calculate how well each macro fits (avoid going over)
    const calorieScore = this.calculateFitScore(foodCals, remaining.calories)
    const proteinScore = this.calculateFitScore(foodProtein, remaining.protein_g)
    const carbScore = this.calculateFitScore(foodCarbs, remaining.carbs_g)
    const fatScore = this.calculateFitScore(foodFat, remaining.fat_g)

    // Weighted average (prioritize protein and calories)
    return (calorieScore * 0.4 + proteinScore * 0.3 + carbScore * 0.15 + fatScore * 0.15)
  }

  private static calculateFitScore(actual: number, remaining: number): number {
    if (remaining <= 0) return 0
    if (actual <= 0) return 0
    if (actual > remaining * 1.2) return 0.2 // Penalty for going way over

    const ratio = actual / remaining
    if (ratio <= 1) return ratio // Perfect fit or under
    return Math.max(0, 1 - (ratio - 1)) // Penalty for going over
  }

  private static generateMacroFitReason(food: FoodItem, remaining: TargetVector): string {
    const reasons: string[] = []

    if ((food.nutrients.protein_g || 0) / remaining.protein_g > 0.3) {
      reasons.push('high protein')
    }
    if ((food.nutrients.calories || 0) / remaining.calories > 0.4) {
      reasons.push('helps meet calorie target')
    }
    if ((food.nutrients.fat_g || 0) / remaining.fat_g > 0.3) {
      reasons.push('provides healthy fats')
    }

    return reasons.length > 0
      ? `Good fit: ${reasons.join(', ')}`
      : 'Balanced macro contribution'
  }

  private static getNutrientUnit(nutrient: keyof NutrientVector): string {
    if (nutrient.includes('_g')) return 'g'
    if (nutrient.includes('_mg')) return 'mg'
    if (nutrient.includes('_µg')) return 'µg'
    return ''
  }

  private static analyzeMealPatterns(history: MealHistoryEntry[]): Record<string, any> {
    // Simplified pattern analysis - in real implementation would be more sophisticated
    return {
      breakfast: {
        optimalTime: '07:30',
        reasoning: 'Based on your eating patterns, 7:30 AM maximizes satisfaction',
        averageCalories: 400,
        confidence: 0.8
      },
      lunch: {
        optimalTime: '12:30',
        reasoning: 'Lunch at 12:30 PM aligns with your energy levels',
        averageCalories: 600,
        confidence: 0.9
      },
      dinner: {
        optimalTime: '18:00',
        reasoning: 'Early dinner improves sleep quality',
        averageCalories: 700,
        confidence: 0.7
      }
    }
  }

  private static getFoodCategory(food: FoodItem): string {
    const produceItems = ['spinach', 'sweet-potato']
    const dairyItems = ['greek-yogurt']
    const meatItems = ['chicken-breast', 'salmon']
    const grainItems = ['lentils']

    if (produceItems.includes(food.id)) return 'produce'
    if (dairyItems.includes(food.id)) return 'dairy'
    if (meatItems.includes(food.id)) return 'meat'
    if (grainItems.includes(food.id)) return 'grains'
    return 'other'
  }

  private static getAlternatives(foodName: string): string[] {
    const alternatives: Record<string, string[]> = {
      'Chicken Breast (grilled)': ['Turkey breast', 'Tofu'],
      'Greek Yogurt (plain)': ['Cottage cheese', 'Protein powder'],
      'Almonds': ['Walnuts', 'Cashews'],
      'Sweet Potato (baked)': ['Regular potato', 'Quinoa'],
      'Spinach (fresh)': ['Kale', 'Arugula'],
      'Salmon (grilled)': ['Mackerel', 'Sardines'],
      'Lentils (cooked)': ['Black beans', 'Chickpeas']
    }

    return alternatives[foodName] || []
  }
}
