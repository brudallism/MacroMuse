// state/appStore.ts - Everything about WHO the user is (NO cross-store imports)
import { create } from 'zustand'

import { UserProfile } from '@domain/models'
import { DietaryRestrictions } from '@domain/models/dietary'
import { eventBus } from '@lib/eventBus'

interface AppState {
  // Auth & Identity
  isAuthenticated: boolean
  user: UserProfile | null

  // Profile & Preferences
  profile: UserProfile | null
  preferences: {
    units: 'metric' | 'imperial'
    theme: 'light' | 'dark'
  }
  dietaryRestrictions: DietaryRestrictions

  // Actions
  authenticate: (user: UserProfile) => void
  setUser: (user: UserProfile | null) => void
  updateProfile: (changes: Partial<UserProfile>) => Promise<void>
  updatePreferences: (key: string, value: unknown) => Promise<void>
  updateDietaryRestrictions: (restrictions: Partial<DietaryRestrictions>) => Promise<void>
  signOut: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // State
  isAuthenticated: false,
  user: null,
  profile: null,
  preferences: {
    units: 'metric',
    theme: 'light',
  },
  dietaryRestrictions: {
    diets: [],
    allergies: [],
    exclusions: [],
    preferences: [],
    strictFodmap: false,
  },

  // Actions
  authenticate: (user): void => {
    set({
      user,
      profile: user,
      isAuthenticated: true,
      preferences: {
        units: user.preferences?.units || 'metric',
        theme: 'light',
      },
      dietaryRestrictions: user.dietaryRestrictions || {
        diets: [],
        allergies: user.preferences?.allergies || [],
        exclusions: [],
        preferences: [],
        strictFodmap: false,
      },
    })

    eventBus.emit('user_authenticated', { userId: user.id, profile: user })
  },

  setUser: (user): void => {
    set({
      user,
      profile: user,
      isAuthenticated: !!user,
      preferences: user ? {
        units: user.preferences?.units || 'metric',
        theme: 'light',
      } : {
        units: 'metric',
        theme: 'light',
      },
      dietaryRestrictions: user ? (user.dietaryRestrictions || {
        diets: [],
        allergies: user.preferences?.allergies || [],
        exclusions: [],
        preferences: [],
        strictFodmap: false,
      }) : {
        diets: [],
        allergies: [],
        exclusions: [],
        preferences: [],
        strictFodmap: false,
      },
    })

    if (user) {
      eventBus.emit('user_authenticated', { userId: user.id, profile: user })
    }
  },

  updateProfile: async (changes): Promise<void> => {
    const currentProfile = get().profile
    if (!currentProfile) return

    const updatedProfile = { ...currentProfile, ...changes }
    set({ profile: updatedProfile, user: updatedProfile })

    eventBus.emit('profile_updated', { userId: currentProfile.id, changes })
  },

  updatePreferences: async (key, value): Promise<void> => {
    const currentState = get()
    if (!currentState.profile) return

    const updatedPreferences = { ...currentState.preferences, [key]: value }
    set({ preferences: updatedPreferences })

    eventBus.emit('preferences_changed', {
      userId: currentState.profile.id,
      key,
      value
    })
  },

  updateDietaryRestrictions: async (restrictions): Promise<void> => {
    const currentState = get()
    if (!currentState.profile) return

    const updatedRestrictions = { ...currentState.dietaryRestrictions, ...restrictions }
    set({ dietaryRestrictions: updatedRestrictions })

    eventBus.emit('dietary_restrictions_changed', {
      userId: currentState.profile.id,
      restrictions: updatedRestrictions
    })
  },

  signOut: (): void => {
    set({
      isAuthenticated: false,
      user: null,
      profile: null,
      preferences: {
        units: 'metric',
        theme: 'light',
      },
      dietaryRestrictions: {
        diets: [],
        allergies: [],
        exclusions: [],
        preferences: [],
        strictFodmap: false,
      },
    })
  },
}))
