-- 010_extend_recipe_meal_plan_schema.sql
-- Extend recipe and meal planning schema to match Foundation.md domain models
-- Safe to run multiple times

-- Update recipe table to match RecipeData model more closely
ALTER TABLE recipe
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS prep_time INTEGER, -- rename for consistency
ADD COLUMN IF NOT EXISTS cook_time INTEGER, -- rename for consistency
ADD COLUMN IF NOT EXISTS nutrition_json JSONB; -- store complete NutrientVector

-- Update recipe_ingredient to match RecipeIngredient model
ALTER TABLE recipe_ingredient
ADD COLUMN IF NOT EXISTS nutrition_json JSONB, -- store NutrientVector for ingredient
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Create recipe_instructions table for structured instructions
CREATE TABLE IF NOT EXISTS recipe_instruction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,

  -- Instruction details
  order_index INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  duration INTEGER, -- minutes

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(recipe_id, order_index)
);

-- Enable RLS for recipe_instruction
ALTER TABLE recipe_instruction ENABLE ROW LEVEL SECURITY;

-- RLS Policy for recipe_instruction
DROP POLICY IF EXISTS "Users manage own recipe instructions" ON recipe_instruction;
CREATE POLICY "Users manage own recipe instructions"
  ON recipe_instruction FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_instruction.recipe_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM recipe WHERE id = recipe_instruction.recipe_id
  ));

-- Update meal_plan_item to support both recipes and foods
ALTER TABLE meal_plan_item
ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'recipe' CHECK (item_type IN ('recipe', 'food')),
ADD COLUMN IF NOT EXISTS food_id TEXT, -- for referencing food items
ADD COLUMN IF NOT EXISTS item_name TEXT, -- cached name for performance
ADD COLUMN IF NOT EXISTS nutrition_json JSONB, -- cached nutrition data
DROP CONSTRAINT IF EXISTS meal_plan_item_recipe_id_fkey; -- remove NOT NULL constraint

-- Make recipe_id nullable since we now support food items too
ALTER TABLE meal_plan_item
ALTER COLUMN recipe_id DROP NOT NULL;

-- Add constraint to ensure either recipe_id or food_id is set
ALTER TABLE meal_plan_item
ADD CONSTRAINT meal_plan_item_has_recipe_or_food
CHECK (
  (item_type = 'recipe' AND recipe_id IS NOT NULL AND food_id IS NULL) OR
  (item_type = 'food' AND food_id IS NOT NULL AND recipe_id IS NULL)
);

-- Re-add the foreign key as nullable
ALTER TABLE meal_plan_item
ADD CONSTRAINT meal_plan_item_recipe_id_fkey
FOREIGN KEY (recipe_id) REFERENCES recipe(id) ON DELETE CASCADE;

-- Drop the unique constraint and recreate to allow multiple items per meal
ALTER TABLE meal_plan_item
DROP CONSTRAINT IF EXISTS meal_plan_item_meal_plan_id_scheduled_date_meal_type_key;

-- Update meal_plan table to better match WeeklyMealPlan model
ALTER TABLE meal_plan
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'weekly' CHECK (plan_type IN ('weekly', 'custom')),
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

-- Create planned_meal table for more flexible meal planning
CREATE TABLE IF NOT EXISTS planned_meal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,

  -- Meal details
  item_type TEXT NOT NULL CHECK (item_type IN ('recipe', 'food')),
  recipe_id UUID REFERENCES recipe(id) ON DELETE CASCADE,
  food_id TEXT, -- external food reference
  name TEXT NOT NULL,

  -- Scheduling
  day_index INTEGER NOT NULL CHECK (day_index >= 0 AND day_index <= 6), -- 0-6 for week days
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),

  -- Serving details
  servings DECIMAL(6,2) NOT NULL DEFAULT 1.0 CHECK (servings > 0),
  unit TEXT NOT NULL DEFAULT 'serving',

  -- Cached nutrition (performance optimization)
  nutrition_json JSONB NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CHECK (
    (item_type = 'recipe' AND recipe_id IS NOT NULL AND food_id IS NULL) OR
    (item_type = 'food' AND food_id IS NOT NULL AND recipe_id IS NULL)
  )
);

