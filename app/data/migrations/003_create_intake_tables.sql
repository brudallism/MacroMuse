-- 003_create_intake_tables.sql
-- Intake logging and daily rollup tables
-- Safe to run multiple times

-- Intake log (normalized entries) - matches LogEntry from Foundation document
CREATE TABLE IF NOT EXISTS intake_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Logging details
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('usda', 'spoonacular', 'barcode', 'custom')),
  source_id TEXT, -- External ID from food database

  -- Quantity
  qty DECIMAL(10,3) NOT NULL CHECK (qty > 0),
  unit TEXT NOT NULL,

  -- Complete NutrientVector from Foundation document
  -- Core Macros
  calories DECIMAL(8,2) CHECK (calories >= 0),
  protein_g DECIMAL(8,3) CHECK (protein_g >= 0),
  carbs_g DECIMAL(8,3) CHECK (carbs_g >= 0),
  fat_g DECIMAL(8,3) CHECK (fat_g >= 0),
  fiber_g DECIMAL(8,3) CHECK (fiber_g >= 0),

  -- Sub-macros (detail fats + sugars)
  saturated_fat_g DECIMAL(8,3) CHECK (saturated_fat_g >= 0),
  monounsaturated_fat_g DECIMAL(8,3) CHECK (monounsaturated_fat_g >= 0),
  polyunsaturated_fat_g DECIMAL(8,3) CHECK (polyunsaturated_fat_g >= 0),
  trans_fat_g DECIMAL(8,3) CHECK (trans_fat_g >= 0),
  cholesterol_mg DECIMAL(8,3) CHECK (cholesterol_mg >= 0),
  total_sugars_g DECIMAL(8,3) CHECK (total_sugars_g >= 0),
  added_sugars_g DECIMAL(8,3) CHECK (added_sugars_g >= 0),

  -- Minerals
  sodium_mg DECIMAL(8,3) CHECK (sodium_mg >= 0),
  potassium_mg DECIMAL(8,3) CHECK (potassium_mg >= 0),
  calcium_mg DECIMAL(8,3) CHECK (calcium_mg >= 0),
  iron_mg DECIMAL(8,3) CHECK (iron_mg >= 0),
  magnesium_mg DECIMAL(8,3) CHECK (magnesium_mg >= 0),
  zinc_mg DECIMAL(8,3) CHECK (zinc_mg >= 0),
  phosphorus_mg DECIMAL(8,3) CHECK (phosphorus_mg >= 0),
  copper_mg DECIMAL(8,3) CHECK (copper_mg >= 0),
  manganese_mg DECIMAL(8,3) CHECK (manganese_mg >= 0),
  selenium_ug DECIMAL(8,3) CHECK (selenium_ug >= 0), -- µg stored as ug

  -- Vitamins
  vitamin_a_ug DECIMAL(8,3) CHECK (vitamin_a_ug >= 0), -- µg stored as ug
  vitamin_c_mg DECIMAL(8,3) CHECK (vitamin_c_mg >= 0),
  vitamin_d_ug DECIMAL(8,3) CHECK (vitamin_d_ug >= 0), -- µg stored as ug
  vitamin_e_mg DECIMAL(8,3) CHECK (vitamin_e_mg >= 0),
  vitamin_k_ug DECIMAL(8,3) CHECK (vitamin_k_ug >= 0), -- µg stored as ug
  thiamin_b1_mg DECIMAL(8,3) CHECK (thiamin_b1_mg >= 0),
  riboflavin_b2_mg DECIMAL(8,3) CHECK (riboflavin_b2_mg >= 0),
  niacin_b3_mg DECIMAL(8,3) CHECK (niacin_b3_mg >= 0),
  vitamin_b6_mg DECIMAL(8,3) CHECK (vitamin_b6_mg >= 0),
  folate_b9_ug DECIMAL(8,3) CHECK (folate_b9_ug >= 0), -- µg stored as ug
  vitamin_b12_ug DECIMAL(8,3) CHECK (vitamin_b12_ug >= 0), -- µg stored as ug
  pantothenic_acid_b5_mg DECIMAL(8,3) CHECK (pantothenic_acid_b5_mg >= 0),
  choline_mg DECIMAL(8,3) CHECK (choline_mg >= 0),

  -- Optional categorization
  meal_label TEXT CHECK (meal_label IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id UUID, -- FK to recipe table (will be added later)

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily totals rollup table
CREATE TABLE IF NOT EXISTS daily_total (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Aggregated nutrients (same structure as intake_log)
  -- Core Macros
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

  -- Metadata
  entry_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE intake_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_total ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own intake logs" ON intake_log;
CREATE POLICY "Users manage own intake logs"
  ON intake_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own daily totals" ON daily_total;
CREATE POLICY "Users manage own daily totals"
  ON daily_total FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_intake_log_user_id ON intake_log(user_id);
CREATE INDEX IF NOT EXISTS idx_intake_log_user_logged_at ON intake_log(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_log_source ON intake_log(source, source_id);
CREATE INDEX IF NOT EXISTS idx_intake_log_recipe ON intake_log(recipe_id) WHERE recipe_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_total_user_id ON daily_total(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_total_user_date ON daily_total(user_id, date DESC);

-- Updated at trigger for intake_log
DROP TRIGGER IF EXISTS update_intake_log_updated_at ON intake_log;
CREATE TRIGGER update_intake_log_updated_at
  BEFORE UPDATE ON intake_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();