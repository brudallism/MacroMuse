-- 004_create_nutrient_rollup_tables.sql
-- Nutrient rollup tables for analytics as specified in Foundation document
-- Safe to run multiple times

-- Daily nutrient analytics (more detailed than daily_total)
CREATE TABLE IF NOT EXISTS nutrient_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Complete nutrient analysis
  calories DECIMAL(10,2) DEFAULT 0,
  protein_g DECIMAL(10,3) DEFAULT 0,
  carbs_g DECIMAL(10,3) DEFAULT 0,
  fat_g DECIMAL(10,3) DEFAULT 0,
  fiber_g DECIMAL(10,3) DEFAULT 0,

  -- Sub-macros
  saturated_fat_g DECIMAL(10,3) DEFAULT 0,
  monounsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  polyunsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  trans_fat_g DECIMAL(10,3) DEFAULT 0,
  cholesterol_mg DECIMAL(10,3) DEFAULT 0,
  total_sugars_g DECIMAL(10,3) DEFAULT 0,
  added_sugars_g DECIMAL(10,3) DEFAULT 0,

  -- Minerals
  sodium_mg DECIMAL(10,3) DEFAULT 0,
  potassium_mg DECIMAL(10,3) DEFAULT 0,
  calcium_mg DECIMAL(10,3) DEFAULT 0,
  iron_mg DECIMAL(10,3) DEFAULT 0,
  magnesium_mg DECIMAL(10,3) DEFAULT 0,
  zinc_mg DECIMAL(10,3) DEFAULT 0,
  phosphorus_mg DECIMAL(10,3) DEFAULT 0,
  copper_mg DECIMAL(10,3) DEFAULT 0,
  manganese_mg DECIMAL(10,3) DEFAULT 0,
  selenium_ug DECIMAL(10,3) DEFAULT 0,

  -- Vitamins
  vitamin_a_ug DECIMAL(10,3) DEFAULT 0,
  vitamin_c_mg DECIMAL(10,3) DEFAULT 0,
  vitamin_d_ug DECIMAL(10,3) DEFAULT 0,
  vitamin_e_mg DECIMAL(10,3) DEFAULT 0,
  vitamin_k_ug DECIMAL(10,3) DEFAULT 0,
  thiamin_b1_mg DECIMAL(10,3) DEFAULT 0,
  riboflavin_b2_mg DECIMAL(10,3) DEFAULT 0,
  niacin_b3_mg DECIMAL(10,3) DEFAULT 0,
  vitamin_b6_mg DECIMAL(10,3) DEFAULT 0,
  folate_b9_ug DECIMAL(10,3) DEFAULT 0,
  vitamin_b12_ug DECIMAL(10,3) DEFAULT 0,
  pantothenic_acid_b5_mg DECIMAL(10,3) DEFAULT 0,
  choline_mg DECIMAL(10,3) DEFAULT 0,

  -- Analytics metadata
  entry_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, date)
);

-- Weekly nutrient rollups
CREATE TABLE IF NOT EXISTS nutrient_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Week identification (ISO week)
  year INTEGER NOT NULL CHECK (year > 2020 AND year < 2100),
  week INTEGER NOT NULL CHECK (week >= 1 AND week <= 53),
  week_start_date DATE NOT NULL, -- Monday of the week

  -- Averaged nutrients
  avg_calories DECIMAL(10,2) DEFAULT 0,
  avg_protein_g DECIMAL(10,3) DEFAULT 0,
  avg_carbs_g DECIMAL(10,3) DEFAULT 0,
  avg_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_fiber_g DECIMAL(10,3) DEFAULT 0,

  -- Sub-macros averages
  avg_saturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_monounsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_polyunsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_trans_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_cholesterol_mg DECIMAL(10,3) DEFAULT 0,
  avg_total_sugars_g DECIMAL(10,3) DEFAULT 0,
  avg_added_sugars_g DECIMAL(10,3) DEFAULT 0,

  -- Minerals averages
  avg_sodium_mg DECIMAL(10,3) DEFAULT 0,
  avg_potassium_mg DECIMAL(10,3) DEFAULT 0,
  avg_calcium_mg DECIMAL(10,3) DEFAULT 0,
  avg_iron_mg DECIMAL(10,3) DEFAULT 0,
  avg_magnesium_mg DECIMAL(10,3) DEFAULT 0,
  avg_zinc_mg DECIMAL(10,3) DEFAULT 0,
  avg_phosphorus_mg DECIMAL(10,3) DEFAULT 0,
  avg_copper_mg DECIMAL(10,3) DEFAULT 0,
  avg_manganese_mg DECIMAL(10,3) DEFAULT 0,
  avg_selenium_ug DECIMAL(10,3) DEFAULT 0,

  -- Vitamins averages
  avg_vitamin_a_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_c_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_d_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_e_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_k_ug DECIMAL(10,3) DEFAULT 0,
  avg_thiamin_b1_mg DECIMAL(10,3) DEFAULT 0,
  avg_riboflavin_b2_mg DECIMAL(10,3) DEFAULT 0,
  avg_niacin_b3_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_b6_mg DECIMAL(10,3) DEFAULT 0,
  avg_folate_b9_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_b12_ug DECIMAL(10,3) DEFAULT 0,
  avg_pantothenic_acid_b5_mg DECIMAL(10,3) DEFAULT 0,
  avg_choline_mg DECIMAL(10,3) DEFAULT 0,

  -- Analytics metadata
  days_with_data INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, year, week)
);

