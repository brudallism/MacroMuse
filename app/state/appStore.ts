// state/appStore.ts - auth + profile + preferences (NO cross-store imports)
import { create } from 'zustand'

import { UserProfile } from '@domain/models'

import { eventBus } from '@lib/eventBus'

interface AppState {
  // Auth
  isAuthenticated: boolean
  user: UserProfile | null

  // Profile & Preferences
  profile: UserProfile | null

  // Actions
  setUser: (user: UserProfile | null) => void
  updateProfile: (changes: Partial<UserProfile>) => Promise<void>
  updatePreferences: (key: string, value: unknown) => Promise<void>
  signOut: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // State
  isAuthenticated: false,
  user: null,
  profile: null,

  // Actions
  setUser: (user): void => {
    set({
      user,
      profile: user,
      isAuthenticated: !!user,
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

    // TODO: Persist to repository
    eventBus.emit('profile_updated', { userId: currentProfile.id, changes })
  },

  updatePreferences: async (key, value): Promise<void> => {
    const currentProfile = get().profile
    if (!currentProfile) return

    const updatedPreferences = { ...currentProfile.preferences, [key]: value }
    const updatedProfile = { ...currentProfile, preferences: updatedPreferences }

    set({ profile: updatedProfile, user: updatedProfile })

    // TODO: Persist to repository
    eventBus.emit('preferences_changed', { userId: currentProfile.id, key, value })
  },

  signOut: (): void => {
    set({
      isAuthenticated: false,
      user: null,
      profile: null,
    })
  },
}))
