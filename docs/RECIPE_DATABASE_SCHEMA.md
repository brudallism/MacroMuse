# Recipe Support - Database Schema Changes

## Overview
This document outlines the database schema changes required to support recipe search, favorites, recent views, and logging functionality.

---

## 1. Recipe Favorites Table

### Table: `user_recipe_favorites`

Stores user's favorited recipes from Spoonacular search results.

```sql
CREATE TABLE user_recipe_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,

  -- Basic Info
  recipe_name TEXT NOT NULL,
  recipe_image TEXT,
  recipe_source TEXT NOT NULL DEFAULT 'spoonacular',
  recipe_source_id TEXT,

  -- Timing
  recipe_servings INTEGER NOT NULL,
  recipe_ready_minutes INTEGER,

  -- Dietary Tags (for filtering/badges)
  recipe_diets TEXT[], -- ["vegetarian", "gluten free", "ketogenic"]
  recipe_dish_types TEXT[], -- ["lunch", "main course"]
  recipe_cuisines TEXT[], -- ["italian", "mediterranean"]

  -- Preview Content
  recipe_summary TEXT,

  -- Nutrition (JSONB for flexibility)
  recipe_nutrients JSONB,
  recipe_weight_per_serving JSONB, -- { "amount": 250, "unit": "g" }

  -- Tracking
  last_used TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  category TEXT DEFAULT 'general',

  -- Timestamps
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, recipe_id)
);

-- Indexes for performance
CREATE INDEX idx_recipe_favorites_user_id ON user_recipe_favorites(user_id);
CREATE INDEX idx_recipe_favorites_added_at ON user_recipe_favorites(user_id, added_at DESC);
CREATE INDEX idx_recipe_favorites_category ON user_recipe_favorites(user_id, category);
CREATE INDEX idx_recipe_favorites_diets ON user_recipe_favorites USING GIN(recipe_diets);

-- RLS Policies
ALTER TABLE user_recipe_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipe favorites"
  ON user_recipe_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recipe favorites"
  ON user_recipe_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipe favorites"
  ON user_recipe_favorites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipe favorites"
  ON user_recipe_favorites FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 2. Recent Recipes Table

### Table: `user_recent_recipes`

Tracks recently viewed recipes for quick access in search tabs.

```sql
CREATE TABLE user_recent_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id TEXT NOT NULL,

  -- Basic Info (lightweight cache for quick display)
  recipe_name TEXT NOT NULL,
  recipe_image TEXT,
  recipe_source TEXT NOT NULL DEFAULT 'spoonacular',
  recipe_source_id TEXT,

  -- Timing
  recipe_servings INTEGER NOT NULL,
  recipe_ready_minutes INTEGER,

  -- Dietary Tags
  recipe_diets TEXT[],
  recipe_dish_types TEXT[],
  recipe_cuisines TEXT[],

  -- Preview Content
  recipe_summary TEXT,

  -- Nutrition (stored for offline access)
  recipe_nutrients JSONB,
  recipe_weight_per_serving JSONB,

  -- Tracking
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  UNIQUE(user_id, recipe_id)
);

-- Indexes
CREATE INDEX idx_recent_recipes_user_id ON user_recent_recipes(user_id);
CREATE INDEX idx_recent_recipes_last_used ON user_recent_recipes(user_id, last_used DESC);
CREATE INDEX idx_recent_recipes_usage_count ON user_recent_recipes(user_id, usage_count DESC);

-- RLS Policies
ALTER TABLE user_recent_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recent recipes"
  ON user_recent_recipes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recent recipes"
  ON user_recent_recipes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recent recipes"
  ON user_recent_recipes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recent recipes"
  ON user_recent_recipes FOR DELETE
  USING (auth.uid() = user_id);
```

---

## 3. Update Existing `intake_log` Table

### Add Recipe Support to Log Entries

```sql
ALTER TABLE intake_log
  ADD COLUMN IF NOT EXISTS item_type TEXT CHECK (item_type IN ('food', 'recipe')),
  ADD COLUMN IF NOT EXISTS name TEXT; -- For display purposes (food name or recipe name)

