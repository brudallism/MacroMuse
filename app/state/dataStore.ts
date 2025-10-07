// state/dataStore.ts - entities & caches (NO cross-store imports)
import { create } from 'zustand'

import { LogEntry, NutrientVector, Insight, FoodSearchResult, RecentFoodEntry, RecentRecipeEntry } from '@domain/models'

import { RecipeRepository } from '@infra/repositories/RecipeRepository'

import { eventBus } from '@lib/eventBus'

// Repository instance will be injected during app initialization
let recipeRepository: RecipeRepository | null = null

export function initializeDataStore(deps: { recipeRepository: RecipeRepository }): void {
  recipeRepository = deps.recipeRepository
}

interface DataState {
  // Entities
  logEntries: LogEntry[]
  dailyTotals: Record<string, NutrientVector> // date -> totals
  foodSearchResults: FoodSearchResult[]
  insights: Insight[]
  recentFoods: Record<string, RecentFoodEntry[]> // userId -> recent foods
  recentRecipes: Record<string, RecentRecipeEntry[]> // userId -> recent recipes

  // Cache state
  lastSearchQuery: string | null
  lastSearchTimestamp: number | null

  // Actions
  addLogEntry: (entry: LogEntry) => Promise<void>
  updateLogEntry: (id: string, changes: Partial<LogEntry>) => Promise<void>
  removeLogEntry: (id: string) => Promise<void>
  setDailyTotals: (date: string, totals: NutrientVector) => void
  setSearchResults: (query: string, results: FoodSearchResult[]) => void
  setInsights: (insights: Insight[]) => void
  optimisticallyAddEntry: (entry: LogEntry) => void
  clearCache: () => void

  // Recent Foods Actions
  getRecentFoods: (userId: string) => Promise<RecentFoodEntry[]>
  saveRecentFoods: (userId: string, entries: RecentFoodEntry[]) => Promise<void>
  clearRecentFoods: (userId: string) => Promise<void>

  // Recent Recipes Actions
  getRecentRecipes: (userId: string) => Promise<RecentRecipeEntry[]>
  saveRecentRecipes: (userId: string, entries: RecentRecipeEntry[]) => Promise<void>
  clearRecentRecipes: (userId: string) => Promise<void>
}

