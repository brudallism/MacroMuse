// Database types generated from Supabase schema
// This provides full type safety for all database operations

export interface Database {
  public: {
    Tables: {
      profile: {
        Row: ProfileRow
        Insert: ProfileInsert
        Update: ProfileUpdate
      }
      goal_base: {
        Row: GoalBaseRow
        Insert: GoalBaseInsert
        Update: GoalBaseUpdate
      }
      goal_weekly_cycle: {
        Row: GoalWeeklyCycleRow
        Insert: GoalWeeklyCycleInsert
        Update: GoalWeeklyCycleUpdate
      }
      goal_menstrual: {
        Row: GoalMenstrualRow
        Insert: GoalMenstrualInsert
        Update: GoalMenstrualUpdate
      }
      intake_log: {
        Row: IntakeLogRow
        Insert: IntakeLogInsert
        Update: IntakeLogUpdate
      }
      daily_total: {
        Row: DailyTotalRow
        Insert: DailyTotalInsert
        Update: DailyTotalUpdate
      }
      recipe: {
        Row: RecipeRow
        Insert: RecipeInsert
        Update: RecipeUpdate
      }
      recipe_ingredient: {
        Row: RecipeIngredientRow
        Insert: RecipeIngredientInsert
        Update: RecipeIngredientUpdate
      }
      recipe_nutrient: {
        Row: RecipeNutrientRow
        Insert: RecipeNutrientInsert
        Update: RecipeNutrientUpdate
      }
      meal_plan: {
        Row: MealPlanRow
        Insert: MealPlanInsert
        Update: MealPlanUpdate
      }
      meal_plan_item: {
        Row: MealPlanItemRow
        Insert: MealPlanItemInsert
        Update: MealPlanItemUpdate
      }
      nutrient_daily: {
        Row: NutrientDailyRow
        Insert: NutrientDailyInsert
        Update: NutrientDailyUpdate
      }
      nutrient_weekly: {
        Row: NutrientWeeklyRow
        Insert: NutrientWeeklyInsert
        Update: NutrientWeeklyUpdate
      }
      nutrient_monthly: {
        Row: NutrientMonthlyRow
        Insert: NutrientMonthlyInsert
        Update: NutrientMonthlyUpdate
      }
      migration_history: {
        Row: MigrationHistoryRow
        Insert: MigrationHistoryInsert
        Update: MigrationHistoryUpdate
      }
    }
    Views: {
      user_daily_summary: {
        Row: UserDailySummaryRow
      }
    }
    Functions: {
      update_daily_totals: {
        Args: { target_user_id: string; target_date: string }
        Returns: void
      }
      update_weekly_rollups: {
        Args: { target_user_id: string; target_year: number; target_week: number }
        Returns: void
      }
      after_write_rollup: {
        Args: { log_date: string }
        Returns: void
      }
      compute_recipe_nutrients: {
        Args: { target_recipe_id: string }
        Returns: void
      }
    }
  }
}

// Profile table types
export interface ProfileRow {
  id: string
  user_id: string
  email: string
  name: string | null
  units: 'metric' | 'imperial'
  diet: 'standard' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | null
  allergies: string[]
  created_at: string
  updated_at: string
}

export type ProfileInsert = Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>
export type ProfileUpdate = Partial<ProfileInsert>

// Goal base table types
export interface GoalBaseRow {
  id: string
  user_id: string
  goal_type: 'weight_loss' | 'weight_gain' | 'maintain' | 'muscle_gain'
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  effective_date: string
  end_date: string | null
  created_at: string
  updated_at: string
}

export type GoalBaseInsert = Omit<GoalBaseRow, 'id' | 'created_at' | 'updated_at'>
export type GoalBaseUpdate = Partial<GoalBaseInsert>

// Goal weekly cycle table types
export interface GoalWeeklyCycleRow {
  id: string
  user_id: string
  day_of_week: number // 0=Sunday, 6=Saturday
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  effective_date: string
  end_date: string | null
  created_at: string
  updated_at: string
}

export type GoalWeeklyCycleInsert = Omit<GoalWeeklyCycleRow, 'id' | 'created_at' | 'updated_at'>
export type GoalWeeklyCycleUpdate = Partial<GoalWeeklyCycleInsert>

