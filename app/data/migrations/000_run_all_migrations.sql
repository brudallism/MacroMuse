-- 000_run_all_migrations.sql
-- Master migration script that runs all migrations in order
-- Safe to run multiple times - all individual migrations are idempotent

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Run all migrations in dependency order
\i 001_create_profile_table.sql
\i 002_create_goals_tables.sql
\i 003_create_intake_tables.sql
\i 004_create_nutrient_rollup_tables.sql
\i 005_create_recipe_tables.sql
\i 006_create_meal_plan_tables.sql
\i 007_create_rollup_functions.sql
\i 009_create_dietary_restrictions_table.sql

-- Create a migrations tracking table
CREATE TABLE IF NOT EXISTS migration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_name TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum TEXT
);

-- Record all migrations as executed
INSERT INTO migration_history (migration_name, checksum) VALUES
  ('001_create_profile_table.sql', 'profile-tables-v1'),
  ('002_create_goals_tables.sql', 'goals-tables-v1'),
  ('003_create_intake_tables.sql', 'intake-tables-v1'),
  ('004_create_nutrient_rollup_tables.sql', 'nutrient-rollup-tables-v1'),
  ('005_create_recipe_tables.sql', 'recipe-tables-v1'),
  ('006_create_meal_plan_tables.sql', 'meal-plan-tables-v1'),
  ('007_create_rollup_functions.sql', 'rollup-functions-v1'),
  ('009_create_dietary_restrictions_table.sql', 'dietary-restrictions-v1')
ON CONFLICT (migration_name) DO UPDATE SET
  executed_at = EXCLUDED.executed_at,
  checksum = EXCLUDED.checksum;

-- Create helpful views for common queries
CREATE OR REPLACE VIEW user_daily_summary AS
SELECT
  dt.user_id,
  dt.date,
  dt.calories,
  dt.protein_g,
  dt.carbs_g,
  dt.fat_g,
  dt.entry_count,
  -- Goals comparison (base goals for now - could be enhanced with goal precedence)
  gb.calories as goal_calories,
  gb.protein_g as goal_protein_g,
  gb.carbs_g as goal_carbs_g,
  gb.fat_g as goal_fat_g,
  -- Progress percentages
  CASE
    WHEN gb.calories > 0 THEN ROUND((dt.calories / gb.calories) * 100, 1)
    ELSE NULL
  END as calories_progress_pct,
  CASE
    WHEN gb.protein_g > 0 THEN ROUND((dt.protein_g / gb.protein_g) * 100, 1)
    ELSE NULL
  END as protein_progress_pct
FROM daily_total dt
LEFT JOIN goal_base gb ON dt.user_id = gb.user_id
  AND dt.date >= gb.effective_date
  AND (gb.end_date IS NULL OR dt.date <= gb.end_date);

-- Create indexes for the view
CREATE INDEX IF NOT EXISTS idx_daily_total_user_date_summary ON daily_total(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_goal_base_user_effective ON goal_base(user_id, effective_date DESC);

COMMENT ON VIEW user_daily_summary IS 'Daily nutrition summary with goal comparison and progress percentages';
COMMENT ON TABLE migration_history IS 'Tracks which migrations have been executed';

-- Final verification queries (for testing)
DO $$
DECLARE
  table_count INTEGER;
  function_count INTEGER;
BEGIN
  -- Count created tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'profile', 'goal_base', 'goal_weekly_cycle', 'goal_menstrual',
      'intake_log', 'daily_total', 'nutrient_daily', 'nutrient_weekly', 'nutrient_monthly',
      'recipe', 'recipe_ingredient', 'recipe_nutrient',
      'meal_plan', 'meal_plan_item', 'migration_history', 'dietary_restrictions'
    );

  -- Count created functions
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'update_updated_at_column', 'update_daily_totals', 'update_weekly_rollups',
      'after_write_rollup', 'compute_recipe_nutrients'
    );

  -- Report results
  RAISE NOTICE 'Migration completed successfully:';
  RAISE NOTICE '- Tables created: %', table_count;
  RAISE NOTICE '- Functions created: %', function_count;

  IF table_count < 16 THEN
    RAISE WARNING 'Expected at least 16 tables, only found %', table_count;
  END IF;

  IF function_count < 5 THEN
    RAISE WARNING 'Expected at least 5 functions, only found %', function_count;
  END IF;
END $$;