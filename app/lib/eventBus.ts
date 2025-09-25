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
} from '@domain/models'

type EventMap = {
  // User & Auth
  user_authenticated: { userId: string; profile: UserProfile }
  profile_updated: { userId: string; changes: Partial<UserProfile> }
  preferences_changed: { userId: string; key: string; value: unknown }

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
  food_data_cached: { foodId: string; source: string; nutrients: NutrientVector }

  // Analytics & Insights
  analytics_rollup_completed: {
    userId: string
    period: 'daily' | 'weekly' | 'monthly'
    date: string
  }
  insights_generated: { userId: string; insights: Insight[] }
  trend_analysis_updated: { userId: string; trends: TrendData }

  // System Events
  performance_budget_exceeded: { operation: string; actualMs: number; budgetMs: number }
  error_boundary_triggered: { error: string; componentStack: string; userId?: string }

  // Legacy events
  goal_updated: { date: string }
  plan_applied: { planId: string }
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
