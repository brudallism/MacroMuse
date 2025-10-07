import { CustomFood, FoodItem, NutrientVector } from '@domain/models'

import { CustomFoodsRepository, CustomFoodData } from '@infra/repositories/CustomFoodsRepository'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'

export interface CustomFoodsService {
  createCustomFood(userId: string, data: CustomFoodData): Promise<FoodItem>
  updateCustomFood(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void>
  deleteCustomFood(userId: string, foodId: string): Promise<void>
  getCustomFoods(userId: string): Promise<FoodItem[]>
  getCustomFood(userId: string, foodId: string): Promise<FoodItem | null>
  validateNutrients(nutrients: Partial<NutrientVector>): ValidationResult
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface NutrientValidation {
  min?: number
  max?: number
  required?: boolean
  unit: string
}

// Validation rules for nutrients
const NUTRIENT_VALIDATION: Record<string, NutrientValidation> = {
  calories: { min: 0, max: 2000, required: true, unit: 'kcal' },
  protein_g: { min: 0, max: 100, required: true, unit: 'g' },
  carbs_g: { min: 0, max: 100, required: true, unit: 'g' },
  fat_g: { min: 0, max: 100, required: true, unit: 'g' },
  fiber_g: { min: 0, max: 50, unit: 'g' },
  sodium_mg: { min: 0, max: 5000, unit: 'mg' },
  totalSugars_g: { min: 0, max: 100, unit: 'g' },
  addedSugars_g: { min: 0, max: 100, unit: 'g' },
  saturatedFat_g: { min: 0, max: 50, unit: 'g' },
  cholesterol_mg: { min: 0, max: 1000, unit: 'mg' },
  calcium_mg: { min: 0, max: 2000, unit: 'mg' },
  iron_mg: { min: 0, max: 50, unit: 'mg' },
  potassium_mg: { min: 0, max: 5000, unit: 'mg' },
  vitaminC_mg: { min: 0, max: 1000, unit: 'mg' },
  vitaminA_µg: { min: 0, max: 3000, unit: 'µg' }
}

export class CustomFoodsServiceImpl implements CustomFoodsService {
  private cache = new Map<string, FoodItem[]>()

  constructor(private repository: CustomFoodsRepository) {}

  async createCustomFood(userId: string, data: CustomFoodData): Promise<FoodItem> {
    try {
      // Validate input data
      const validation = this.validateCustomFoodData(data)
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }

      // Normalize nutrients to per-100g basis
      const normalizedData = {
        ...data,
        nutrients: this.normalizeNutrients(data.nutrients, data.servingSize.amount)
      }

      const foodItem = await this.repository.create(userId, normalizedData)

      // Update cache
      const userCustomFoods = this.cache.get(userId) || []
      userCustomFoods.unshift(foodItem)
      this.cache.set(userId, userCustomFoods)

      // Emit event
      eventBus.emit('food_data_cached', {
        foodId: foodItem.id,
        source: 'custom_food_created',
        cacheSize: userCustomFoods.length
      })

      logger.info('Created custom food', {
        userId,
        foodId: foodItem.id,
        foodName: data.name,
        isPublic: data.isPublic
      })

      return foodItem

    } catch (error) {
      logger.error('Failed to create custom food', { userId, foodName: data.name, error })
      throw error
    }
  }

  async updateCustomFood(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void> {
    try {
      // Validate ownership
      const existingFood = await this.getCustomFood(userId, foodId)
      if (!existingFood || existingFood.createdBy !== userId) {
        throw new Error('Custom food not found or access denied')
      }

      // Validate updates if nutrients are being changed
      if (data.nutrients || data.servingSize) {
        const fullData = {
          ...existingFood,
          ...data,
          nutrients: { ...existingFood.nutrients, ...data.nutrients }
        } as CustomFoodData

        const validation = this.validateCustomFoodData(fullData)
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
        }
      }

      // Normalize nutrients if provided
      const updateData = { ...data }
      if (data.nutrients && data.servingSize) {
        updateData.nutrients = this.normalizeNutrients(data.nutrients, data.servingSize.amount)
      }

      await this.repository.update(userId, foodId, updateData)

      // Clear cache to force reload
      this.cache.delete(userId)

      logger.info('Updated custom food', { userId, foodId, updatedFields: Object.keys(data) })

    } catch (error) {
      logger.error('Failed to update custom food', { userId, foodId, error })
      throw error
    }
  }

  async deleteCustomFood(userId: string, foodId: string): Promise<void> {
    try {
      await this.repository.delete(userId, foodId)

      // Update cache
      const userCustomFoods = this.cache.get(userId) || []
      const updatedFoods = userCustomFoods.filter(food => food.id !== foodId)
      this.cache.set(userId, updatedFoods)

      logger.info('Deleted custom food', { userId, foodId })

    } catch (error) {
      logger.error('Failed to delete custom food', { userId, foodId, error })
      throw error
    }
  }

  async getCustomFoods(userId: string): Promise<FoodItem[]> {
    try {
      let customFoods = this.cache.get(userId)

      if (!customFoods) {
        customFoods = await this.repository.getByUser(userId)
        this.cache.set(userId, customFoods)
      }

      return customFoods

    } catch (error) {
      logger.error('Failed to get custom foods', { userId, error })
      return []
    }
  }

  async getCustomFood(userId: string, foodId: string): Promise<FoodItem | null> {
    try {
      const customFoods = await this.getCustomFoods(userId)
      return customFoods.find(food => food.id === foodId) || null

    } catch (error) {
      logger.error('Failed to get custom food', { userId, foodId, error })
      return null
    }
  }

  validateNutrients(nutrients: Partial<NutrientVector>): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required nutrients
    const requiredNutrients = Object.entries(NUTRIENT_VALIDATION)
      .filter(([_, validation]) => validation.required)
      .map(([nutrient, _]) => nutrient)

    for (const nutrient of requiredNutrients) {
      if (nutrients[nutrient as keyof NutrientVector] === undefined) {
        errors.push(`${nutrient} is required`)
      }
    }

    // Validate ranges
    for (const [nutrient, value] of Object.entries(nutrients)) {
      if (value === undefined || value === null) continue

      const validation = NUTRIENT_VALIDATION[nutrient]
      if (!validation) continue

      if (typeof value !== 'number') {
        errors.push(`${nutrient} must be a number`)
        continue
      }

      if (validation.min !== undefined && value < validation.min) {
        errors.push(`${nutrient} cannot be less than ${validation.min}${validation.unit}`)
      }

      if (validation.max !== undefined && value > validation.max) {
        errors.push(`${nutrient} cannot be more than ${validation.max}${validation.unit}`)
      }
    }

    // Macro consistency checks
    const { calories, protein_g, carbs_g, fat_g } = nutrients
    if (calories && protein_g && carbs_g && fat_g) {
      const calculatedCalories = (protein_g * 4) + (carbs_g * 4) + (fat_g * 9)
      const difference = Math.abs(calories - calculatedCalories)
      const percentDifference = (difference / calories) * 100

      if (percentDifference > 20) {
        warnings.push('Calorie count doesn\'t match macronutrient breakdown')
      }
    }

    // Sugar consistency
    const { totalSugars_g, addedSugars_g } = nutrients
    if (totalSugars_g && addedSugars_g && addedSugars_g > totalSugars_g) {
      errors.push('Added sugars cannot exceed total sugars')
    }

    // Fat breakdown consistency
    const { saturatedFat_g } = nutrients
    if (fat_g && saturatedFat_g && saturatedFat_g > fat_g) {
      errors.push('Saturated fat cannot exceed total fat')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private validateCustomFoodData(data: CustomFoodData): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Name validation
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Food name must be at least 2 characters')
    }
    if (data.name && data.name.length > 100) {
      errors.push('Food name cannot exceed 100 characters')
    }

    // Serving size validation
    if (!data.servingSize.amount || data.servingSize.amount <= 0) {
      errors.push('Serving size amount must be greater than 0')
    }
    if (!data.servingSize.unit || data.servingSize.unit.trim().length === 0) {
      errors.push('Serving size unit is required')
    }

    // Nutrient validation
    const nutrientValidation = this.validateNutrients(data.nutrients)
    errors.push(...nutrientValidation.errors)
    warnings.push(...nutrientValidation.warnings)

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  private normalizeNutrients(nutrients: Partial<NutrientVector>, servingSize: number): NutrientVector {
    const normalized: Partial<NutrientVector> = {}
    const ratio = 100 / servingSize // Convert to per-100g basis

    for (const [key, value] of Object.entries(nutrients)) {
      if (typeof value === 'number') {
        normalized[key as keyof NutrientVector] = Math.round((value * ratio) * 100) / 100
      }
    }

    return normalized as NutrientVector
  }

  // Clear cache for memory management
  clearCache(userId?: string): void {
    if (userId) {
      this.cache.delete(userId)
    } else {
      this.cache.clear()
    }
    logger.debug('Custom foods cache cleared', { userId })
  }

  // Get cache stats for debugging
  getCacheStats(): { userCount: number; totalCustomFoods: number } {
    let totalCustomFoods = 0
    for (const foods of this.cache.values()) {
      totalCustomFoods += foods.length
    }

    return {
      userCount: this.cache.size,
      totalCustomFoods
    }
  }
}

// Singleton instance - will be initialized with repository in app setup
export let customFoodsService: CustomFoodsService

export function initializeCustomFoodsService(repository: CustomFoodsRepository): void {
  customFoodsService = new CustomFoodsServiceImpl(repository)
}