-- Enable RLS for planned_meal
ALTER TABLE planned_meal ENABLE ROW LEVEL SECURITY;

-- RLS Policy for planned_meal
DROP POLICY IF EXISTS "Users manage own planned meals" ON planned_meal;
CREATE POLICY "Users manage own planned meals"
  ON planned_meal FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = planned_meal.meal_plan_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = planned_meal.meal_plan_id
  ));

-- Performance indexes for new tables and columns
CREATE INDEX IF NOT EXISTS idx_recipe_instruction_recipe ON recipe_instruction(recipe_id, order_index);
CREATE INDEX IF NOT EXISTS idx_recipe_nutrition_json ON recipe USING gin(nutrition_json) WHERE nutrition_json IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_nutrition_json ON recipe_ingredient USING gin(nutrition_json) WHERE nutrition_json IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_plan_item_type ON meal_plan_item(item_type);
CREATE INDEX IF NOT EXISTS idx_meal_plan_item_food ON meal_plan_item(food_id) WHERE food_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planned_meal_plan ON planned_meal(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_planned_meal_schedule ON planned_meal(meal_plan_id, day_index, meal_type);
CREATE INDEX IF NOT EXISTS idx_planned_meal_recipe ON planned_meal(recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_planned_meal_food ON planned_meal(food_id) WHERE food_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_planned_meal_nutrition ON planned_meal USING gin(nutrition_json);

-- Add shopping list table for caching generated shopping lists
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,

  -- Shopping list metadata
  name TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Shopping items (stored as JSONB for flexibility)
  items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Status
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(meal_plan_id) -- One shopping list per meal plan
);

-- Enable RLS for shopping_list
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

-- RLS Policy for shopping_list
DROP POLICY IF EXISTS "Users manage own shopping lists" ON shopping_list;
CREATE POLICY "Users manage own shopping lists"
  ON shopping_list FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = shopping_list.meal_plan_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = shopping_list.meal_plan_id
  ));

-- Index for shopping lists
CREATE INDEX IF NOT EXISTS idx_shopping_list_plan ON shopping_list(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_completed ON shopping_list(is_completed, completed_at);

-- Updated at triggers for new tables
DROP TRIGGER IF EXISTS update_planned_meal_updated_at ON planned_meal;
CREATE TRIGGER update_planned_meal_updated_at
  BEFORE UPDATE ON planned_meal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_updated_at ON shopping_list;
CREATE TRIGGER update_shopping_list_updated_at
  BEFORE UPDATE ON shopping_list
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create view for easy meal plan data retrieval
CREATE OR REPLACE VIEW meal_plan_with_meals AS
SELECT
  mp.id,
  mp.user_id,
  mp.name,
  mp.description,
  mp.start_date,
  mp.end_date,
  mp.is_active,
  mp.plan_type,
  mp.auto_generated,
  mp.created_at,
  mp.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id', pm.id,
        'item_type', pm.item_type,
        'recipe_id', pm.recipe_id,
        'food_id', pm.food_id,
        'name', pm.name,
        'day_index', pm.day_index,
        'meal_type', pm.meal_type,
        'servings', pm.servings,
        'unit', pm.unit,
        'nutrition', pm.nutrition_json
      ) ORDER BY pm.day_index, pm.meal_type, pm.created_at
    ) FILTER (WHERE pm.id IS NOT NULL),
    '[]'::json
  ) as planned_meals
FROM meal_plan mp
LEFT JOIN planned_meal pm ON mp.id = pm.meal_plan_id
GROUP BY mp.id, mp.user_id, mp.name, mp.description, mp.start_date, mp.end_date,
         mp.is_active, mp.plan_type, mp.auto_generated, mp.created_at, mp.updated_at;