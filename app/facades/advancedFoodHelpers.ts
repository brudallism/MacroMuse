import { FoodItem, LogEntry, MealType, NutrientVector } from '@domain/models'
import { portionCalculatorService, ServingSize } from '@domain/services/portionCalculator'
import { mealCategorizationService, MealSuitability } from '@domain/services/mealCategorization'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'
import { trackOperation } from '@lib/performance'

export interface MealAnalysis {
  averageMealTimes: Record<MealType, string>
  mealFrequency: Record<MealType, number>
  suggestions: string[]
  patterns: {
    mostActiveHour: number
    averageEntriesPerDay: number
    preferredMealTypes: MealType[]
  }
}

export interface FoodUsageStats {
  totalFoods: number
  recentCount: number
  favoriteCount: number
  customCount: number
  mostUsedFoods: Array<{ food: FoodItem; usageCount: number }>
  favoriteCategories: string[]
  averageNutritionProfile: NutrientVector
}

export interface CacheStats {
  recent: { userCount: number; totalEntries: number }
  favorites: { userCount: number; totalFavorites: number }
  custom: { userCount: number; totalCustomFoods: number }
  totalMemoryUsage: number
}

export class AdvancedFoodHelpers {
  // Portion Calculation
  static calculateNutrients(food: FoodItem, targetAmount: number, targetUnit: string): NutrientVector {
    return trackOperation('calculate_nutrients', () => {
      try {
        const nutrients = portionCalculatorService.calculateNutrients(
          food.nutrients,
          food.servingSize.amount,
          targetAmount,
          food.servingSize.unit,
          targetUnit
        )

        eventBus.emit('nutrition_calculated', {
          foodId: food.id,
          originalServing: food.servingSize,
          targetServing: { amount: targetAmount, unit: targetUnit },
          calculatedNutrients: nutrients
        })

        return nutrients
      } catch (error) {
        logger.error('Failed to calculate nutrients:', { error, food, targetAmount, targetUnit })
        throw error
      }
    })
  }

  static getServingSuggestions(food: FoodItem): ServingSize[] {
    return trackOperation('serving_suggestions', () => {
      try {
        return portionCalculatorService.suggestServingSizes(food)
      } catch (error) {
        logger.error('Failed to get serving suggestions:', { error, food })
        return []
      }
    })
  }

  static convertUnits(amount: number, fromUnit: string, toUnit: string): number | null {
    return trackOperation('convert_units', () => {
      try {
        return portionCalculatorService.convertUnits(amount, fromUnit, toUnit)
      } catch (error) {
        logger.error('Failed to convert units:', { error, amount, fromUnit, toUnit })
        return null
      }
    })
  }

  // Meal Categorization
  static suggestMealType(timestamp?: string): MealType {
    return trackOperation('suggest_meal_type', () => {
      try {
        const time = timestamp ? new Date(timestamp) : new Date()
        const suggestion = mealCategorizationService.suggestMealType(time)

        eventBus.emit('meal_type_suggested', {
          timestamp: time.toISOString(),
          suggestedMealType: suggestion
        })

        return suggestion
      } catch (error) {
        logger.error('Failed to suggest meal type:', { error, timestamp })
        return 'snack' // Safe fallback
      }
    })
  }

  static categorizeFoodForMeal(food: FoodItem, mealType: MealType): MealSuitability {
    return trackOperation('categorize_food_for_meal', () => {
      try {
        return mealCategorizationService.categorizeFoodForMeal(food.name, mealType)
      } catch (error) {
        logger.error('Failed to categorize food for meal:', { error, food, mealType })
        return { suitability: 'fair', reasons: ['Unable to analyze'] }
      }
    })
  }

  static analyzeMealTiming(entries: LogEntry[]): MealAnalysis {
    return trackOperation('analyze_meal_timing', () => {
      try {
        const analysis = mealCategorizationService.analyzeMealPatterns(entries)

        eventBus.emit('meal_analysis_completed', {
          entryCount: entries.length,
          analysis
        })

        return analysis
      } catch (error) {
        logger.error('Failed to analyze meal timing:', { error, entryCount: entries.length })

        // Return safe fallback analysis
        return {
          averageMealTimes: {
            breakfast: '08:00',
            lunch: '12:30',
            dinner: '18:30',
            snack: '15:00'
          },
          mealFrequency: {
            breakfast: 0,
            lunch: 0,
            dinner: 0,
            snack: 0
          },
          suggestions: ['Unable to analyze meal patterns'],
          patterns: {
            mostActiveHour: 12,
            averageEntriesPerDay: 0,
            preferredMealTypes: []
          }
        }
      }
    })
  }

