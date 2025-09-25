-- 006_create_meal_plan_tables.sql
-- Meal planning system as specified in Foundation document
-- Safe to run multiple times

-- Main meal plan table
CREATE TABLE IF NOT EXISTS meal_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  name TEXT NOT NULL,
  description TEXT,

  -- Date range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Status
  is_active BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CHECK (end_date >= start_date)
);

-- Meal plan items (recipes scheduled for specific dates/meals)
CREATE TABLE IF NOT EXISTS meal_plan_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plan(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),

  -- Serving adjustment
  servings DECIMAL(6,2) NOT NULL DEFAULT 1.0 CHECK (servings > 0),

  -- Optional notes
  notes TEXT,

  -- Completion tracking
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(meal_plan_id, scheduled_date, meal_type)
);

-- Enable RLS
ALTER TABLE meal_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_item ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own meal plans" ON meal_plan;
CREATE POLICY "Users manage own meal plans"
  ON meal_plan FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own meal plan items" ON meal_plan_item;
CREATE POLICY "Users manage own meal plan items"
  ON meal_plan_item FOR ALL
  USING (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = meal_plan_item.meal_plan_id
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM meal_plan WHERE id = meal_plan_item.meal_plan_id
  ));

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_meal_plan_user_id ON meal_plan(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_active ON meal_plan(user_id, is_active, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_meal_plan_date_range ON meal_plan(user_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_meal_plan_item_plan ON meal_plan_item(meal_plan_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_item_schedule ON meal_plan_item(meal_plan_id, scheduled_date, meal_type);
CREATE INDEX IF NOT EXISTS idx_meal_plan_item_recipe ON meal_plan_item(recipe_id);
CREATE INDEX IF NOT EXISTS idx_meal_plan_item_completed ON meal_plan_item(is_completed, completed_at);

-- Updated at trigger
DROP TRIGGER IF EXISTS update_meal_plan_updated_at ON meal_plan;
CREATE TRIGGER update_meal_plan_updated_at
  BEFORE UPDATE ON meal_plan
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();