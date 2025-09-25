-- 007_create_rollup_functions.sql
-- Database functions for nutrient rollups and analytics
-- Safe to run multiple times

-- Function to update daily totals from intake_log
CREATE OR REPLACE FUNCTION update_daily_totals(target_user_id UUID, target_date DATE)
RETURNS VOID AS $$
DECLARE
  total_record RECORD;
BEGIN
  -- Aggregate all intake for the date
  SELECT
    COUNT(*) as entry_count,
    COALESCE(SUM(calories), 0) as calories,
    COALESCE(SUM(protein_g), 0) as protein_g,
    COALESCE(SUM(carbs_g), 0) as carbs_g,
    COALESCE(SUM(fat_g), 0) as fat_g,
    COALESCE(SUM(fiber_g), 0) as fiber_g,

    -- Sub-macros
    COALESCE(SUM(saturated_fat_g), 0) as saturated_fat_g,
    COALESCE(SUM(monounsaturated_fat_g), 0) as monounsaturated_fat_g,
    COALESCE(SUM(polyunsaturated_fat_g), 0) as polyunsaturated_fat_g,
    COALESCE(SUM(trans_fat_g), 0) as trans_fat_g,
    COALESCE(SUM(cholesterol_mg), 0) as cholesterol_mg,
    COALESCE(SUM(total_sugars_g), 0) as total_sugars_g,
    COALESCE(SUM(added_sugars_g), 0) as added_sugars_g,

    -- Minerals
    COALESCE(SUM(sodium_mg), 0) as sodium_mg,
    COALESCE(SUM(potassium_mg), 0) as potassium_mg,
    COALESCE(SUM(calcium_mg), 0) as calcium_mg,
    COALESCE(SUM(iron_mg), 0) as iron_mg,
    COALESCE(SUM(magnesium_mg), 0) as magnesium_mg,
    COALESCE(SUM(zinc_mg), 0) as zinc_mg,
    COALESCE(SUM(phosphorus_mg), 0) as phosphorus_mg,
    COALESCE(SUM(copper_mg), 0) as copper_mg,
    COALESCE(SUM(manganese_mg), 0) as manganese_mg,
    COALESCE(SUM(selenium_ug), 0) as selenium_ug,

    -- Vitamins
    COALESCE(SUM(vitamin_a_ug), 0) as vitamin_a_ug,
    COALESCE(SUM(vitamin_c_mg), 0) as vitamin_c_mg,
    COALESCE(SUM(vitamin_d_ug), 0) as vitamin_d_ug,
    COALESCE(SUM(vitamin_e_mg), 0) as vitamin_e_mg,
    COALESCE(SUM(vitamin_k_ug), 0) as vitamin_k_ug,
    COALESCE(SUM(thiamin_b1_mg), 0) as thiamin_b1_mg,
    COALESCE(SUM(riboflavin_b2_mg), 0) as riboflavin_b2_mg,
    COALESCE(SUM(niacin_b3_mg), 0) as niacin_b3_mg,
    COALESCE(SUM(vitamin_b6_mg), 0) as vitamin_b6_mg,
    COALESCE(SUM(folate_b9_ug), 0) as folate_b9_ug,
    COALESCE(SUM(vitamin_b12_ug), 0) as vitamin_b12_ug,
    COALESCE(SUM(pantothenic_acid_b5_mg), 0) as pantothenic_acid_b5_mg,
    COALESCE(SUM(choline_mg), 0) as choline_mg

  INTO total_record
  FROM intake_log
  WHERE user_id = target_user_id
    AND logged_at::date = target_date;

  -- Upsert daily total
  INSERT INTO daily_total (
    user_id, date, entry_count,
    calories, protein_g, carbs_g, fat_g, fiber_g,
    saturated_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g, trans_fat_g,
    cholesterol_mg, total_sugars_g, added_sugars_g,
    sodium_mg, potassium_mg, calcium_mg, iron_mg, magnesium_mg, zinc_mg,
    phosphorus_mg, copper_mg, manganese_mg, selenium_ug,
    vitamin_a_ug, vitamin_c_mg, vitamin_d_ug, vitamin_e_mg, vitamin_k_ug,
    thiamin_b1_mg, riboflavin_b2_mg, niacin_b3_mg, vitamin_b6_mg,
    folate_b9_ug, vitamin_b12_ug, pantothenic_acid_b5_mg, choline_mg,
    last_updated
  ) VALUES (
    target_user_id, target_date, total_record.entry_count,
    total_record.calories, total_record.protein_g, total_record.carbs_g,
    total_record.fat_g, total_record.fiber_g,
    total_record.saturated_fat_g, total_record.monounsaturated_fat_g,
    total_record.polyunsaturated_fat_g, total_record.trans_fat_g,
    total_record.cholesterol_mg, total_record.total_sugars_g, total_record.added_sugars_g,
    total_record.sodium_mg, total_record.potassium_mg, total_record.calcium_mg,
    total_record.iron_mg, total_record.magnesium_mg, total_record.zinc_mg,
    total_record.phosphorus_mg, total_record.copper_mg, total_record.manganese_mg,
    total_record.selenium_ug,
    total_record.vitamin_a_ug, total_record.vitamin_c_mg, total_record.vitamin_d_ug,
    total_record.vitamin_e_mg, total_record.vitamin_k_ug,
    total_record.thiamin_b1_mg, total_record.riboflavin_b2_mg, total_record.niacin_b3_mg,
    total_record.vitamin_b6_mg, total_record.folate_b9_ug, total_record.vitamin_b12_ug,
    total_record.pantothenic_acid_b5_mg, total_record.choline_mg,
    NOW()
  )
  ON CONFLICT (user_id, date) DO UPDATE SET
    entry_count = EXCLUDED.entry_count,
    calories = EXCLUDED.calories,
    protein_g = EXCLUDED.protein_g,
    carbs_g = EXCLUDED.carbs_g,
    fat_g = EXCLUDED.fat_g,
    fiber_g = EXCLUDED.fiber_g,
    saturated_fat_g = EXCLUDED.saturated_fat_g,
    monounsaturated_fat_g = EXCLUDED.monounsaturated_fat_g,
    polyunsaturated_fat_g = EXCLUDED.polyunsaturated_fat_g,
    trans_fat_g = EXCLUDED.trans_fat_g,
    cholesterol_mg = EXCLUDED.cholesterol_mg,
    total_sugars_g = EXCLUDED.total_sugars_g,
    added_sugars_g = EXCLUDED.added_sugars_g,
    sodium_mg = EXCLUDED.sodium_mg,
    potassium_mg = EXCLUDED.potassium_mg,
    calcium_mg = EXCLUDED.calcium_mg,
    iron_mg = EXCLUDED.iron_mg,
    magnesium_mg = EXCLUDED.magnesium_mg,
    zinc_mg = EXCLUDED.zinc_mg,
    phosphorus_mg = EXCLUDED.phosphorus_mg,
    copper_mg = EXCLUDED.copper_mg,
    manganese_mg = EXCLUDED.manganese_mg,
    selenium_ug = EXCLUDED.selenium_ug,
    vitamin_a_ug = EXCLUDED.vitamin_a_ug,
    vitamin_c_mg = EXCLUDED.vitamin_c_mg,
    vitamin_d_ug = EXCLUDED.vitamin_d_ug,
    vitamin_e_mg = EXCLUDED.vitamin_e_mg,
    vitamin_k_ug = EXCLUDED.vitamin_k_ug,
    thiamin_b1_mg = EXCLUDED.thiamin_b1_mg,
    riboflavin_b2_mg = EXCLUDED.riboflavin_b2_mg,
    niacin_b3_mg = EXCLUDED.niacin_b3_mg,
    vitamin_b6_mg = EXCLUDED.vitamin_b6_mg,
    folate_b9_ug = EXCLUDED.folate_b9_ug,
    vitamin_b12_ug = EXCLUDED.vitamin_b12_ug,
    pantothenic_acid_b5_mg = EXCLUDED.pantothenic_acid_b5_mg,
    choline_mg = EXCLUDED.choline_mg,
    last_updated = EXCLUDED.last_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update weekly rollups from daily totals
