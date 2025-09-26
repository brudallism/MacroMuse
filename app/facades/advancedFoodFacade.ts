import { FoodItem, LogEntry, MealType, NutrientVector } from '@domain/models'
import { recentFoodsService } from '@domain/services/recentFoods'
import { favoritesService } from '@domain/services/favorites'
import { customFoodsService, CustomFoodData } from '@domain/services/customFoods'
import { portionCalculatorService, ServingSize } from '@domain/services/portionCalculator'
import { mealCategorizationService, MealSuitability } from '@domain/services/mealCategorization'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'
import { trackOperation } from '@lib/performance'

export interface AdvancedFoodFacade {
  // Recent Foods
  getRecentFoods(userId: string, limit?: number): Promise<FoodItem[]>
  addToRecent(userId: string, food: FoodItem): Promise<void>
  clearRecent(userId: string): Promise<void>

  // Favorites
  getFavorites(userId: string, category?: string): Promise<FoodItem[]>
  addToFavorites(userId: string, food: FoodItem, category?: string): Promise<void>
  removeFromFavorites(userId: string, foodId: string): Promise<void>
  isFavorite(userId: string, foodId: string): Promise<boolean>
  getFavoriteCategories(userId: string): Promise<string[]>

  // Custom Foods
  createCustomFood(userId: string, data: CustomFoodData): Promise<FoodItem>
  updateCustomFood(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void>
  deleteCustomFood(userId: string, foodId: string): Promise<void>
  getCustomFoods(userId: string): Promise<FoodItem[]>

  // Portion Calculation
  calculateNutrients(food: FoodItem, targetAmount: number, targetUnit: string): NutrientVector
  getServingSuggestions(food: FoodItem): ServingSize[]
  convertUnits(amount: number, fromUnit: string, toUnit: string): number | null

  // Meal Categorization
  suggestMealType(timestamp?: string): MealType
  categorizeFoodForMeal(food: FoodItem, mealType: MealType): MealSuitability
  analyzeMealTiming(entries: LogEntry[]): MealAnalysis

  // Integrated Operations
  logFoodWithAdvancedFeatures(
    userId: string,
    food: FoodItem,
    amount: number,
    unit: string,
    mealType?: MealType,
    timestamp?: string
  ): Promise<LogEntry>

  // Analytics and Insights
  getFoodUsageStats(userId: string): Promise<FoodUsageStats>
  generateFoodRecommendations(userId: string, mealType?: MealType): Promise<FoodItem[]>

  // Cache Management
  clearCache(userId?: string): void
  getCacheStats(): CacheStats
}

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

class AdvancedFoodFacadeImpl implements AdvancedFoodFacade {
  constructor() {
    this.setupEventListeners()
  }

  // Recent Foods
  async getRecentFoods(userId: string, limit?: number): Promise<FoodItem[]> {
    return trackOperation('recent_foods_get', async () => {
      const foods = await recentFoodsService.getRecent(userId, limit)

      eventBus.emit('food_data_cached', {
        foodId: 'recent_foods_batch',
        source: 'recent_foods_get',
        cacheSize: foods.length
      })

      return foods
    })
  }

