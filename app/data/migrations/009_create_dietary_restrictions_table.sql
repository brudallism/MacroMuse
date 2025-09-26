-- 009_create_dietary_restrictions_table.sql
-- Add dietary restrictions table for comprehensive preference tracking
-- Foundation compliant - follows existing schema patterns

-- Create dietary restrictions table
CREATE TABLE IF NOT EXISTS dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Diet types (array of strings)
  diets TEXT[] NOT NULL DEFAULT '{}',

  -- Allergen types (array of strings)
  allergies TEXT[] NOT NULL DEFAULT '{}',

  -- Custom excluded ingredients (array of strings)
  exclusions TEXT[] NOT NULL DEFAULT '{}',

  -- General preferences (array of strings)
  preferences TEXT[] NOT NULL DEFAULT '{}',

  -- Special flags
  strict_fodmap BOOLEAN NOT NULL DEFAULT FALSE,

  -- Standard audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dietary_restrictions_user_id ON dietary_restrictions(user_id);
CREATE INDEX IF NOT EXISTS idx_dietary_restrictions_diets ON dietary_restrictions USING GIN(diets);
CREATE INDEX IF NOT EXISTS idx_dietary_restrictions_allergies ON dietary_restrictions USING GIN(allergies);
CREATE INDEX IF NOT EXISTS idx_dietary_restrictions_exclusions ON dietary_restrictions USING GIN(exclusions);

-- Add RLS policies
ALTER TABLE dietary_restrictions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own dietary restrictions
CREATE POLICY dietary_restrictions_policy ON dietary_restrictions
  FOR ALL
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_dietary_restrictions_updated_at
  BEFORE UPDATE ON dietary_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add constraints for valid diet types
ALTER TABLE dietary_restrictions
ADD CONSTRAINT check_valid_diets
CHECK (
  diets <@ ARRAY[
    'vegan', 'vegetarian', 'pescatarian', 'ketogenic',
    'paleo', 'primal', 'low-fodmap', 'whole30', 'none'
  ]
);

-- Add constraints for valid allergen types
ALTER TABLE dietary_restrictions
ADD CONSTRAINT check_valid_allergies
CHECK (
  allergies <@ ARRAY[
    'dairy', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts',
    'wheat', 'soy', 'sesame', 'gluten', 'grain', 'seafood'
  ]
);

-- Add constraints for valid preference types
ALTER TABLE dietary_restrictions
ADD CONSTRAINT check_valid_preferences
CHECK (
  preferences <@ ARRAY[
    'organic_preferred', 'local_preferred', 'minimal_processing',
    'low_sodium', 'low_sugar'
  ]
);

-- Create helper view for current user's dietary restrictions
CREATE OR REPLACE VIEW current_user_dietary_restrictions AS
SELECT
  dr.*
FROM dietary_restrictions dr
WHERE dr.user_id = auth.uid();

-- Add comments for documentation
COMMENT ON TABLE dietary_restrictions IS 'User dietary restrictions and preferences for food filtering';
COMMENT ON COLUMN dietary_restrictions.diets IS 'Array of diet types (vegan, vegetarian, etc.)';
COMMENT ON COLUMN dietary_restrictions.allergies IS 'Array of allergen types (dairy, gluten, etc.)';
COMMENT ON COLUMN dietary_restrictions.exclusions IS 'Array of custom excluded ingredients';
COMMENT ON COLUMN dietary_restrictions.preferences IS 'Array of general food preferences';
COMMENT ON COLUMN dietary_restrictions.strict_fodmap IS 'Enable strict FODMAP exclusions for low-fodmap diet';
COMMENT ON VIEW current_user_dietary_restrictions IS 'Current user dietary restrictions (RLS filtered)';

-- Create function to ensure only one record per user
CREATE OR REPLACE FUNCTION ensure_single_dietary_restriction_per_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete any existing records for this user
  DELETE FROM dietary_restrictions
  WHERE user_id = NEW.user_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to ensure single record per user
CREATE TRIGGER ensure_single_dietary_restriction_per_user_trigger
  BEFORE INSERT OR UPDATE ON dietary_restrictions
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_dietary_restriction_per_user();

-- Create convenience functions for common operations
CREATE OR REPLACE FUNCTION upsert_user_dietary_restrictions(
  p_diets TEXT[] DEFAULT '{}',
  p_allergies TEXT[] DEFAULT '{}',
  p_exclusions TEXT[] DEFAULT '{}',
  p_preferences TEXT[] DEFAULT '{}',
  p_strict_fodmap BOOLEAN DEFAULT FALSE
) RETURNS dietary_restrictions AS $$
DECLARE
  result dietary_restrictions;
BEGIN
  INSERT INTO dietary_restrictions (
    user_id, diets, allergies, exclusions, preferences, strict_fodmap
  ) VALUES (
    auth.uid(), p_diets, p_allergies, p_exclusions, p_preferences, p_strict_fodmap
  )
  ON CONFLICT ON CONSTRAINT dietary_restrictions_pkey
  DO UPDATE SET
    diets = EXCLUDED.diets,
    allergies = EXCLUDED.allergies,
    exclusions = EXCLUDED.exclusions,
    preferences = EXCLUDED.preferences,
    strict_fodmap = EXCLUDED.strict_fodmap,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON dietary_restrictions TO authenticated;
GRANT SELECT ON current_user_dietary_restrictions TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_user_dietary_restrictions TO authenticated;