-- Monthly nutrient rollups
CREATE TABLE IF NOT EXISTS nutrient_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Month identification
  year INTEGER NOT NULL CHECK (year > 2020 AND year < 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

  -- Averaged nutrients
  avg_calories DECIMAL(10,2) DEFAULT 0,
  avg_protein_g DECIMAL(10,3) DEFAULT 0,
  avg_carbs_g DECIMAL(10,3) DEFAULT 0,
  avg_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_fiber_g DECIMAL(10,3) DEFAULT 0,

  -- Sub-macros averages
  avg_saturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_monounsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_polyunsaturated_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_trans_fat_g DECIMAL(10,3) DEFAULT 0,
  avg_cholesterol_mg DECIMAL(10,3) DEFAULT 0,
  avg_total_sugars_g DECIMAL(10,3) DEFAULT 0,
  avg_added_sugars_g DECIMAL(10,3) DEFAULT 0,

  -- Minerals averages
  avg_sodium_mg DECIMAL(10,3) DEFAULT 0,
  avg_potassium_mg DECIMAL(10,3) DEFAULT 0,
  avg_calcium_mg DECIMAL(10,3) DEFAULT 0,
  avg_iron_mg DECIMAL(10,3) DEFAULT 0,
  avg_magnesium_mg DECIMAL(10,3) DEFAULT 0,
  avg_zinc_mg DECIMAL(10,3) DEFAULT 0,
  avg_phosphorus_mg DECIMAL(10,3) DEFAULT 0,
  avg_copper_mg DECIMAL(10,3) DEFAULT 0,
  avg_manganese_mg DECIMAL(10,3) DEFAULT 0,
  avg_selenium_ug DECIMAL(10,3) DEFAULT 0,

  -- Vitamins averages
  avg_vitamin_a_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_c_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_d_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_e_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_k_ug DECIMAL(10,3) DEFAULT 0,
  avg_thiamin_b1_mg DECIMAL(10,3) DEFAULT 0,
  avg_riboflavin_b2_mg DECIMAL(10,3) DEFAULT 0,
  avg_niacin_b3_mg DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_b6_mg DECIMAL(10,3) DEFAULT 0,
  avg_folate_b9_ug DECIMAL(10,3) DEFAULT 0,
  avg_vitamin_b12_ug DECIMAL(10,3) DEFAULT 0,
  avg_pantothenic_acid_b5_mg DECIMAL(10,3) DEFAULT 0,
  avg_choline_mg DECIMAL(10,3) DEFAULT 0,

  -- Analytics metadata
  days_with_data INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, year, month)
);

-- Enable RLS
ALTER TABLE nutrient_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrient_monthly ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users access own daily nutrients" ON nutrient_daily;
CREATE POLICY "Users access own daily nutrients"
  ON nutrient_daily FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own weekly nutrients" ON nutrient_weekly;
CREATE POLICY "Users access own weekly nutrients"
  ON nutrient_weekly FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users access own monthly nutrients" ON nutrient_monthly;
CREATE POLICY "Users access own monthly nutrients"
  ON nutrient_monthly FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_nutrient_daily_user_date ON nutrient_daily(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_nutrient_daily_computed ON nutrient_daily(computed_at);

CREATE INDEX IF NOT EXISTS idx_nutrient_weekly_user ON nutrient_weekly(user_id, year DESC, week DESC);
CREATE INDEX IF NOT EXISTS idx_nutrient_weekly_computed ON nutrient_weekly(computed_at);

CREATE INDEX IF NOT EXISTS idx_nutrient_monthly_user ON nutrient_monthly(user_id, year DESC, month DESC);
CREATE INDEX IF NOT EXISTS idx_nutrient_monthly_computed ON nutrient_monthly(computed_at);