// Goal menstrual table types
export interface GoalMenstrualRow {
  id: string
  user_id: string
  phase: 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number | null
  cycle_start_date: string
  phase_start_day: number
  phase_end_day: number
  created_at: string
  updated_at: string
}

export type GoalMenstrualInsert = Omit<GoalMenstrualRow, 'id' | 'created_at' | 'updated_at'>
export type GoalMenstrualUpdate = Partial<GoalMenstrualInsert>

// Intake log table types (complete NutrientVector)
export interface IntakeLogRow {
  id: string
  user_id: string
  logged_at: string
  source: 'usda' | 'spoonacular' | 'barcode' | 'custom'
  source_id: string | null
  qty: number
  unit: string
  // Complete NutrientVector
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  saturated_fat_g: number | null
  monounsaturated_fat_g: number | null
  polyunsaturated_fat_g: number | null
  trans_fat_g: number | null
  cholesterol_mg: number | null
  total_sugars_g: number | null
  added_sugars_g: number | null
  sodium_mg: number | null
  potassium_mg: number | null
  calcium_mg: number | null
  iron_mg: number | null
  magnesium_mg: number | null
  zinc_mg: number | null
  phosphorus_mg: number | null
  copper_mg: number | null
  manganese_mg: number | null
  selenium_ug: number | null
  vitamin_a_ug: number | null
  vitamin_c_mg: number | null
  vitamin_d_ug: number | null
  vitamin_e_mg: number | null
  vitamin_k_ug: number | null
  thiamin_b1_mg: number | null
  riboflavin_b2_mg: number | null
  niacin_b3_mg: number | null
  vitamin_b6_mg: number | null
  folate_b9_ug: number | null
  vitamin_b12_ug: number | null
  pantothenic_acid_b5_mg: number | null
  choline_mg: number | null
  meal_label: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
  recipe_id: string | null
  created_at: string
  updated_at: string
}

export type IntakeLogInsert = Omit<IntakeLogRow, 'id' | 'created_at' | 'updated_at'>
export type IntakeLogUpdate = Partial<IntakeLogInsert>

// Daily total table types
export interface DailyTotalRow
  extends Omit<
    IntakeLogRow,
    | 'id'
    | 'logged_at'
    | 'source'
    | 'source_id'
    | 'qty'
    | 'unit'
    | 'meal_label'
    | 'recipe_id'
    | 'updated_at'
  > {
  id: string
  date: string
  entry_count: number
  last_updated: string
}

export type DailyTotalInsert = Omit<DailyTotalRow, 'id' | 'created_at' | 'last_updated'>
export type DailyTotalUpdate = Partial<DailyTotalInsert>

// Recipe table types
export interface RecipeRow {
  id: string
  user_id: string
  name: string
  description: string | null
  servings: number
  instructions: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  source: 'custom' | 'spoonacular' | 'import'
  source_id: string | null
  source_url: string | null
  cuisine: string | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  tags: string[]
  calories_per_serving: number | null
  protein_per_serving: number | null
  carbs_per_serving: number | null
  fat_per_serving: number | null
  nutrition_computed: boolean
  nutrition_computed_at: string | null
  created_at: string
  updated_at: string
}

export type RecipeInsert = Omit<RecipeRow, 'id' | 'created_at' | 'updated_at'>
export type RecipeUpdate = Partial<RecipeInsert>

// Recipe ingredient table types
export interface RecipeIngredientRow {
  id: string
  recipe_id: string
  ingredient_name: string
  quantity: number
  unit: string
  food_source: 'usda' | 'spoonacular' | 'custom' | null
  food_source_id: string | null
  sort_order: number
  created_at: string
}

export type RecipeIngredientInsert = Omit<RecipeIngredientRow, 'id' | 'created_at'>
export type RecipeIngredientUpdate = Partial<RecipeIngredientInsert>

// Recipe nutrient table types (complete NutrientVector per serving)
export interface RecipeNutrientRow
  extends Omit<
    IntakeLogRow,
    | 'id'
    | 'user_id'
    | 'logged_at'
    | 'source'
    | 'source_id'
    | 'qty'
    | 'unit'
    | 'meal_label'
    | 'recipe_id'
    | 'updated_at'
  > {
  id: string
  recipe_id: string
  computed_at: string
}

