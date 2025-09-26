import { MealType, MealTimePreferences, LogEntry } from '@domain/models'
import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface MealCategorizationService {
  suggestMealType(timestamp: string, userPreferences?: MealTimePreferences): MealType
  categorizeFoodForMeal(foodName: string, mealType: MealType): MealSuitability
  getDefaultMealPreferences(): MealTimePreferences
  updateMealPreferences(userId: string, preferences: MealTimePreferences): Promise<void>
  getMealTypeFromTime(time: string, preferences?: MealTimePreferences): MealType
  getMealStats(entries: LogEntry[]): MealTypeStats
}

export interface MealSuitability {
  suitability: 'excellent' | 'good' | 'fair' | 'poor'
  confidence: number
  reasons: string[]
  suggestions?: string[]
}

export interface MealTypeStats {
  breakfast: { count: number; calories: number }
  lunch: { count: number; calories: number }
  dinner: { count: number; calories: number }
  snack: { count: number; calories: number }
  totalEntries: number
  totalCalories: number
}

// Food categorization patterns
const MEAL_FOOD_PATTERNS = {
  breakfast: {
    excellent: [
      'cereal', 'oatmeal', 'pancake', 'waffle', 'toast', 'bagel', 'muffin',
      'egg', 'bacon', 'sausage', 'hash brown', 'coffee', 'tea', 'orange juice',
      'yogurt', 'granola', 'fruit', 'smoothie', 'milk'
    ],
    good: [
      'bread', 'banana', 'apple', 'berry', 'cream cheese', 'butter', 'jam',
      'honey', 'maple syrup', 'croissant', 'danish'
    ],
    poor: [
      'pizza', 'burger', 'steak', 'pasta', 'soup', 'salad', 'sandwich'
    ]
  },
  lunch: {
    excellent: [
      'sandwich', 'salad', 'soup', 'wrap', 'burger', 'pizza', 'pasta',
      'rice', 'noodle', 'chicken', 'fish', 'vegetables', 'quinoa'
    ],
    good: [
      'bread', 'cheese', 'meat', 'turkey', 'ham', 'tuna', 'avocado',
      'tomato', 'lettuce', 'protein'
    ],
    poor: [
      'cereal', 'pancake', 'waffle', 'steak', 'heavy cream sauce'
    ]
  },
  dinner: {
    excellent: [
      'steak', 'chicken', 'fish', 'pork', 'beef', 'lamb', 'pasta', 'rice',
      'potato', 'vegetables', 'salad', 'soup', 'casserole', 'curry'
    ],
    good: [
      'bread', 'quinoa', 'beans', 'lentils', 'tofu', 'cheese', 'wine',
      'protein', 'roasted', 'grilled', 'baked'
    ],
    poor: [
      'cereal', 'granola', 'yogurt', 'fruit juice', 'coffee'
    ]
  },
  snack: {
    excellent: [
      'nuts', 'fruit', 'yogurt', 'cheese', 'crackers', 'granola bar',
      'protein bar', 'smoothie', 'popcorn', 'chips', 'cookies'
    ],
    good: [
      'chocolate', 'candy', 'ice cream', 'cake', 'muffin', 'pretzel',
      'trail mix', 'dried fruit'
    ],
    poor: [
      'steak', 'full meal', 'large portion', 'heavy sauce'
    ]
  }
}

// Default meal time windows
const DEFAULT_MEAL_TIMES: MealTimePreferences = {
  breakfast: { start: '06:00', end: '10:00' },
  lunch: { start: '11:30', end: '14:30' },
  dinner: { start: '17:00', end: '21:00' },
  snack: { flexible: true }
}

export class MealCategorizationServiceImpl implements MealCategorizationService {
  private userPreferences = new Map<string, MealTimePreferences>()

  suggestMealType(timestamp: string, userPreferences?: MealTimePreferences): MealType {
    try {
      const preferences = userPreferences || DEFAULT_MEAL_TIMES
      const time = new Date(timestamp).toTimeString().slice(0, 5) // HH:MM format

      return this.getMealTypeFromTime(time, preferences)

    } catch (error) {
      logger.error('Failed to suggest meal type', { timestamp, error })
      return 'snack' // Default fallback
    }
  }

