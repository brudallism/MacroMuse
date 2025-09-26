// ProfileRepository.ts - Complete Supabase implementation for user profiles
import { SupabaseClient } from '@supabase/supabase-js'

import { Database } from '../../types/database'
import { eventBus } from '../../lib/eventBus'

export interface UserProfile {
  id: string
  email: string
  sex: 'male' | 'female'
  age_years: number
  height_cm: number
  weight_kg: number
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
  current_goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
  created_at: string
  updated_at: string
}

export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>
  create(data: Partial<T>): Promise<T>
  update(id: string, data: Partial<T>): Promise<T>
  delete(id: string): Promise<void>
}

export class ProfileRepository implements BaseRepository<UserProfile> {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to fetch profile: ${error.message}`)
    }

    return this.mapToProfile(data)
  }

  async create(profileData: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .insert({
        id: profileData.id!,
        email: profileData.email!,
        sex: profileData.sex!,
        age_years: profileData.age_years!,
        height_cm: profileData.height_cm!,
        weight_kg: profileData.weight_kg!,
        activity_level: profileData.activity_level!,
        current_goal: profileData.current_goal!,
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`)
    }

    const profile = this.mapToProfile(data)

    // Emit event for profile creation
    eventBus.emit('profile_updated', {
      userId: profile.id,
      changes: profile,
      timestamp: new Date().toISOString()
    })

    return profile
  }

  async update(id: string, changes: Partial<UserProfile>): Promise<UserProfile> {
    const updateData: any = {}

    // Only update changed fields
    if (changes.sex) updateData.sex = changes.sex
    if (changes.age_years) updateData.age_years = changes.age_years
    if (changes.height_cm) updateData.height_cm = changes.height_cm
    if (changes.weight_kg) updateData.weight_kg = changes.weight_kg
    if (changes.activity_level) updateData.activity_level = changes.activity_level
    if (changes.current_goal) updateData.current_goal = changes.current_goal

    updateData.updated_at = new Date().toISOString()

    const { data, error } = await this.supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`)
    }

    const profile = this.mapToProfile(data)

    // Emit event for cross-store updates
    eventBus.emit('profile_updated', {
      userId: id,
      changes,
      timestamp: new Date().toISOString()
    })

    return profile
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete profile: ${error.message}`)
    }

    eventBus.emit('profile_deleted', { userId: id })
  }

  private mapToProfile(data: any): UserProfile {
    return {
      id: data.id,
      email: data.email,
      sex: data.sex,
      age_years: data.age_years,
      height_cm: data.height_cm,
      weight_kg: data.weight_kg,
      activity_level: data.activity_level,
      current_goal: data.current_goal,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  }
}