-- 001_create_profile_table.sql
-- Idempotent migration for user profiles table
-- Safe to run multiple times

-- Create profile table (singular name as per Foundation doc)
CREATE TABLE IF NOT EXISTS profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,

  -- Preferences from Foundation document
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  diet TEXT CHECK (diet IN ('standard', 'vegetarian', 'vegan', 'keto', 'paleo')),
  allergies JSONB DEFAULT '[]'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Enable Row Level Security
ALTER TABLE profile ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own profile
DROP POLICY IF EXISTS "Users can manage own profile" ON profile;
CREATE POLICY "Users can manage own profile"
  ON profile FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_profile_user_id ON profile(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_profile_updated_at ON profile;
CREATE TRIGGER update_profile_updated_at
  BEFORE UPDATE ON profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();