  categorizeFoodForMeal(foodName: string, mealType: MealType): MealSuitability {
    try {
      const name = foodName.toLowerCase()
      const patterns = MEAL_FOOD_PATTERNS[mealType]

      const reasons: string[] = []
      const suggestions: string[] = []
      let suitability: MealSuitability['suitability'] = 'fair'
      let confidence = 0.5

      // Check excellent matches
      for (const pattern of patterns.excellent) {
        if (name.includes(pattern)) {
          suitability = 'excellent'
          confidence = 0.9
          reasons.push(`Perfect for ${mealType} - contains ${pattern}`)
          break
        }
      }

      // Check good matches if not excellent
      if (suitability !== 'excellent') {
        for (const pattern of patterns.good) {
          if (name.includes(pattern)) {
            suitability = 'good'
            confidence = 0.75
            reasons.push(`Good for ${mealType} - contains ${pattern}`)
            break
          }
        }
      }

      // Check poor matches
      for (const pattern of patterns.poor) {
        if (name.includes(pattern)) {
          suitability = 'poor'
          confidence = 0.3
          reasons.push(`Unusual for ${mealType} - contains ${pattern}`)

          // Provide suggestions for better meal types
          if (mealType === 'breakfast' && (name.includes('pizza') || name.includes('pasta'))) {
            suggestions.push('Consider logging as lunch or dinner instead')
          }
          if (mealType === 'dinner' && name.includes('cereal')) {
            suggestions.push('Consider logging as breakfast instead')
          }
          break
        }
      }

      // Time-based adjustments
      const currentHour = new Date().getHours()
      if (mealType === 'breakfast' && currentHour > 11) {
        confidence = Math.max(0.3, confidence - 0.2)
        reasons.push('Late for typical breakfast time')
      }
      if (mealType === 'dinner' && currentHour < 16) {
        confidence = Math.max(0.3, confidence - 0.2)
        reasons.push('Early for typical dinner time')
      }

      return {
        suitability,
        confidence,
        reasons,
        suggestions: suggestions.length > 0 ? suggestions : undefined
      }

    } catch (error) {
      logger.error('Failed to categorize food for meal', { foodName, mealType, error })
      return {
        suitability: 'fair',
        confidence: 0.5,
        reasons: ['Unable to analyze food suitability']
      }
    }
  }

  getDefaultMealPreferences(): MealTimePreferences {
    return { ...DEFAULT_MEAL_TIMES }
  }

  async updateMealPreferences(userId: string, preferences: MealTimePreferences): Promise<void> {
    try {
      // Validate time formats
      this.validateMealPreferences(preferences)

      // Store in memory cache
      this.userPreferences.set(userId, preferences)

      // In a real app, this would persist to database
      // For now, we'll emit an event for other services to handle
      eventBus.emit('user_preferences_updated', {
        userId,
        type: 'meal_times',
        preferences
      })

      logger.info('Updated meal preferences', { userId, preferences })

    } catch (error) {
      logger.error('Failed to update meal preferences', { userId, preferences, error })
      throw error
    }
  }

  getMealTypeFromTime(time: string, preferences?: MealTimePreferences): MealType {
    try {
      const prefs = preferences || DEFAULT_MEAL_TIMES

      // Convert time to minutes for easier comparison
      const [hours, minutes] = time.split(':').map(Number)
      const timeInMinutes = hours * 60 + minutes

      const isInWindow = (start: string, end: string): boolean => {
        const [startH, startM] = start.split(':').map(Number)
        const [endH, endM] = end.split(':').map(Number)
        const startMinutes = startH * 60 + startM
        const endMinutes = endH * 60 + endM

        return timeInMinutes >= startMinutes && timeInMinutes <= endMinutes
      }

      if (isInWindow(prefs.breakfast.start, prefs.breakfast.end)) {
        return 'breakfast'
      }
      if (isInWindow(prefs.lunch.start, prefs.lunch.end)) {
        return 'lunch'
      }
      if (isInWindow(prefs.dinner.start, prefs.dinner.end)) {
        return 'dinner'
      }

      // Default to snack if outside meal windows
      return 'snack'

    } catch (error) {
      logger.error('Failed to determine meal type from time', { time, error })
      return 'snack'
    }
  }