export type RecipeNutrientInsert = Omit<RecipeNutrientRow, 'id' | 'created_at' | 'computed_at'>
export type RecipeNutrientUpdate = Partial<RecipeNutrientInsert>

// Meal plan table types
export interface MealPlanRow {
  id: string
  user_id: string
  name: string
  description: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MealPlanInsert = Omit<MealPlanRow, 'id' | 'created_at' | 'updated_at'>
export type MealPlanUpdate = Partial<MealPlanInsert>

// Meal plan item table types
export interface MealPlanItemRow {
  id: string
  meal_plan_id: string
  recipe_id: string
  scheduled_date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servings: number
  notes: string | null
  is_completed: boolean
  completed_at: string | null
  created_at: string
}

export type MealPlanItemInsert = Omit<MealPlanItemRow, 'id' | 'created_at'>
export type MealPlanItemUpdate = Partial<MealPlanItemInsert>

// Nutrient daily table types
export interface NutrientDailyRow extends Omit<DailyTotalRow, 'id' | 'user_id' | 'last_updated'> {
  id: string
  user_id: string
  computed_at: string
}

export type NutrientDailyInsert = Omit<NutrientDailyRow, 'id' | 'created_at' | 'computed_at'>
export type NutrientDailyUpdate = Partial<NutrientDailyInsert>

// Nutrient weekly table types
export interface NutrientWeeklyRow {
  id: string
  user_id: string
  year: number
  week: number
  week_start_date: string
  // All nutrients as averages
  avg_calories: number
  avg_protein_g: number
  avg_carbs_g: number
  avg_fat_g: number
  avg_fiber_g: number
  avg_saturated_fat_g: number
  avg_monounsaturated_fat_g: number
  avg_polyunsaturated_fat_g: number
  avg_trans_fat_g: number
  avg_cholesterol_mg: number
  avg_total_sugars_g: number
  avg_added_sugars_g: number
  avg_sodium_mg: number
  avg_potassium_mg: number
  avg_calcium_mg: number
  avg_iron_mg: number
  avg_magnesium_mg: number
  avg_zinc_mg: number
  avg_phosphorus_mg: number
  avg_copper_mg: number
  avg_manganese_mg: number
  avg_selenium_ug: number
  avg_vitamin_a_ug: number
  avg_vitamin_c_mg: number
  avg_vitamin_d_ug: number
  avg_vitamin_e_mg: number
  avg_vitamin_k_ug: number
  avg_thiamin_b1_mg: number
  avg_riboflavin_b2_mg: number
  avg_niacin_b3_mg: number
  avg_vitamin_b6_mg: number
  avg_folate_b9_ug: number
  avg_vitamin_b12_ug: number
  avg_pantothenic_acid_b5_mg: number
  avg_choline_mg: number
  days_with_data: number
  total_entries: number
  computed_at: string
  created_at: string
}

export type NutrientWeeklyInsert = Omit<NutrientWeeklyRow, 'id' | 'created_at' | 'computed_at'>
export type NutrientWeeklyUpdate = Partial<NutrientWeeklyInsert>

// Nutrient monthly table types
export interface NutrientMonthlyRow extends Omit<NutrientWeeklyRow, 'week' | 'week_start_date'> {
  month: number
}

export type NutrientMonthlyInsert = Omit<NutrientMonthlyRow, 'id' | 'created_at' | 'computed_at'>
export type NutrientMonthlyUpdate = Partial<NutrientMonthlyInsert>

// Migration history table types
export interface MigrationHistoryRow {
  id: string
  migration_name: string
  executed_at: string
  checksum: string | null
}

export type MigrationHistoryInsert = Omit<MigrationHistoryRow, 'id' | 'executed_at'>
export type MigrationHistoryUpdate = Partial<MigrationHistoryInsert>

// User daily summary view types
export interface UserDailySummaryRow {
  user_id: string
  date: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  entry_count: number
  goal_calories: number | null
  goal_protein_g: number | null
  goal_carbs_g: number | null
  goal_fat_g: number | null
  calories_progress_pct: number | null
  protein_progress_pct: number | null
}
