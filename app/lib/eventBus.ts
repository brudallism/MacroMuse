// lib/eventBus.ts - Complete event schema for cross-store communication
import {
  UserProfile,
  TargetVector,
  LogEntry,
  NutrientVector,
  Insight,
  TrendData,
  MicronutrientRow,
  FoodSearchResult,
  RecognizedFood,
  Goal,
  RecipeData,
  WeeklyMealPlan,
  PlannedMeal,
  ShoppingItem,
} from '@domain/models'
import { DietaryRestrictions } from '@domain/models/dietary'

type EventMap = {
  // User & Auth
  user_authenticated: { userId: string; profile: UserProfile }
  profile_updated: { userId: string; changes: Partial<UserProfile> }
  preferences_changed: { userId: string; key: string; value: unknown }
  dietary_restrictions_changed: { userId: string; restrictions: DietaryRestrictions }

  // Goals & Targets
  macro_targets_calculated: { userId: string; targets: TargetVector; date: string }
  micro_targets_updated: { userId: string; targets: MicronutrientRow[]; date: string }
  goal_type_changed: { userId: string; goalType: Goal; effectiveDate: string }

  // Meal Tracking
  meal_logged: { userId: string; entry: LogEntry }
  meal_updated: { userId: string; entryId: string; changes: Partial<LogEntry> }
  meal_deleted: { userId: string; entryId: string }
  daily_totals_computed: { userId: string; date: string; totals: NutrientVector }

  // Food Search & Recognition
  food_search_completed: { query: string; results: FoodSearchResult[]; source: string }
  food_recognized: { input: string; confidence: number; result: RecognizedFood }
  food_data_cached: { foodId: string; source: string; nutrients?: NutrientVector; cacheSize?: number }

  // Advanced Food Features
  user_activity_tracked: { userId: string; activity: string; metadata: Record<string, unknown> }
  food_logged: { userId: string; foodId: string; foodName: string; mealType: string; calories: number; loggedAt: string }
  user_preferences_updated: { userId: string; type: string; preferences: Record<string, unknown> }
  cache_cleared: { scope: string; userId: string }

  // Dietary Filtering Events
  dietary_filter_applied: {
    userId: string
    restrictions: DietaryRestrictions
    filteredCount: number
    totalCount: number
  }
  dietary_validation_failed: {
    userId: string
    restrictions: DietaryRestrictions
    errors: string[]
  }

  // Analytics & Insights
  analytics_rollup_completed: {
    userId: string
    period: 'daily' | 'weekly' | 'monthly'
    date: string
  }
  insights_generated: { userId: string; insights: Insight[] }
  trend_analysis_updated: { userId: string; trends: TrendData[] }

  // Goal Management & Progress
  goal_adherence_calculated: { userId: string; date: string; adherence: number }
  streak_milestone_reached: { userId: string; nutrient: string; days: number; type: string }
  goal_recommendation_generated: { userId: string; recommendations: Array<{ nutrient: string; type: string; confidence: number }> }
  progress_celebration_triggered: { userId: string; achievement: string; data: Record<string, unknown> }

  // Pattern Detection Events
  eating_pattern_detected: { userId: string; pattern: string; confidence: number; data: Record<string, unknown> }
  nutrient_deficiency_alert: { userId: string; nutrient: string; severity: 'low' | 'medium' | 'high'; streakDays: number }
  macro_imbalance_detected: { userId: string; imbalance: Record<string, number>; recommendations: string[] }

  // Recipe Events
  recipe_created: { userId: string; recipeId: string; name: string }
  recipe_updated: { userId: string; recipeId: string; changes: Partial<RecipeData> }
  recipe_deleted: { userId: string; recipeId: string; name: string }
  recipe_imported: { userId: string; recipeId: string; source: 'spoonacular'; sourceId: string }
  recipe_scaled: { recipeId: string; fromServings: number; toServings: number }
  recipe_nutrition_calculated: { recipeId: string; nutrients: NutrientVector }
  recipe_duplicated: { sourceRecipeId: string; newRecipeId: string; userId: string }

  // Meal Planning Events
  meal_plan_created: { userId: string; planId: string; startDate: string }
  meal_plan_updated: { planId: string; updates: Partial<WeeklyMealPlan> }
  meal_plan_deleted: { planId: string; userId: string }
  meal_plan_duplicated: { sourcePlanId: string; newPlanId: string; userId: string; newStartDate: string }
  meal_added_to_plan: { planId: string; day: number; mealType: string; meal: PlannedMeal }
  meal_removed_from_plan: { planId: string; mealId: string }
  meal_moved_in_plan: { planId: string; mealId: string; targetDay: number; targetMealType: string }
  plan_applied: { planId: string; userId: string; entriesCount: number }
  plan_application_progress: { planId: string; userId: string; appliedCount: number; totalCount: number; progress: number }
  plan_application_failed: { planId: string; userId: string; error: string }
  shopping_list_generated: { planId: string; itemCount: number }

  // System Events
  performance_budget_exceeded: { operation: string; actualMs: number; budgetMs: number }
  error_boundary_triggered: { error: string; componentStack: string; userId?: string }

  // Legacy events
  goal_updated: { date: string }
}

type EventListener<T> = (_data: T) => void | Promise<void>

class TypedEventBus<TEventMap extends Record<string, unknown>> {
  private listeners: Map<keyof TEventMap, EventListener<unknown>[]> = new Map()

  on<K extends keyof TEventMap>(event: K, listener: EventListener<TEventMap[K]>): void {
    const currentListeners = this.listeners.get(event) || []
    this.listeners.set(event, [...currentListeners, listener as EventListener<unknown>])
  }

  off<K extends keyof TEventMap>(event: K, listener: EventListener<TEventMap[K]>): void {
    const currentListeners = this.listeners.get(event) || []
    const filteredListeners = currentListeners.filter(
      (l) => l !== (listener as EventListener<unknown>)
    )
    this.listeners.set(event, filteredListeners)
  }

  emit<K extends keyof TEventMap>(event: K, data: TEventMap[K]): void {
    const listeners = this.listeners.get(event) || []
    listeners.forEach((listener) => {
      try {
        const result = listener(data)
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`Error in event listener for ${String(event)}:`, error)
          })
        }
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error)
      }
    })
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}

export function createTypedEventBus<T extends Record<string, unknown>>(): TypedEventBus<T> {
  return new TypedEventBus<T>()
}

export const eventBus = createTypedEventBus<EventMap>()