  getMealStats(entries: LogEntry[]): MealTypeStats {
    try {
      const stats: MealTypeStats = {
        breakfast: { count: 0, calories: 0 },
        lunch: { count: 0, calories: 0 },
        dinner: { count: 0, calories: 0 },
        snack: { count: 0, calories: 0 },
        totalEntries: entries.length,
        totalCalories: 0
      }

      entries.forEach(entry => {
        const mealType = entry.mealLabel || 'snack'
        const calories = entry.nutrients.calories || 0

        stats[mealType].count++
        stats[mealType].calories += calories
        stats.totalCalories += calories
      })

      // Round calories to 2 decimal places
      Object.keys(stats).forEach(key => {
        if (typeof stats[key as keyof MealTypeStats] === 'object' && 'calories' in stats[key as keyof MealTypeStats]) {
          const mealStat = stats[key as keyof MealTypeStats] as { count: number; calories: number }
          mealStat.calories = Math.round(mealStat.calories * 100) / 100
        }
      })
      stats.totalCalories = Math.round(stats.totalCalories * 100) / 100

      return stats

    } catch (error) {
      logger.error('Failed to calculate meal stats', { entriesCount: entries.length, error })
      return {
        breakfast: { count: 0, calories: 0 },
        lunch: { count: 0, calories: 0 },
        dinner: { count: 0, calories: 0 },
        snack: { count: 0, calories: 0 },
        totalEntries: 0,
        totalCalories: 0
      }
    }
  }

  // Advanced meal timing analysis
  analyzeMealTiming(entries: LogEntry[]): {
    averageMealTimes: Record<MealType, string>
    mealFrequency: Record<MealType, number>
    suggestions: string[]
  } {
    try {
      const mealTimes: Record<MealType, number[]> = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: []
      }

      const suggestions: string[] = []

      // Group entries by meal type and extract times
      entries.forEach(entry => {
        const mealType = entry.mealLabel || 'snack'
        const logTime = new Date(entry.loggedAt)
        const timeInMinutes = logTime.getHours() * 60 + logTime.getMinutes()
        mealTimes[mealType].push(timeInMinutes)
      })

      // Calculate averages
      const averageMealTimes: Record<MealType, string> = {
        breakfast: '07:30',
        lunch: '12:30',
        dinner: '19:00',
        snack: '15:00'
      }

      Object.entries(mealTimes).forEach(([mealType, times]) => {
        if (times.length > 0) {
          const avgMinutes = Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          const hours = Math.floor(avgMinutes / 60)
          const minutes = avgMinutes % 60
          averageMealTimes[mealType as MealType] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        }
      })

      // Calculate frequency
      const mealFrequency: Record<MealType, number> = {
        breakfast: mealTimes.breakfast.length,
        lunch: mealTimes.lunch.length,
        dinner: mealTimes.dinner.length,
        snack: mealTimes.snack.length
      }

      // Generate suggestions
      if (mealFrequency.breakfast < mealFrequency.lunch * 0.7) {
        suggestions.push('Consider eating breakfast more regularly for better energy throughout the day')
      }
      if (mealFrequency.snack > mealFrequency.lunch + mealFrequency.dinner) {
        suggestions.push('You might benefit from larger main meals to reduce snacking')
      }

      return { averageMealTimes, mealFrequency, suggestions }

    } catch (error) {
      logger.error('Failed to analyze meal timing', { entriesCount: entries.length, error })
      return {
        averageMealTimes: { breakfast: '07:30', lunch: '12:30', dinner: '19:00', snack: '15:00' },
        mealFrequency: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
        suggestions: []
      }
    }
  }

  private validateMealPreferences(preferences: MealTimePreferences): void {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/

    if (!timeRegex.test(preferences.breakfast.start) || !timeRegex.test(preferences.breakfast.end)) {
      throw new Error('Invalid breakfast time format')
    }
    if (!timeRegex.test(preferences.lunch.start) || !timeRegex.test(preferences.lunch.end)) {
      throw new Error('Invalid lunch time format')
    }
    if (!timeRegex.test(preferences.dinner.start) || !timeRegex.test(preferences.dinner.end)) {
      throw new Error('Invalid dinner time format')
    }

    // Validate that start times are before end times
    const validateTimeOrder = (start: string, end: string, mealName: string) => {
      const [startH, startM] = start.split(':').map(Number)
      const [endH, endM] = end.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (startMinutes >= endMinutes) {
        throw new Error(`${mealName} start time must be before end time`)
      }
    }

    validateTimeOrder(preferences.breakfast.start, preferences.breakfast.end, 'Breakfast')
    validateTimeOrder(preferences.lunch.start, preferences.lunch.end, 'Lunch')
    validateTimeOrder(preferences.dinner.start, preferences.dinner.end, 'Dinner')
  }

  // Clear cache for memory management
  clearUserPreferences(userId?: string): void {
    if (userId) {
      this.userPreferences.delete(userId)
    } else {
      this.userPreferences.clear()
    }
    logger.debug('Meal preferences cache cleared', { userId })
  }
}

// Singleton instance
export const mealCategorizationService = new MealCategorizationServiceImpl()