-- Optional: Add index for recipe filtering
CREATE INDEX IF NOT EXISTS idx_intake_log_item_type ON intake_log(user_id, item_type);
-- Skip creating idx_intake_log_recipe_id - already exists in migration 003

-- Update existing rows to default to 'food'
UPDATE intake_log SET item_type = 'food' WHERE item_type IS NULL;
```

**Note:** The `intake_log` table already has `recipe_id` column, so recipe logging is partially supported. We're just adding `item_type` and `name` for better querying and display.

---

## 4. Data Store Methods Required

The following methods need to be added to `dataStore` (or implemented via Supabase client):

### Recent Recipes
```typescript
// app/state/dataStore.ts additions needed:
getRecentRecipes(userId: string): Promise<RecentRecipeEntry[]>
saveRecentRecipes(userId: string, entries: RecentRecipeEntry[]): Promise<void>
clearRecentRecipes(userId: string): Promise<void>
```

### Favorite Recipes
```typescript
// Already implemented via Supabase in favoritesService
// No dataStore changes needed - uses direct Supabase calls
```

---

## 5. Migration Steps

### Step 1: Create Tables
Run the SQL scripts above in order:
1. Create `user_recipe_favorites`
2. Create `user_recent_recipes`
3. Alter `meal_log` table

### Step 2: Verify RLS Policies
Ensure all tables have proper Row Level Security enabled and policies are working.

### Step 3: Test Data Access
```sql
-- Test favorites
INSERT INTO user_recipe_favorites (user_id, recipe_id, recipe_name, recipe_servings)
VALUES (auth.uid(), 'test_recipe_1', 'Test Recipe', 4);

SELECT * FROM user_recipe_favorites WHERE user_id = auth.uid();

-- Test recent recipes
INSERT INTO user_recent_recipes (user_id, recipe_id, recipe_name, recipe_servings)
VALUES (auth.uid(), 'test_recipe_2', 'Recent Test Recipe', 2);

SELECT * FROM user_recent_recipes WHERE user_id = auth.uid();
```

---

## 6. Optional: Recipe Cache Table (Future Enhancement)

For offline-first recipe access, consider caching full recipe details locally:

```sql
CREATE TABLE cached_recipes (
  recipe_id TEXT PRIMARY KEY,
  recipe_data JSONB NOT NULL, -- Full RecipeDetail from Spoonacular
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX idx_cached_recipes_expires ON cached_recipes(expires_at);
```

This would allow the app to:
- Load recipe details without API calls
- Work offline with previously viewed recipes
- Reduce Spoonacular API usage costs

---

## 7. Cleanup/Maintenance

### Auto-cleanup Old Recent Entries
```sql
-- Function to cleanup old recent recipes (keep last 20)
CREATE OR REPLACE FUNCTION cleanup_old_recent_recipes()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM user_recent_recipes
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id FROM user_recent_recipes
    WHERE user_id = NEW.user_id
    ORDER BY last_used DESC
    LIMIT 20
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_recent_recipes
AFTER INSERT OR UPDATE ON user_recent_recipes
FOR EACH ROW
EXECUTE FUNCTION cleanup_old_recent_recipes();
```

---

## Summary of Changes

| Table | Action | Purpose |
|-------|--------|---------|
| `user_recipe_favorites` | CREATE | Store favorited recipes with full metadata |
| `user_recent_recipes` | CREATE | Track recently viewed recipes for quick access |
| `meal_log` | ALTER | Add `item_type` and `name` columns for recipe logging |
| Indexes | CREATE | Performance optimization for queries |
| RLS Policies | CREATE | Secure user data access |

**Total New Tables:** 2
**Total Altered Tables:** 1
**Estimated Migration Time:** 5-10 minutes

---

## Next Steps

1. Review and approve schema
2. Run migrations in staging environment
3. Test all CRUD operations
4. Update `dataStore` with recipe methods
5. Deploy to production
