// LogRepository.ts - Idempotent meal logging with daily totals integration
import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '../../types/database'
import { LogEntry, NutrientVector } from '../../domain/models'
import { eventBus } from '../../lib/eventBus'

export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

export class LogRepository implements BaseRepository<LogEntry> {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<LogEntry | null> {
    const { data, error } = await this.supabase
      .from('intake_log')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Failed to fetch log entry: ${error.message}`)
    }

    return this.mapToLogEntry(data)
  }

  async create(entryData: Partial<LogEntry>): Promise<LogEntry> {
    // Idempotent operation - check if entry with same ID already exists
    if (entryData.id) {
      const existing = await this.findById(entryData.id)
      if (existing) {
        return existing // Already logged, return existing
      }
    }

    const { data, error } = await this.supabase
      .from('intake_log')
      .insert({
        id: entryData.id!,
        user_id: entryData.user_id!,
        date: entryData.date!,
        meal_type: entryData.meal_type!,
        food_id: entryData.food_id!,
        food_name: entryData.food_name!,
        serving_size: entryData.serving_size!,
        serving_unit: entryData.serving_unit!,
        // Map nutrients to database columns
        calories: entryData.nutrients?.calories || 0,
        protein_g: entryData.nutrients?.protein_g || 0,
        carbs_g: entryData.nutrients?.carbs_g || 0,
        fat_g: entryData.nutrients?.fat_g || 0,
        fiber_g: entryData.nutrients?.fiber_g || 0,
        sodium_mg: entryData.nutrients?.sodium_mg || 0,
        vitaminC_mg: entryData.nutrients?.vitaminC_mg || 0,
        calcium_mg: entryData.nutrients?.calcium_mg || 0,
        iron_mg: entryData.nutrients?.iron_mg || 0,
        // Add other mapped nutrients as needed
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create log entry: ${error.message}`)
    }

    const logEntry = this.mapToLogEntry(data)

    // Emit event for meal logging
    eventBus.emit('meal_logged', {
      userId: logEntry.user_id,
      date: logEntry.date,
      entry: logEntry,
      timestamp: new Date().toISOString()
    })

    // Trigger daily totals recalculation
    await this.recalculateDailyTotals(logEntry.user_id, logEntry.date)

    return logEntry
  }

  async update(id: string, changes: Partial<LogEntry>): Promise<LogEntry> {
    const updateData: any = {}

    if (changes.serving_size) updateData.serving_size = changes.serving_size
    if (changes.serving_unit) updateData.serving_unit = changes.serving_unit

    // Update nutrient values if provided
    if (changes.nutrients) {
      updateData.calories = changes.nutrients.calories || 0
      updateData.protein_g = changes.nutrients.protein_g || 0
      updateData.carbs_g = changes.nutrients.carbs_g || 0
      updateData.fat_g = changes.nutrients.fat_g || 0
      updateData.fiber_g = changes.nutrients.fiber_g || 0
    }

    const { data, error } = await this.supabase
      .from('intake_log')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update log entry: ${error.message}`)
    }

    const logEntry = this.mapToLogEntry(data)

    // Emit event and recalculate totals
    eventBus.emit('meal_updated', {
      userId: logEntry.user_id,
      date: logEntry.date,
      changes,
      timestamp: new Date().toISOString()
    })

    await this.recalculateDailyTotals(logEntry.user_id, logEntry.date)

    return logEntry
  }

  async delete(id: string): Promise<void> {
    // Get entry details before deletion for totals recalculation
    const entry = await this.findById(id)
    if (!entry) return // Already deleted

    const { error } = await this.supabase
      .from('intake_log')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete log entry: ${error.message}`)
    }

    eventBus.emit('meal_deleted', {
      userId: entry.user_id,
      date: entry.date,
      entryId: id
    })

    // Recalculate totals after deletion
    await this.recalculateDailyTotals(entry.user_id, entry.date)
  }

  // Get all entries for a specific user and date
  async findByUserAndDate(userId: string, date: string): Promise<LogEntry[]> {
    const { data, error } = await this.supabase
      .from('intake_log')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch entries: ${error.message}`)
    }

    return data.map(row => this.mapToLogEntry(row))
  }

  private async recalculateDailyTotals(userId: string, date: string): Promise<void> {
    // This would trigger the daily_totals table update
    // Could be done via database trigger or explicit calculation here
    const entries = await this.findByUserAndDate(userId, date)

    // Sum all nutrients for the day
    const totals: NutrientVector = entries.reduce((acc, entry) => ({
      calories: (acc.calories || 0) + (entry.nutrients?.calories || 0),
      protein_g: (acc.protein_g || 0) + (entry.nutrients?.protein_g || 0),
      carbs_g: (acc.carbs_g || 0) + (entry.nutrients?.carbs_g || 0),
      fat_g: (acc.fat_g || 0) + (entry.nutrients?.fat_g || 0),
      fiber_g: (acc.fiber_g || 0) + (entry.nutrients?.fiber_g || 0),
      // Add other nutrients...
    }), {})

    // Upsert daily totals
    await this.supabase
      .from('daily_totals')
      .upsert({
        user_id: userId,
        date: date,
        calories: totals.calories || 0,
        protein_g: totals.protein_g || 0,
        carbs_g: totals.carbs_g || 0,
        fat_g: totals.fat_g || 0,
        fiber_g: totals.fiber_g || 0,
        updated_at: new Date().toISOString()
      })

    eventBus.emit('daily_totals_updated', { userId, date, totals })
  }

  private mapToLogEntry(data: any): LogEntry {
    return {
      id: data.id,
      user_id: data.user_id,
      date: data.date,
      meal_type: data.meal_type,
      food_id: data.food_id,
      food_name: data.food_name,
      serving_size: data.serving_size,
      serving_unit: data.serving_unit,
      nutrients: {
        calories: data.calories,
        protein_g: data.protein_g,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        fiber_g: data.fiber_g,
        sodium_mg: data.sodium_mg,
        vitaminC_mg: data.vitaminC_mg,
        calcium_mg: data.calcium_mg,
        iron_mg: data.iron_mg,
      },
      created_at: data.created_at,
    }
  }
}