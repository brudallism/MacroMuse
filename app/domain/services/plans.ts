// domain/services/plans.ts

export interface PlanService {
  createWeek(_startISO: string): Promise<string>
  applyToLedger(_weekId: string): Promise<void>
  shoppingList(_weekId: string): Promise<Array<{ name: string; qty: number; unit: string }>>
}
