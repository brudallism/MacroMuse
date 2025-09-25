-- 002_create_goals_tables.sql
-- Goals system with precedence: menstrual > weekly > base
-- Safe to run multiple times

-- Base goals table (always active)
CREATE TABLE IF NOT EXISTS goal_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Goal type
  goal_type TEXT NOT NULL CHECK (goal_type IN ('weight_loss', 'weight_gain', 'maintain', 'muscle_gain')),

  -- Core macros (required from TargetVector)
  calories DECIMAL(8,2) NOT NULL CHECK (calories > 0),
  protein_g DECIMAL(8,2) NOT NULL CHECK (protein_g > 0),
  carbs_g DECIMAL(8,2) NOT NULL CHECK (carbs_g > 0),
  fat_g DECIMAL(8,2) NOT NULL CHECK (fat_g > 0),

  -- Optional fiber
  fiber_g DECIMAL(8,2) CHECK (fiber_g >= 0),

  -- Metadata
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CHECK (end_date IS NULL OR end_date > effective_date)
);

-- Weekly cycle goals (overrides base on specific days)
CREATE TABLE IF NOT EXISTS goal_weekly_cycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Day of week (0=Sunday, 6=Saturday)
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),

  -- Macro targets for this day
  calories DECIMAL(8,2) NOT NULL CHECK (calories > 0),
  protein_g DECIMAL(8,2) NOT NULL CHECK (protein_g > 0),
  carbs_g DECIMAL(8,2) NOT NULL CHECK (carbs_g > 0),
  fat_g DECIMAL(8,2) NOT NULL CHECK (fat_g > 0),
  fiber_g DECIMAL(8,2) CHECK (fiber_g >= 0),

  -- Metadata
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, day_of_week, effective_date),
  CHECK (end_date IS NULL OR end_date > effective_date)
);

-- Menstrual cycle goals (highest precedence)
CREATE TABLE IF NOT EXISTS goal_menstrual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cycle phase
  phase TEXT NOT NULL CHECK (phase IN ('menstrual', 'follicular', 'ovulation', 'luteal')),

  -- Macro targets for this phase
  calories DECIMAL(8,2) NOT NULL CHECK (calories > 0),
  protein_g DECIMAL(8,2) NOT NULL CHECK (protein_g > 0),
  carbs_g DECIMAL(8,2) NOT NULL CHECK (carbs_g > 0),
  fat_g DECIMAL(8,2) NOT NULL CHECK (fat_g > 0),
  fiber_g DECIMAL(8,2) CHECK (fiber_g >= 0),

  -- Cycle tracking
  cycle_start_date DATE NOT NULL,
  phase_start_day INTEGER NOT NULL CHECK (phase_start_day >= 1 AND phase_start_day <= 35),
  phase_end_day INTEGER NOT NULL CHECK (phase_end_day >= 1 AND phase_end_day <= 35),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id, cycle_start_date, phase),
  CHECK (phase_end_day >= phase_start_day)
);

-- Enable RLS on all goal tables
ALTER TABLE goal_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_weekly_cycle ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_menstrual ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users manage own base goals" ON goal_base;
CREATE POLICY "Users manage own base goals"
  ON goal_base FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own weekly goals" ON goal_weekly_cycle;
CREATE POLICY "Users manage own weekly goals"
  ON goal_weekly_cycle FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own menstrual goals" ON goal_menstrual;
CREATE POLICY "Users manage own menstrual goals"
  ON goal_menstrual FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_goal_base_user_id ON goal_base(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_base_effective_date ON goal_base(user_id, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_goal_weekly_user_id ON goal_weekly_cycle(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_weekly_day ON goal_weekly_cycle(user_id, day_of_week, effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_goal_menstrual_user_id ON goal_menstrual(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_menstrual_cycle ON goal_menstrual(user_id, cycle_start_date DESC);

-- Updated at triggers
DROP TRIGGER IF EXISTS update_goal_base_updated_at ON goal_base;
CREATE TRIGGER update_goal_base_updated_at
  BEFORE UPDATE ON goal_base
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goal_weekly_updated_at ON goal_weekly_cycle;
CREATE TRIGGER update_goal_weekly_updated_at
  BEFORE UPDATE ON goal_weekly_cycle
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_goal_menstrual_updated_at ON goal_menstrual;
CREATE TRIGGER update_goal_menstrual_updated_at
  BEFORE UPDATE ON goal_menstrual
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();