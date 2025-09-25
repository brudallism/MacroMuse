-- 005_create_recipe_tables.sql
-- Recipe system as specified in Foundation document
-- Safe to run multiple times

-- Main recipe table
CREATE TABLE IF NOT EXISTS recipe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recipe details
  name TEXT NOT NULL,
  description TEXT,
  servings DECIMAL(6,2) NOT NULL CHECK (servings > 0),

  -- Instructions
  instructions TEXT,
  prep_time_minutes INTEGER CHECK (prep_time_minutes >= 0),
  cook_time_minutes INTEGER CHECK (cook_time_minutes >= 0),

  -- Source tracking
  source TEXT DEFAULT 'custom' CHECK (source IN ('custom', 'spoonacular', 'import')),
  source_id TEXT, -- External recipe ID
  source_url TEXT,

  -- Recipe metadata
  cuisine TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  tags JSONB DEFAULT '[]'::jsonb,

  -- Nutritional info per serving (computed)
  calories_per_serving DECIMAL(8,2) CHECK (calories_per_serving >= 0),
  protein_per_serving DECIMAL(8,3) CHECK (protein_per_serving >= 0),
  carbs_per_serving DECIMAL(8,3) CHECK (carbs_per_serving >= 0),
  fat_per_serving DECIMAL(8,3) CHECK (fat_per_serving >= 0),

  -- Complete nutrition computed flag
  nutrition_computed BOOLEAN DEFAULT FALSE,
  nutrition_computed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipe ingredients junction table
CREATE TABLE IF NOT EXISTS recipe_ingredient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,

  -- Ingredient details
  ingredient_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,

  -- Optional food database linkage
  food_source TEXT CHECK (food_source IN ('usda', 'spoonacular', 'custom')),
  food_source_id TEXT,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recipe nutrients table (pre-computed per serving)
CREATE TABLE IF NOT EXISTS recipe_nutrient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,

  -- All nutrients per serving (matches NutrientVector)
  -- Core Macros
  calories DECIMAL(8,2) DEFAULT 0,
  protein_g DECIMAL(8,3) DEFAULT 0,
  carbs_g DECIMAL(8,3) DEFAULT 0,
  fat_g DECIMAL(8,3) DEFAULT 0,
  fiber_g DECIMAL(8,3) DEFAULT 0,

  -- Sub-macros
  saturated_fat_g DECIMAL(8,3) DEFAULT 0,
  monounsaturated_fat_g DECIMAL(8,3) DEFAULT 0,
  polyunsaturated_fat_g DECIMAL(8,3) DEFAULT 0,
  trans_fat_g DECIMAL(8,3) DEFAULT 0,
  cholesterol_mg DECIMAL(8,3) DEFAULT 0,
  total_sugars_g DECIMAL(8,3) DEFAULT 0,
  added_sugars_g DECIMAL(8,3) DEFAULT 0,

  -- Minerals
  sodium_mg DECIMAL(8,3) DEFAULT 0,
  potassium_mg DECIMAL(8,3) DEFAULT 0,
  calcium_mg DECIMAL(8,3) DEFAULT 0,
  iron_mg DECIMAL(8,3) DEFAULT 0,
  magnesium_mg DECIMAL(8,3) DEFAULT 0,
  zinc_mg DECIMAL(8,3) DEFAULT 0,
  phosphorus_mg DECIMAL(8,3) DEFAULT 0,
  copper_mg DECIMAL(8,3) DEFAULT 0,
  manganese_mg DECIMAL(8,3) DEFAULT 0,
  selenium_ug DECIMAL(8,3) DEFAULT 0,

  -- Vitamins
  vitamin_a_ug DECIMAL(8,3) DEFAULT 0,
  vitamin_c_mg DECIMAL(8,3) DEFAULT 0,
  vitamin_d_ug DECIMAL(8,3) DEFAULT 0,
  vitamin_e_mg DECIMAL(8,3) DEFAULT 0,
  vitamin_k_ug DECIMAL(8,3) DEFAULT 0,
  thiamin_b1_mg DECIMAL(8,3) DEFAULT 0,
  riboflavin_b2_mg DECIMAL(8,3) DEFAULT 0,
  niacin_b3_mg DECIMAL(8,3) DEFAULT 0,
  vitamin_b6_mg DECIMAL(8,3) DEFAULT 0,
  folate_b9_ug DECIMAL(8,3) DEFAULT 0,
  vitamin_b12_ug DECIMAL(8,3) DEFAULT 0,
  pantothenic_acid_b5_mg DECIMAL(8,3) DEFAULT 0,
  choline_mg DECIMAL(8,3) DEFAULT 0,

  -- Computation metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure one nutrient record per recipe
  UNIQUE(recipe_id)
);

-- Now add the FK reference to intake_log
ALTER TABLE intake_log
ADD CONSTRAINT fk_intake_log_recipe
FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE recipe ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredient ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_nutrient ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own recipes" ON recipe;
CREATE POLICY "Users manage own recipes"
  ON recipe FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own recipe ingredients" ON recipe_ingredient;
CREATE POLICY "Users manage own recipe ingredients"
  ON recipe_ingredient FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_ingredient.recipe_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_ingredient.recipe_id
  ));

DROP POLICY IF EXISTS "Users access own recipe nutrients" ON recipe_nutrient;
CREATE POLICY "Users access own recipe nutrients"
  ON recipe_nutrient FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_nutrient.recipe_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_nutrient.recipe_id
  ));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_recipe_user_id ON recipe(user_id);
CREATE INDEX IF NOT EXISTS idx_recipe_name ON recipe(user_id, name);
CREATE INDEX IF NOT EXISTS idx_recipe_source ON recipe(source, source_id) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_nutrition_computed ON recipe(nutrition_computed, nutrition_computed_at);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_recipe ON recipe_ingredient(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_sort ON recipe_ingredient(recipe_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_food ON recipe_ingredient(food_source, food_source_id) WHERE food_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipe_nutrient_recipe ON recipe_nutrient(recipe_id);

-- Updated at triggers
DROP TRIGGER IF EXISTS update_recipe_updated_at ON recipe;
CREATE TRIGGER update_recipe_updated_at
  BEFORE UPDATE ON recipe
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();