  // Analytics and Insights
  static async generateFoodRecommendations(
    userId: string,
    mealType?: MealType,
    userFavorites: FoodItem[] = [],
    userRecent: FoodItem[] = []
  ): Promise<FoodItem[]> {
    return trackOperation('generate_food_recommendations', async () => {
      try {
        // Simple recommendation logic based on favorites and recent foods
        const recommendations: FoodItem[] = []

        // Prioritize favorites for the specific meal type
        if (mealType) {
          const suitableFavorites = userFavorites.filter(food => {
            const suitability = this.categorizeFoodForMeal(food, mealType)
            return suitability.suitability === 'excellent' || suitability.suitability === 'good'
          })
          recommendations.push(...suitableFavorites.slice(0, 3))
        }

        // Add some recent foods that haven't been recommended yet
        const recentNotInRecommendations = userRecent.filter(food =>
          !recommendations.some(rec => rec.id === food.id)
        )
        recommendations.push(...recentNotInRecommendations.slice(0, 2))

        eventBus.emit('recommendations_generated', {
          userId,
          mealType,
          recommendationCount: recommendations.length
        })

        return recommendations.slice(0, 5) // Limit to 5 recommendations
      } catch (error) {
        logger.error('Failed to generate food recommendations:', { error, userId, mealType })
        return []
      }
    })
  }

  static calculateFoodUsageStats(
    recentFoods: FoodItem[],
    favoriteFoods: FoodItem[],
    customFoods: FoodItem[],
    favoriteCategories: string[]
  ): FoodUsageStats {
    return trackOperation('calculate_food_usage_stats', () => {
      try {
        // Calculate average nutrition profile from favorites (they represent user preferences)
        const averageNutritionProfile: NutrientVector = favoriteFoods.length > 0
          ? this.calculateAverageNutrients(favoriteFoods)
          : { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }

        // Mock usage count data (in real implementation, this would come from usage tracking)
        const mostUsedFoods = [...recentFoods, ...favoriteFoods]
          .slice(0, 10)
          .map(food => ({ food, usageCount: Math.floor(Math.random() * 20) + 1 }))
          .sort((a, b) => b.usageCount - a.usageCount)

        return {
          totalFoods: recentFoods.length + favoriteFoods.length + customFoods.length,
          recentCount: recentFoods.length,
          favoriteCount: favoriteFoods.length,
          customCount: customFoods.length,
          mostUsedFoods,
          favoriteCategories,
          averageNutritionProfile
        }
      } catch (error) {
        logger.error('Failed to calculate food usage stats:', { error })
        return {
          totalFoods: 0,
          recentCount: 0,
          favoriteCount: 0,
          customCount: 0,
          mostUsedFoods: [],
          favoriteCategories: [],
          averageNutritionProfile: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
        }
      }
    })
  }

  static getCacheStats(): CacheStats {
    return trackOperation('get_cache_stats', () => {
      try {
        // Mock cache statistics (in real implementation, this would query actual cache)
        return {
          recent: { userCount: 0, totalEntries: 0 },
          favorites: { userCount: 0, totalFavorites: 0 },
          custom: { userCount: 0, totalCustomFoods: 0 },
          totalMemoryUsage: 0
        }
      } catch (error) {
        logger.error('Failed to get cache stats:', { error })
        return {
          recent: { userCount: 0, totalEntries: 0 },
          favorites: { userCount: 0, totalFavorites: 0 },
          custom: { userCount: 0, totalCustomFoods: 0 },
          totalMemoryUsage: 0
        }
      }
    })
  }

  // Utility methods
  private static calculateAverageNutrients(foods: FoodItem[]): NutrientVector {
    if (foods.length === 0) {
      return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    }

    const totals = foods.reduce((acc, food) => ({
      calories: acc.calories + food.nutrients.calories,
      protein_g: acc.protein_g + food.nutrients.protein_g,
      carbs_g: acc.carbs_g + food.nutrients.carbs_g,
      fat_g: acc.fat_g + food.nutrients.fat_g
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 })

    const count = foods.length
    return {
      calories: Math.round(totals.calories / count),
      protein_g: Math.round((totals.protein_g / count) * 10) / 10,
      carbs_g: Math.round((totals.carbs_g / count) * 10) / 10,
      fat_g: Math.round((totals.fat_g / count) * 10) / 10
    }
  }

  static clearCache(userId?: string): void {
    trackOperation('clear_cache', () => {
      try {
        // In real implementation, this would clear actual caches
        logger.info('Cache cleared', { userId })

        eventBus.emit('cache_cleared', {
          userId: userId || 'all',
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        logger.error('Failed to clear cache:', { error, userId })
      }
    })
  }
}