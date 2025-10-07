// initialization.ts - Central initialization for repositories and services
// This file follows the dependency injection pattern to maintain clean architecture

import { initializeFavoritesService } from '@domain/services/favorites'
import { initializeCustomFoodsService } from '@domain/services/customFoods'
import { initializeRecentFoodsService } from '@domain/services/recentFoods'

import { initializeDataStore } from '@state/dataStore'

import { supabase } from './database/supabase'

// Repositories
import { FavoritesRepositoryImpl } from './repositories/FavoritesRepository'
import { CustomFoodsRepositoryImpl } from './repositories/CustomFoodsRepository'
import { RecipeRepositoryImpl } from './repositories/RecipeRepository'

// Services

// State

/**
 * Initialize all repositories and services
 *
 * Call this once during app startup before using any services.
 *
 * Example:
 * ```ts
 * import { initializeApp } from '@infra/initialization'
 *
 * // In your App.tsx or main entry point:
 * useEffect(() => {
 *   initializeApp()
 * }, [])
 * ```
 */
export function initializeApp(): void {
  // Create repository instances
  const favoritesRepository = new FavoritesRepositoryImpl(supabase)
  const customFoodsRepository = new CustomFoodsRepositoryImpl(supabase)
  const recipeRepository = new RecipeRepositoryImpl(supabase)

  // Initialize services with their repositories
  initializeFavoritesService(favoritesRepository)
  initializeCustomFoodsService(customFoodsRepository)
  initializeRecentFoodsService(recipeRepository)

  // Initialize stores
  initializeDataStore({ recipeRepository })

  console.log('[Initialization] App successfully initialized with repositories and services')
}

/**
 * Check if app has been initialized
 * Useful for debugging initialization issues
 */
export function isAppInitialized(): boolean {
  try {
    // Try importing a service to see if it's initialized
    const { favoritesService } = require('@domain/services/favorites')
    return favoritesService !== undefined
  } catch {
    return false
  }
}
