// CustomFoodsRepository.ts - Handles persistence for user custom foods
import { SupabaseClient } from '@supabase/supabase-js'

import { FoodItem, NutrientVector } from '@domain/models'

const CUSTOM_FOODS_TABLE = 'custom_foods'

export interface CustomFoodData {
  name: string
  brand?: string
  nutrients: Partial<NutrientVector>
  servingSize: {
    amount: number
    unit: string
  }
  description?: string
  ingredients?: string
  allergens?: string
  isPublic?: boolean
}

export interface CustomFoodsRepository {
  create(userId: string, data: CustomFoodData): Promise<FoodItem>
  update(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void>
  delete(userId: string, foodId: string): Promise<void>
  getById(userId: string, foodId: string): Promise<FoodItem | null>
  getByUser(userId: string): Promise<FoodItem[]>
  getPublicFoods(limit?: number): Promise<FoodItem[]>
}

export class CustomFoodsRepositoryImpl implements CustomFoodsRepository {
  constructor(private supabase: SupabaseClient) {}

  async create(userId: string, data: CustomFoodData): Promise<FoodItem> {
    const foodId = `custom_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const now = new Date().toISOString()

    const customFoodRecord = {
      id: foodId,
      user_id: userId,
      name: data.name.trim(),
      brand: data.brand?.trim(),
      nutrients: data.nutrients,
      serving_size: data.servingSize,
      description: data.description?.trim(),
      ingredients: data.ingredients?.trim(),
      allergens: data.allergens?.trim(),
      is_public: data.isPublic || false,
      created_at: now,
      updated_at: now
    }

    const { error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .insert([customFoodRecord])

    if (error) {
      throw new Error(`Failed to create custom food: ${error.message}`)
    }

    // Return as FoodItem
    return this.mapToFoodItem(customFoodRecord, userId)
  }

  async update(userId: string, foodId: string, data: Partial<CustomFoodData>): Promise<void> {
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    }

    if (data.name) updateData.name = data.name.trim()
    if (data.brand !== undefined) updateData.brand = data.brand?.trim()
    if (data.description !== undefined) updateData.description = data.description?.trim()
    if (data.ingredients !== undefined) updateData.ingredients = data.ingredients?.trim()
    if (data.allergens !== undefined) updateData.allergens = data.allergens?.trim()
    if (data.isPublic !== undefined) updateData.is_public = data.isPublic
    if (data.nutrients) updateData.nutrients = data.nutrients
    if (data.servingSize) updateData.serving_size = data.servingSize

    const { error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .update(updateData)
      .eq('id', foodId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to update custom food: ${error.message}`)
    }
  }

  async delete(userId: string, foodId: string): Promise<void> {
    const { error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .delete()
      .eq('id', foodId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete custom food: ${error.message}`)
    }
  }

  async getById(userId: string, foodId: string): Promise<FoodItem | null> {
    const { data, error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .select('*')
      .eq('id', foodId)
      .or(`user_id.eq.${userId},is_public.eq.true`)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to fetch custom food: ${error.message}`)
    }

    if (!data) return null

    return this.mapToFoodItem(data, userId)
  }

  async getByUser(userId: string): Promise<FoodItem[]> {
    const { data, error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch custom foods: ${error.message}`)
    }

    return (data || []).map(row => this.mapToFoodItem(row, userId))
  }

  async getPublicFoods(limit: number = 100): Promise<FoodItem[]> {
    const { data, error } = await this.supabase
      .from(CUSTOM_FOODS_TABLE)
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to fetch public custom foods: ${error.message}`)
    }

    return (data || []).map(row => this.mapToFoodItem(row, row.user_id))
  }

  private mapToFoodItem(row: any, userId: string): FoodItem {
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      source: 'custom',
      nutrients: row.nutrients,
      servingSize: row.serving_size,
      isCustom: true,
      createdBy: row.user_id,
      ingredients: row.ingredients,
      allergens: row.allergens
    }
  }
}