export const useDataStore = create<DataState>((set, get) => ({
  // State
  logEntries: [],
  dailyTotals: {},
  foodSearchResults: [],
  insights: [],
  recentFoods: {},
  recentRecipes: {},
  lastSearchQuery: null,
  lastSearchTimestamp: null,

  // Actions
  addLogEntry: async (entry): Promise<void> => {
    const currentEntries = get().logEntries
    set({ logEntries: [...currentEntries, entry] })

    // TODO: Persist to repository
    eventBus.emit('meal_logged', { userId: entry.userId, entry })
  },

  updateLogEntry: async (id, changes): Promise<void> => {
    const currentEntries = get().logEntries
    const updatedEntries = currentEntries.map((entry) =>
      entry.id === id ? { ...entry, ...changes } : entry
    )
    set({ logEntries: updatedEntries })

    // TODO: Persist to repository
    const entry = updatedEntries.find((e) => e.id === id)
    if (entry) {
      eventBus.emit('meal_updated', { userId: entry.userId, entryId: id, changes })
    }
  },

  removeLogEntry: async (id): Promise<void> => {
    const currentEntries = get().logEntries
    const entry = currentEntries.find((e) => e.id === id)
    const filteredEntries = currentEntries.filter((entry) => entry.id !== id)
    set({ logEntries: filteredEntries })

    // TODO: Persist to repository
    if (entry) {
      eventBus.emit('meal_deleted', { userId: entry.userId, entryId: id })
    }
  },

  setDailyTotals: (date, totals): void => {
    const currentTotals = get().dailyTotals
    set({ dailyTotals: { ...currentTotals, [date]: totals } })

    // Emit event with userId from first log entry of the day
    const userId = get().logEntries.find((entry) => entry.loggedAt.startsWith(date))?.userId
    if (userId) {
      eventBus.emit('daily_totals_computed', { userId, date, totals })
    }
  },

  setSearchResults: (query, results): void => {
    set({
      foodSearchResults: results,
      lastSearchQuery: query,
      lastSearchTimestamp: Date.now(),
    })

    eventBus.emit('food_search_completed', { query, results, source: 'app' })
  },

  setInsights: (insights): void => {
    set({ insights })

    // Emit event with userId from first insight
    const userId = insights[0]?.id // TODO: Get userId from context
    if (userId && insights.length > 0) {
      // eventBus.emit('insights_generated', { userId, insights })
    }
  },

  optimisticallyAddEntry: (entry): void => {
    const currentEntries = get().logEntries
    set({ logEntries: [...currentEntries, entry] })
  },

  clearCache: (): void => {
    set({
      foodSearchResults: [],
      lastSearchQuery: null,
      lastSearchTimestamp: null,
    })
  },

  // Recent Foods Methods
  getRecentFoods: async (userId): Promise<RecentFoodEntry[]> => {
    const currentRecentFoods = get().recentFoods
    return currentRecentFoods[userId] || []
  },

  saveRecentFoods: async (userId, entries): Promise<void> => {
    const currentRecentFoods = get().recentFoods
    set({
      recentFoods: {
        ...currentRecentFoods,
        [userId]: entries
      }
    })

    eventBus.emit('user_activity_tracked', {
      userId,
      activity: 'recent_foods_updated',
      metadata: { entryCount: entries.length }
    })
  },

  clearRecentFoods: async (userId): Promise<void> => {
    const currentRecentFoods = get().recentFoods
    const { [userId]: removed, ...remaining } = currentRecentFoods
    set({ recentFoods: remaining })

    eventBus.emit('user_activity_tracked', {
      userId,
      activity: 'recent_foods_cleared',
      metadata: {}
    })
  },

  // Recent Recipes Methods
  getRecentRecipes: async (userId): Promise<RecentRecipeEntry[]> => {
    if (!recipeRepository) {
      throw new Error('RecipeRepository not initialized. Call initializeDataStore first.')
    }

    try {
      // Check cache first
      const cached = get().recentRecipes[userId]
      if (cached && cached.length > 0) {
        return cached
      }

      // Fetch from repository
      const entries = await recipeRepository.getRecentRecipes(userId)

      // Update cache
      const currentRecentRecipes = get().recentRecipes
      set({
        recentRecipes: {
          ...currentRecentRecipes,
          [userId]: entries
        }
      })

      return entries
    } catch (error) {
      console.error('Failed to get recent recipes:', error)
      return []
    }
  },

  saveRecentRecipes: async (userId, entries): Promise<void> => {
    if (!recipeRepository) {
      throw new Error('RecipeRepository not initialized. Call initializeDataStore first.')
    }

    // Update local cache
    const currentRecentRecipes = get().recentRecipes
    set({
      recentRecipes: {
        ...currentRecentRecipes,
        [userId]: entries
      }
    })

    // Note: Individual recipe tracking is handled by recentFoodsService.addRecipeToRecent
    // which calls recipeRepository.addRecentRecipe directly

    eventBus.emit('user_activity_tracked', {
      userId,
      activity: 'recent_recipes_updated',
      metadata: { entryCount: entries.length }
    })
  },

  clearRecentRecipes: async (userId): Promise<void> => {
    if (!recipeRepository) {
      throw new Error('RecipeRepository not initialized. Call initializeDataStore first.')
    }

    try {
      // Clear from database
      await recipeRepository.clearRecentRecipes(userId)

      // Clear from cache
      const currentRecentRecipes = get().recentRecipes
      const { [userId]: removed, ...remaining } = currentRecentRecipes
      set({ recentRecipes: remaining })

      eventBus.emit('user_activity_tracked', {
        userId,
        activity: 'recent_recipes_cleared',
        metadata: {}
      })
    } catch (error) {
      console.error('Failed to clear recent recipes:', error)
      throw error
    }
  },
}))