CREATE OR REPLACE FUNCTION update_weekly_rollups(target_user_id UUID, target_year INTEGER, target_week INTEGER)
RETURNS VOID AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  rollup_record RECORD;
BEGIN
  -- Calculate week start (Monday) and end dates
  week_start := DATE_TRUNC('week', make_date(target_year, 1, 1)) + INTERVAL '1 week' * (target_week - 1);
  week_end := week_start + INTERVAL '6 days';

  -- Aggregate daily totals for the week
  SELECT
    COUNT(*) as days_with_data,
    COALESCE(SUM(entry_count), 0) as total_entries,
    COALESCE(AVG(calories), 0) as avg_calories,
    COALESCE(AVG(protein_g), 0) as avg_protein_g,
    COALESCE(AVG(carbs_g), 0) as avg_carbs_g,
    COALESCE(AVG(fat_g), 0) as avg_fat_g,
    COALESCE(AVG(fiber_g), 0) as avg_fiber_g,

    -- Sub-macros averages
    COALESCE(AVG(saturated_fat_g), 0) as avg_saturated_fat_g,
    COALESCE(AVG(monounsaturated_fat_g), 0) as avg_monounsaturated_fat_g,
    COALESCE(AVG(polyunsaturated_fat_g), 0) as avg_polyunsaturated_fat_g,
    COALESCE(AVG(trans_fat_g), 0) as avg_trans_fat_g,
    COALESCE(AVG(cholesterol_mg), 0) as avg_cholesterol_mg,
    COALESCE(AVG(total_sugars_g), 0) as avg_total_sugars_g,
    COALESCE(AVG(added_sugars_g), 0) as avg_added_sugars_g,

    -- Minerals averages
    COALESCE(AVG(sodium_mg), 0) as avg_sodium_mg,
    COALESCE(AVG(potassium_mg), 0) as avg_potassium_mg,
    COALESCE(AVG(calcium_mg), 0) as avg_calcium_mg,
    COALESCE(AVG(iron_mg), 0) as avg_iron_mg,
    COALESCE(AVG(magnesium_mg), 0) as avg_magnesium_mg,
    COALESCE(AVG(zinc_mg), 0) as avg_zinc_mg,
    COALESCE(AVG(phosphorus_mg), 0) as avg_phosphorus_mg,
    COALESCE(AVG(copper_mg), 0) as avg_copper_mg,
    COALESCE(AVG(manganese_mg), 0) as avg_manganese_mg,
    COALESCE(AVG(selenium_ug), 0) as avg_selenium_ug,

    -- Vitamins averages
    COALESCE(AVG(vitamin_a_ug), 0) as avg_vitamin_a_ug,
    COALESCE(AVG(vitamin_c_mg), 0) as avg_vitamin_c_mg,
    COALESCE(AVG(vitamin_d_ug), 0) as avg_vitamin_d_ug,
    COALESCE(AVG(vitamin_e_mg), 0) as avg_vitamin_e_mg,
    COALESCE(AVG(vitamin_k_ug), 0) as avg_vitamin_k_ug,
    COALESCE(AVG(thiamin_b1_mg), 0) as avg_thiamin_b1_mg,
    COALESCE(AVG(riboflavin_b2_mg), 0) as avg_riboflavin_b2_mg,
    COALESCE(AVG(niacin_b3_mg), 0) as avg_niacin_b3_mg,
    COALESCE(AVG(vitamin_b6_mg), 0) as avg_vitamin_b6_mg,
    COALESCE(AVG(folate_b9_ug), 0) as avg_folate_b9_ug,
    COALESCE(AVG(vitamin_b12_ug), 0) as avg_vitamin_b12_ug,
    COALESCE(AVG(pantothenic_acid_b5_mg), 0) as avg_pantothenic_acid_b5_mg,
    COALESCE(AVG(choline_mg), 0) as avg_choline_mg

  INTO rollup_record
  FROM daily_total
  WHERE user_id = target_user_id
    AND date >= week_start
    AND date <= week_end;

  -- Upsert weekly rollup
  INSERT INTO nutrient_weekly (
    user_id, year, week, week_start_date, days_with_data, total_entries,
    avg_calories, avg_protein_g, avg_carbs_g, avg_fat_g, avg_fiber_g,
    avg_saturated_fat_g, avg_monounsaturated_fat_g, avg_polyunsaturated_fat_g, avg_trans_fat_g,
    avg_cholesterol_mg, avg_total_sugars_g, avg_added_sugars_g,
    avg_sodium_mg, avg_potassium_mg, avg_calcium_mg, avg_iron_mg, avg_magnesium_mg, avg_zinc_mg,
    avg_phosphorus_mg, avg_copper_mg, avg_manganese_mg, avg_selenium_ug,
    avg_vitamin_a_ug, avg_vitamin_c_mg, avg_vitamin_d_ug, avg_vitamin_e_mg, avg_vitamin_k_ug,
    avg_thiamin_b1_mg, avg_riboflavin_b2_mg, avg_niacin_b3_mg, avg_vitamin_b6_mg,
    avg_folate_b9_ug, avg_vitamin_b12_ug, avg_pantothenic_acid_b5_mg, avg_choline_mg,
    computed_at
  ) VALUES (
    target_user_id, target_year, target_week, week_start, rollup_record.days_with_data, rollup_record.total_entries,
    rollup_record.avg_calories, rollup_record.avg_protein_g, rollup_record.avg_carbs_g,
    rollup_record.avg_fat_g, rollup_record.avg_fiber_g,
    rollup_record.avg_saturated_fat_g, rollup_record.avg_monounsaturated_fat_g,
    rollup_record.avg_polyunsaturated_fat_g, rollup_record.avg_trans_fat_g,
    rollup_record.avg_cholesterol_mg, rollup_record.avg_total_sugars_g, rollup_record.avg_added_sugars_g,
    rollup_record.avg_sodium_mg, rollup_record.avg_potassium_mg, rollup_record.avg_calcium_mg,
    rollup_record.avg_iron_mg, rollup_record.avg_magnesium_mg, rollup_record.avg_zinc_mg,
    rollup_record.avg_phosphorus_mg, rollup_record.avg_copper_mg, rollup_record.avg_manganese_mg,
    rollup_record.avg_selenium_ug,
    rollup_record.avg_vitamin_a_ug, rollup_record.avg_vitamin_c_mg, rollup_record.avg_vitamin_d_ug,
    rollup_record.avg_vitamin_e_mg, rollup_record.avg_vitamin_k_ug,
    rollup_record.avg_thiamin_b1_mg, rollup_record.avg_riboflavin_b2_mg, rollup_record.avg_niacin_b3_mg,
    rollup_record.avg_vitamin_b6_mg, rollup_record.avg_folate_b9_ug, rollup_record.avg_vitamin_b12_ug,
    rollup_record.avg_pantothenic_acid_b5_mg, rollup_record.avg_choline_mg,
    NOW()
  )
  ON CONFLICT (user_id, year, week) DO UPDATE SET
    week_start_date = EXCLUDED.week_start_date,
    days_with_data = EXCLUDED.days_with_data,
    total_entries = EXCLUDED.total_entries,
    avg_calories = EXCLUDED.avg_calories,
    avg_protein_g = EXCLUDED.avg_protein_g,
    avg_carbs_g = EXCLUDED.avg_carbs_g,
    avg_fat_g = EXCLUDED.avg_fat_g,
    avg_fiber_g = EXCLUDED.avg_fiber_g,
    avg_saturated_fat_g = EXCLUDED.avg_saturated_fat_g,
    avg_monounsaturated_fat_g = EXCLUDED.avg_monounsaturated_fat_g,
    avg_polyunsaturated_fat_g = EXCLUDED.avg_polyunsaturated_fat_g,
    avg_trans_fat_g = EXCLUDED.avg_trans_fat_g,
    avg_cholesterol_mg = EXCLUDED.avg_cholesterol_mg,
    avg_total_sugars_g = EXCLUDED.avg_total_sugars_g,
    avg_added_sugars_g = EXCLUDED.avg_added_sugars_g,
    avg_sodium_mg = EXCLUDED.avg_sodium_mg,
    avg_potassium_mg = EXCLUDED.avg_potassium_mg,
    avg_calcium_mg = EXCLUDED.avg_calcium_mg,
    avg_iron_mg = EXCLUDED.avg_iron_mg,
    avg_magnesium_mg = EXCLUDED.avg_magnesium_mg,
    avg_zinc_mg = EXCLUDED.avg_zinc_mg,
    avg_phosphorus_mg = EXCLUDED.avg_phosphorus_mg,
    avg_copper_mg = EXCLUDED.avg_copper_mg,
    avg_manganese_mg = EXCLUDED.avg_manganese_mg,
    avg_selenium_ug = EXCLUDED.avg_selenium_ug,
    avg_vitamin_a_ug = EXCLUDED.avg_vitamin_a_ug,
    avg_vitamin_c_mg = EXCLUDED.avg_vitamin_c_mg,
    avg_vitamin_d_ug = EXCLUDED.avg_vitamin_d_ug,
    avg_vitamin_e_mg = EXCLUDED.avg_vitamin_e_mg,
    avg_vitamin_k_ug = EXCLUDED.avg_vitamin_k_ug,
    avg_thiamin_b1_mg = EXCLUDED.avg_thiamin_b1_mg,
    avg_riboflavin_b2_mg = EXCLUDED.avg_riboflavin_b2_mg,
    avg_niacin_b3_mg = EXCLUDED.avg_niacin_b3_mg,
    avg_vitamin_b6_mg = EXCLUDED.avg_vitamin_b6_mg,
    avg_folate_b9_ug = EXCLUDED.avg_folate_b9_ug,
    avg_vitamin_b12_ug = EXCLUDED.avg_vitamin_b12_ug,
    avg_pantothenic_acid_b5_mg = EXCLUDED.avg_pantothenic_acid_b5_mg,
    avg_choline_mg = EXCLUDED.avg_choline_mg,
    computed_at = EXCLUDED.computed_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for afterWriteRollup (called after intake_log changes)
