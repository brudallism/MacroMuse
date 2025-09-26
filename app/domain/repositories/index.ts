// Repository interfaces for clean architecture
// Pure TypeScript interfaces - no external dependencies

import { NutrientVector, LogEntry } from '../models'

export interface TargetVector {
  kcal_target: number
  protein_g: number
  fat_g: number
  carb_g: number
  fiber_g?: number
}

// Repository interfaces
export interface LedgerRepository {
  add(entry: LogEntry): Promise<void>
  remove(id: string): Promise<void>
  findByUserAndDate(userId: string, dateISO: string): Promise<LogEntry[]>
}

export interface TargetsRepository {
  get(userId: string, dateISO: string): Promise<TargetVector>
  set(userId: string, dateISO: string, targets: TargetVector): Promise<void>
}

export interface TotalsRepository {
  getDaily(userId: string, dateISO: string): Promise<NutrientVector & { pctOfTarget: Record<string, number> }>
  invalidateCache(userId: string, dateISO: string): Promise<void>
}

export interface FoodSearchResult {
  id: string
  name: string
  brand?: string
  nutrients: NutrientVector
  serving_size: number
  serving_unit: string
  source: 'usda' | 'spoonacular' | 'barcode'
}

export interface FoodRepository {
  search(query: string, limit?: number): Promise<FoodSearchResult[]>
  getById(id: string): Promise<FoodSearchResult | null>
  cache(food: FoodSearchResult): Promise<void>
}

export interface CacheRepository<T> {
  get(key: string): Promise<T | undefined>
  set(key: string, value: T, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
}