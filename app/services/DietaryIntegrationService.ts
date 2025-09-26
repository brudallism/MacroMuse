// services/DietaryIntegrationService.ts - Event bus integration for dietary system
// Foundation compliant - pure functions with event-driven architecture

import { eventBus } from '@lib/eventBus'
import { useAppStore } from '@state/appStore'
import { useDataStore } from '@state/dataStore'
import { checkDietaryCompliance, filterFoodsByDiet } from '@domain/services/DietaryFilterService'
import { buildSpoonacularQuery, validateRestrictionsForQuery } from '@infra/adapters/SpoonacularAdapter'
import type { DietaryRestrictions } from '@domain/models/dietary'
import type { FoodSearchResult } from '@domain/models'

/**
 * Service to wire dietary restrictions with existing food search and caching
 * Follows Foundation event-driven architecture
 */
export class DietaryIntegrationService {
  private static instance: DietaryIntegrationService | null = null

  public static getInstance(): DietaryIntegrationService {
    if (!DietaryIntegrationService.instance) {
      DietaryIntegrationService.instance = new DietaryIntegrationService()
    }
    return DietaryIntegrationService.instance
  }

  /**
   * Initialize event listeners for dietary system integration
   * Called once during app startup
   */
  public initialize(): void {
    // React to dietary restrictions changes
    eventBus.on('dietary_restrictions_changed', this.handleDietaryRestrictionsChanged)

    // Filter search results when they come in
    eventBus.on('food_search_completed', this.handleFoodSearchCompleted)

    // Validate foods when cached
    eventBus.on('food_data_cached', this.handleFoodCached)

    // React to meal logging for dietary validation
    eventBus.on('meal_logged', this.handleMealLogged)
  }

  /**
   * Clean up event listeners
   * Called during app cleanup
   */
  public cleanup(): void {
    eventBus.off('dietary_restrictions_changed', this.handleDietaryRestrictionsChanged)
    eventBus.off('food_search_completed', this.handleFoodSearchCompleted)
    eventBus.off('food_data_cached', this.handleFoodCached)
    eventBus.off('meal_logged', this.handleMealLogged)
  }

  /**
   * Handle dietary restrictions changes
   * Update cached Spoonacular queries and validate current data
   */
  private handleDietaryRestrictionsChanged = (data: { userId: string; restrictions: DietaryRestrictions }) => {
    const { userId, restrictions } = data

    // Validate new restrictions
    const validationErrors = validateRestrictionsForQuery(restrictions)

    if (validationErrors.length > 0) {
      eventBus.emit('dietary_validation_failed', {
        userId,
        restrictions,
        errors: validationErrors
      })
      return
    }

    // Clear food search cache since dietary preferences changed
    useDataStore.getState().clearCache()

    // Re-filter existing search results if any
    const { lastSearchResults, lastSearchQuery } = useDataStore.getState()

    if (lastSearchResults.length > 0 && lastSearchQuery) {
      this.applyDietaryFilter(userId, restrictions, lastSearchResults, lastSearchQuery)
    }
  }

  /**
   * Handle new food search results
   * Apply dietary filtering to results
   */
  private handleFoodSearchCompleted = (data: {
    query: string
    results: FoodSearchResult[]
    source: string
  }) => {
    const { query, results } = data
    const appState = useAppStore.getState()

    if (!appState.user || !appState.dietaryRestrictions) {
      return
    }

    this.applyDietaryFilter(
      appState.user.id,
      appState.dietaryRestrictions,
      results,
      query
    )
  }

  /**
   * Handle food caching
   * Validate food against current dietary restrictions
   */
  private handleFoodCached = (data: {
    foodId: string
    source: string
    nutrients: any
  }) => {
    const appState = useAppStore.getState()
    const dataState = useDataStore.getState()

    if (!appState.user || !appState.dietaryRestrictions) {
      return
    }

    const food = dataState.foods.get(data.foodId)
    if (!food) {
      return
    }

    // Check dietary compliance for cached food
    const compliance = checkDietaryCompliance(
      {
        id: food.id,
        name: food.name,
        ingredients: [], // Would need to extract from food object
        nutrients: food.nutrients
      },
      appState.dietaryRestrictions
    )

    // If food violates restrictions, could emit warning
    if (compliance.violatesRestrictions) {
      console.warn(`Cached food "${food.name}" violates dietary restrictions:`, compliance.warnings)
    }
  }

  /**
   * Handle meal logging
   * Validate logged meals against dietary restrictions
   */
  private handleMealLogged = (data: { userId: string; entry: any }) => {
    const appState = useAppStore.getState()
    const dataState = useDataStore.getState()

    if (!appState.dietaryRestrictions || data.userId !== appState.user?.id) {
      return
    }

    // Get food details for the logged entry
    const food = dataState.foods.get(data.entry.foodId)
    if (!food) {
      return
    }

    // Check dietary compliance
    const compliance = checkDietaryCompliance(
      {
        id: food.id,
        name: food.name,
        ingredients: [], // Would need to extract from food object
        nutrients: food.nutrients
      },
      appState.dietaryRestrictions
    )

    // Log warning if meal violates restrictions
    if (compliance.violatesRestrictions) {
      console.warn(`Logged meal "${food.name}" violates dietary restrictions:`, compliance.warnings)
      // Could emit event for UI to show warning
    }
  }

  /**
   * Apply dietary filtering to search results
   * Pure function extracted to service method
   */
  private applyDietaryFilter(
    userId: string,
    restrictions: DietaryRestrictions,
    results: FoodSearchResult[],
    query: string
  ): void {
    const totalCount = results.length

    // Convert search results to format expected by filter
    const foodsToFilter = results.map(result => ({
      id: result.id,
      name: result.name,
      source: result.source as 'usda' | 'spoonacular' | 'barcode' | 'custom',
      ingredients: result.ingredients || [],
      nutrients: result.nutrients
    }))

    // Apply dietary filter
    const filteredFoods = filterFoodsByDiet(foodsToFilter, restrictions)

    const filteredCount = filteredFoods.length

    // Update data store with filtered results
    const filteredResults: FoodSearchResult[] = filteredFoods.map(food => ({
      id: food.id,
      name: food.name,
      source: food.source,
      nutrients: food.nutrients,
      ingredients: [], // Simplified for now
      servingSize: { amount: 100, unit: 'g' } // Default serving size
    }))

    // Update search results in data store
    useDataStore.getState().setSearchResults(query, filteredResults)

    // Emit dietary filter applied event
    eventBus.emit('dietary_filter_applied', {
      userId,
      restrictions,
      filteredCount,
      totalCount
    })
  }

  /**
   * Get current dietary restrictions from app store
   * Helper method for external services
   */
  public getCurrentRestrictions(): DietaryRestrictions | null {
    const appState = useAppStore.getState()
    return appState.dietaryRestrictions || null
  }

  /**
   * Build Spoonacular query from current restrictions
   * Helper method for external API services
   */
  public buildCurrentSpoonacularQuery(options?: any): any {
    const restrictions = this.getCurrentRestrictions()
    if (!restrictions) {
      return null
    }

    return buildSpoonacularQuery(restrictions, options)
  }
}

// Export singleton instance
export const dietaryIntegrationService = DietaryIntegrationService.getInstance()