CREATE OR REPLACE FUNCTION after_write_rollup(log_date DATE)
RETURNS VOID AS $$
DECLARE
  affected_user UUID;
  log_year INTEGER;
  log_week INTEGER;
BEGIN
  -- Get affected user from the intake_log for this date
  SELECT DISTINCT user_id INTO affected_user
  FROM intake_log
  WHERE logged_at::date = log_date
  LIMIT 1;

  -- If no user found, nothing to do
  IF affected_user IS NULL THEN
    RETURN;
  END IF;

  -- Update daily totals
  PERFORM update_daily_totals(affected_user, log_date);

  -- Calculate week details for weekly rollup
  log_year := EXTRACT(ISOYEAR FROM log_date);
  log_week := EXTRACT(WEEK FROM log_date);

  -- Update weekly rollups
  PERFORM update_weekly_rollups(affected_user, log_year, log_week);

  -- Note: Monthly rollups can be computed on-demand or via scheduled jobs
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to compute recipe nutrients from ingredients
CREATE OR REPLACE FUNCTION compute_recipe_nutrients(target_recipe_id UUID)
RETURNS VOID AS $$
DECLARE
  recipe_servings DECIMAL(6,2);
  nutrient_totals RECORD;
BEGIN
  -- Get recipe servings
  SELECT servings INTO recipe_servings
  FROM recipe
  WHERE id = target_recipe_id;

  IF recipe_servings IS NULL THEN
    RETURN;
  END IF;

  -- Sum nutrients from all ingredients (would need food database lookup)
  -- This is a placeholder - actual implementation would join with food database
  SELECT
    0 as calories,
    0 as protein_g,
    0 as carbs_g,
    0 as fat_g,
    0 as fiber_g,
    0 as saturated_fat_g,
    0 as monounsaturated_fat_g,
    0 as polyunsaturated_fat_g,
    0 as trans_fat_g,
    0 as cholesterol_mg,
    0 as total_sugars_g,
    0 as added_sugars_g,
    0 as sodium_mg,
    0 as potassium_mg,
    0 as calcium_mg,
    0 as iron_mg,
    0 as magnesium_mg,
    0 as zinc_mg,
    0 as phosphorus_mg,
    0 as copper_mg,
    0 as manganese_mg,
    0 as selenium_ug,
    0 as vitamin_a_ug,
    0 as vitamin_c_mg,
    0 as vitamin_d_ug,
    0 as vitamin_e_mg,
    0 as vitamin_k_ug,
    0 as thiamin_b1_mg,
    0 as riboflavin_b2_mg,
    0 as niacin_b3_mg,
    0 as vitamin_b6_mg,
    0 as folate_b9_ug,
    0 as vitamin_b12_ug,
    0 as pantothenic_acid_b5_mg,
    0 as choline_mg
  INTO nutrient_totals;

  -- Upsert recipe nutrients (per serving)
  INSERT INTO recipe_nutrient (
    recipe_id,
    calories, protein_g, carbs_g, fat_g, fiber_g,
    saturated_fat_g, monounsaturated_fat_g, polyunsaturated_fat_g, trans_fat_g,
    cholesterol_mg, total_sugars_g, added_sugars_g,
    sodium_mg, potassium_mg, calcium_mg, iron_mg, magnesium_mg, zinc_mg,
    phosphorus_mg, copper_mg, manganese_mg, selenium_ug,
    vitamin_a_ug, vitamin_c_mg, vitamin_d_ug, vitamin_e_mg, vitamin_k_ug,
    thiamin_b1_mg, riboflavin_b2_mg, niacin_b3_mg, vitamin_b6_mg,
    folate_b9_ug, vitamin_b12_ug, pantothenic_acid_b5_mg, choline_mg,
    computed_at
  ) VALUES (
    target_recipe_id,
    nutrient_totals.calories / recipe_servings,
    nutrient_totals.protein_g / recipe_servings,
    nutrient_totals.carbs_g / recipe_servings,
    nutrient_totals.fat_g / recipe_servings,
    nutrient_totals.fiber_g / recipe_servings,
    nutrient_totals.saturated_fat_g / recipe_servings,
    nutrient_totals.monounsaturated_fat_g / recipe_servings,
    nutrient_totals.polyunsaturated_fat_g / recipe_servings,
    nutrient_totals.trans_fat_g / recipe_servings,
    nutrient_totals.cholesterol_mg / recipe_servings,
    nutrient_totals.total_sugars_g / recipe_servings,
    nutrient_totals.added_sugars_g / recipe_servings,
    nutrient_totals.sodium_mg / recipe_servings,
    nutrient_totals.potassium_mg / recipe_servings,
    nutrient_totals.calcium_mg / recipe_servings,
    nutrient_totals.iron_mg / recipe_servings,
    nutrient_totals.magnesium_mg / recipe_servings,
    nutrient_totals.zinc_mg / recipe_servings,
    nutrient_totals.phosphorus_mg / recipe_servings,
    nutrient_totals.copper_mg / recipe_servings,
    nutrient_totals.manganese_mg / recipe_servings,
    nutrient_totals.selenium_ug / recipe_servings,
    nutrient_totals.vitamin_a_ug / recipe_servings,
    nutrient_totals.vitamin_c_mg / recipe_servings,
    nutrient_totals.vitamin_d_ug / recipe_servings,
    nutrient_totals.vitamin_e_mg / recipe_servings,
    nutrient_totals.vitamin_k_ug / recipe_servings,
    nutrient_totals.thiamin_b1_mg / recipe_servings,
    nutrient_totals.riboflavin_b2_mg / recipe_servings,
    nutrient_totals.niacin_b3_mg / recipe_servings,
    nutrient_totals.vitamin_b6_mg / recipe_servings,
    nutrient_totals.folate_b9_ug / recipe_servings,
    nutrient_totals.vitamin_b12_ug / recipe_servings,
    nutrient_totals.pantothenic_acid_b5_mg / recipe_servings,
    nutrient_totals.choline_mg / recipe_servings,
    NOW()
  )
  ON CONFLICT (recipe_id) DO UPDATE SET
    calories = EXCLUDED.calories,
    protein_g = EXCLUDED.protein_g,
    carbs_g = EXCLUDED.carbs_g,
    fat_g = EXCLUDED.fat_g,
    fiber_g = EXCLUDED.fiber_g,
    saturated_fat_g = EXCLUDED.saturated_fat_g,
    monounsaturated_fat_g = EXCLUDED.monounsaturated_fat_g,
    polyunsaturated_fat_g = EXCLUDED.polyunsaturated_fat_g,
    trans_fat_g = EXCLUDED.trans_fat_g,
    cholesterol_mg = EXCLUDED.cholesterol_mg,
    total_sugars_g = EXCLUDED.total_sugars_g,
    added_sugars_g = EXCLUDED.added_sugars_g,
    sodium_mg = EXCLUDED.sodium_mg,
    potassium_mg = EXCLUDED.potassium_mg,
    calcium_mg = EXCLUDED.calcium_mg,
    iron_mg = EXCLUDED.iron_mg,
    magnesium_mg = EXCLUDED.magnesium_mg,
    zinc_mg = EXCLUDED.zinc_mg,
    phosphorus_mg = EXCLUDED.phosphorus_mg,
    copper_mg = EXCLUDED.copper_mg,
    manganese_mg = EXCLUDED.manganese_mg,
    selenium_ug = EXCLUDED.selenium_ug,
    vitamin_a_ug = EXCLUDED.vitamin_a_ug,
    vitamin_c_mg = EXCLUDED.vitamin_c_mg,
    vitamin_d_ug = EXCLUDED.vitamin_d_ug,
    vitamin_e_mg = EXCLUDED.vitamin_e_mg,
    vitamin_k_ug = EXCLUDED.vitamin_k_ug,
    thiamin_b1_mg = EXCLUDED.thiamin_b1_mg,
    riboflavin_b2_mg = EXCLUDED.riboflavin_b2_mg,
    niacin_b3_mg = EXCLUDED.niacin_b3_mg,
    vitamin_b6_mg = EXCLUDED.vitamin_b6_mg,
    folate_b9_ug = EXCLUDED.folate_b9_ug,
    vitamin_b12_ug = EXCLUDED.vitamin_b12_ug,
    pantothenic_acid_b5_mg = EXCLUDED.pantothenic_acid_b5_mg,
    choline_mg = EXCLUDED.choline_mg,
    computed_at = EXCLUDED.computed_at;

  -- Update recipe computed flags
  UPDATE recipe
  SET
    nutrition_computed = TRUE,
    nutrition_computed_at = NOW(),
    calories_per_serving = nutrient_totals.calories / recipe_servings,
    protein_per_serving = nutrient_totals.protein_g / recipe_servings,
    carbs_per_serving = nutrient_totals.carbs_g / recipe_servings,
    fat_per_serving = nutrient_totals.fat_g / recipe_servings
  WHERE id = target_recipe_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;