  async addToRecent(userId: string, food: FoodItem): Promise<void> {
    return trackOperation('recent_foods_add', async () => {
      await recentFoodsService.addToRecent(userId, food)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'food_added_to_recent',
        metadata: { foodId: food.id, foodName: food.name }
      })
    })
  }

  async clearRecent(userId: string): Promise<void> {
    await recentFoodsService.clearRecent(userId)

    eventBus.emit('user_activity_tracked', {
      userId,
      activity: 'recent_foods_cleared',
      metadata: {}
    })
  }

  // Favorites
  async getFavorites(userId: string, category?: string): Promise<FoodItem[]> {
    return trackOperation('favorites_get', async () => {
      const foods = await favoritesService.getFavorites(userId, category)

      eventBus.emit('food_data_cached', {
        foodId: 'favorites_batch',
        source: 'favorites_get',
        cacheSize: foods.length
      })

      return foods
    })
  }

  async addToFavorites(userId: string, food: FoodItem, category?: string): Promise<void> {
    return trackOperation('favorites_add', async () => {
      await favoritesService.addToFavorites(userId, food, category)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'food_favorited',
        metadata: { foodId: food.id, foodName: food.name, category }
      })
    })
  }

  async removeFromFavorites(userId: string, foodId: string): Promise<void> {
    return trackOperation('favorites_remove', async () => {
      await favoritesService.removeFromFavorites(userId, foodId)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'food_unfavorited',
        metadata: { foodId }
      })
    })
  }

  async isFavorite(userId: string, foodId: string): Promise<boolean> {
    return favoritesService.isFavorite(userId, foodId)
  }

  async getFavoriteCategories(userId: string): Promise<string[]> {
    return favoritesService.getFavoriteCategories(userId)
  }

  // Custom Foods
  async createCustomFood(userId: string, data: CustomFoodData): Promise<FoodItem> {
    return trackOperation('custom_food_create', async () => {
      const food = await customFoodsService.createCustomFood(userId, data)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'custom_food_created',
        metadata: { foodId: food.id, foodName: food.name }
      })

      eventBus.emit('food_data_cached', {
        foodId: food.id,
        source: 'custom_food_created',
        cacheSize: 1
      })

      return food
    })
  }

  async updateCustomFood(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void> {
    return trackOperation('custom_food_update', async () => {
      await customFoodsService.updateCustomFood(userId, foodId, data)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'custom_food_updated',
        metadata: { foodId, updatedFields: Object.keys(data) }
      })
    })
  }

  async deleteCustomFood(userId: string, foodId: string): Promise<void> {
    return trackOperation('custom_food_delete', async () => {
      await customFoodsService.deleteCustomFood(userId, foodId)

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'custom_food_deleted',
        metadata: { foodId }
      })
    })
  }

  async getCustomFoods(userId: string): Promise<FoodItem[]> {
    return trackOperation('custom_foods_get', async () => {
      const foods = await customFoodsService.getCustomFoods(userId)

      eventBus.emit('food_data_cached', {
        foodId: 'custom_foods_batch',
        source: 'custom_foods_get',
        cacheSize: foods.length
      })

      return foods
    })
  }

  // Portion Calculation
  calculateNutrients(food: FoodItem, targetAmount: number, targetUnit: string): NutrientVector {
    return portionCalculatorService.calculateNutrients(
      food.nutrients,
      food.servingSize.amount,
      targetAmount,
      food.servingSize.unit,
      targetUnit
    )
  }

  getServingSuggestions(food: FoodItem): ServingSize[] {
    return portionCalculatorService.suggestServingSizes(food)
  }

  convertUnits(amount: number, fromUnit: string, toUnit: string): number | null {
    return portionCalculatorService.convertUnits(amount, fromUnit, toUnit)
  }

  // Meal Categorization
  suggestMealType(timestamp?: string): MealType {
    return mealCategorizationService.suggestMealType(timestamp || new Date().toISOString())
  }

  categorizeFoodForMeal(food: FoodItem, mealType: MealType): MealSuitability {
    return mealCategorizationService.categorizeFoodForMeal(food.name, mealType)
  }

  analyzeMealTiming(entries: LogEntry[]): MealAnalysis {
    const baseAnalysis = mealCategorizationService.analyzeMealTiming(entries)

    // Enhance with additional patterns
    const patterns = {
      mostActiveHour: this.calculateMostActiveHour(entries),
      averageEntriesPerDay: this.calculateAverageEntriesPerDay(entries),
      preferredMealTypes: this.calculatePreferredMealTypes(entries)
    }

    return {
      ...baseAnalysis,
      patterns
    }
  }

  // Integrated Operations
  async logFoodWithAdvancedFeatures(
    userId: string,
    food: FoodItem,
    amount: number,
    unit: string,
    mealType?: MealType,
    timestamp?: string
  ): Promise<LogEntry> {
    return trackOperation('advanced_food_log', async () => {
      const logTimestamp = timestamp || new Date().toISOString()

      // Auto-suggest meal type if not provided
      const finalMealType = mealType || this.suggestMealType(logTimestamp)

      // Calculate adjusted nutrients
      const adjustedNutrients = this.calculateNutrients(food, amount, unit)

      // Create log entry
      const logEntry: LogEntry = {
        userId,
        loggedAt: logTimestamp,
        source: food.source,
        sourceId: food.id,
        qty: amount,
        unit,
        nutrients: adjustedNutrients,
        mealLabel: finalMealType
      }

      // Add to recent foods asynchronously
      this.addToRecent(userId, food).catch(error => {
        logger.error('Failed to add to recent foods', { foodId: food.id, error })
      })

      // Emit events
      eventBus.emit('food_logged', {
        userId,
        foodId: food.id,
        foodName: food.name,
        mealType: finalMealType,
        calories: adjustedNutrients.calories || 0,
        loggedAt: logTimestamp
      })

      // Analyze meal suitability for insights
      const suitability = this.categorizeFoodForMeal(food, finalMealType)
      if (suitability.suitability === 'poor') {
        eventBus.emit('user_activity_tracked', {
          userId,
          activity: 'unusual_meal_choice',
          metadata: {
            foodId: food.id,
            mealType: finalMealType,
            suitability: suitability.suitability,
            reasons: suitability.reasons
          }
        })
      }

      logger.info('Food logged with advanced features', {
        userId,
        foodId: food.id,
        mealType: finalMealType,
        amount,
        unit,
        suitability: suitability.suitability
      })

      return logEntry
    })
  }

  // Analytics and Insights
  async getFoodUsageStats(userId: string): Promise<FoodUsageStats> {
    return trackOperation('food_usage_stats', async () => {
      const [recentFoods, favoriteFoods, customFoods, categories] = await Promise.all([
        this.getRecentFoods(userId),
        this.getFavorites(userId),
        this.getCustomFoods(userId),
        this.getFavoriteCategories(userId)
      ])

      // Calculate most used foods
      const allFoods = [...recentFoods, ...favoriteFoods, ...customFoods]
      const mostUsedFoods = allFoods
        .filter(food => food.usageCount && food.usageCount > 0)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 10)
        .map(food => ({ food, usageCount: food.usageCount || 0 }))

      // Calculate average nutrition profile
      const averageNutritionProfile = this.calculateAverageNutritionProfile(allFoods)

      return {
        totalFoods: allFoods.length,
        recentCount: recentFoods.length,
        favoriteCount: favoriteFoods.length,
        customCount: customFoods.length,
        mostUsedFoods,
        favoriteCategories: categories,
        averageNutritionProfile
      }
    })
  }

  async generateFoodRecommendations(userId: string, mealType?: MealType): Promise<FoodItem[]> {
    return trackOperation('food_recommendations', async () => {
      const [recentFoods, favoriteFoods] = await Promise.all([
        this.getRecentFoods(userId, 20),
        this.getFavorites(userId)
      ])

      const currentMealType = mealType || this.suggestMealType()

      // Combine and score foods based on various factors
      const allFoods = [...new Set([...recentFoods, ...favoriteFoods])]
      const scoredFoods = allFoods
        .map(food => {
          const suitability = this.categorizeFoodForMeal(food, currentMealType)
          const recentScore = food.usageCount ? Math.log(food.usageCount + 1) : 0
          const favoriteScore = food.isFavorite ? 2 : 0
          const suitabilityScore = this.getSuitabilityScore(suitability.suitability)

          return {
            food,
            score: recentScore + favoriteScore + suitabilityScore
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map(item => item.food)

      logger.info('Generated food recommendations', {
        userId,
        mealType: currentMealType,
        recommendationCount: scoredFoods.length
      })

      return scoredFoods
    })
  }

  // Cache Management
  clearCache(userId?: string): void {
    recentFoodsService.clearCache()
    favoritesService.clearCache(userId)
    customFoodsService.clearCache(userId)

    eventBus.emit('cache_cleared', {
      scope: userId ? 'user' : 'global',
      userId: userId || 'all'
    })
  }

  getCacheStats(): CacheStats {
    return {
      recent: recentFoodsService.getCacheStats(),
      favorites: favoritesService.getCacheStats(),
      custom: customFoodsService.getCacheStats(),
      totalMemoryUsage: this.estimateMemoryUsage()
    }
  }

  // Private helper methods
  private setupEventListeners(): void {
    // Listen for performance issues
    eventBus.on('performance_budget_exceeded', (data) => {
      if (data.operation.includes('food') && data.actualMs > 1000) {
        logger.warn('Advanced food operation performance issue', data)
      }
    })

    // Listen for cache events
    eventBus.on('cache_cleared', (data) => {
      logger.info('Cache cleared event received', data)
    })

    // Listen for user activity for analytics
    eventBus.on('user_activity_tracked', (data) => {
      logger.debug('User activity tracked', data)
    })
  }

  private calculateMostActiveHour(entries: LogEntry[]): number {
    const hourCounts = new Array(24).fill(0)

    entries.forEach(entry => {
      const hour = new Date(entry.loggedAt).getHours()
      hourCounts[hour]++
    })

    return hourCounts.indexOf(Math.max(...hourCounts))
  }

  private calculateAverageEntriesPerDay(entries: LogEntry[]): number {
    if (entries.length === 0) return 0

    const dates = new Set(entries.map(entry =>
      new Date(entry.loggedAt).toDateString()
    ))

    return Math.round((entries.length / dates.size) * 100) / 100
  }

  private calculatePreferredMealTypes(entries: LogEntry[]): MealType[] {
    const mealCounts: Record<MealType, number> = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0
    }

    entries.forEach(entry => {
      if (entry.mealLabel) {
        mealCounts[entry.mealLabel]++
      }
    })

    return Object.entries(mealCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([mealType]) => mealType as MealType)
  }

  private calculateAverageNutritionProfile(foods: FoodItem[]): NutrientVector {
    if (foods.length === 0) {
      return {}
    }

    const totals: Partial<NutrientVector> = {}
    const counts: Record<string, number> = {}

    foods.forEach(food => {
      Object.entries(food.nutrients).forEach(([nutrient, value]) => {
        if (typeof value === 'number') {
          totals[nutrient as keyof NutrientVector] = (totals[nutrient as keyof NutrientVector] || 0) + value
          counts[nutrient] = (counts[nutrient] || 0) + 1
        }
      })
    })

    const averages: Partial<NutrientVector> = {}
    Object.entries(totals).forEach(([nutrient, total]) => {
      if (typeof total === 'number' && counts[nutrient]) {
        averages[nutrient as keyof NutrientVector] = Math.round((total / counts[nutrient]) * 100) / 100
      }
    })

    return averages as NutrientVector
  }

  private getSuitabilityScore(suitability: string): number {
    switch (suitability) {
      case 'excellent': return 3
      case 'good': return 2
      case 'fair': return 1
      case 'poor': return 0
      default: return 1
    }
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in KB
    const stats = {
      recent: recentFoodsService.getCacheStats(),
      favorites: favoritesService.getCacheStats(),
      custom: customFoodsService.getCacheStats()
    }

    // Estimate ~1KB per food item (rough approximation)
    return stats.recent.totalEntries + stats.favorites.totalFavorites + stats.custom.totalCustomFoods
  }
}

// Singleton instance
export const advancedFoodFacade = new AdvancedFoodFacadeImpl()