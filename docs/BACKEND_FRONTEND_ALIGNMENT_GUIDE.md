# Backend-Frontend Alignment Guide for First-Time Developers

This guide helps prevent the most common mistakes that occur when connecting backend systems to frontend interfaces, specifically tailored for MacroMuse's architecture.

---

## Critical Alignment Concepts

### Understanding the Data Flow Chain

```
Database → Repository → Facade → Store → UI Component
     ↓         ↓         ↓       ↓         ↓
  Raw Data → Domain → Business → State → Props
```

**Each layer must perfectly align with the next, or the entire chain breaks.**

---

## Most Common Mistakes (90% of First-Time Developer Issues)

### 1. Data Shape Mismatches 🔥 CRITICAL

#### The Problem
Backend returns different field names than frontend expects.

#### Example of the Bug
```typescript
// Backend (Supabase) returns:
{
  "calories": 250,
  "protein_g": 30,
  "carbs_g": 15,
  "fat_g": 10
}

// Frontend component expects:
interface FoodData {
  calories: number
  protein: number  // ❌ Wrong! Should be protein_g
  carbs: number    // ❌ Wrong! Should be carbs_g
  fat: number      // ❌ Wrong! Should be fat_g
}
```

#### How to Prevent This
```typescript
// ✅ ALWAYS use NutrientVector as single source of truth
import { NutrientVector } from '@domain/models'

// Database schema MUST match domain model exactly
CREATE TABLE food_entries (
  nutrients JSONB -- This JSONB must follow NutrientVector structure
);

// Repository returns domain types
async getFoodNutrition(id: string): Promise<NutrientVector> {
  const { data } = await supabase
    .from('food_entries')
    .select('nutrients')
    .eq('id', id)

  return data.nutrients as NutrientVector // Type assertion matches reality
}

// UI component uses exact domain types
interface FoodCardProps {
  nutrition: NutrientVector // Exact same type as domain
}
```

### 2. Async/Loading State Problems 🔥 CRITICAL

#### The Problem
UI shows old/stale data while new data is loading, confusing users.

#### Example of the Bug
```typescript
// ❌ BAD - Shows stale data during loading
const Dashboard = () => {
  const [todaysTotals, setTodaysTotals] = useState({
    calories: 1500, // Old data from yesterday!
    protein_g: 80
  })

  useEffect(() => {
    // New data loads but user sees old data first
    fetchTodaysTotals().then(setTodaysTotals)
  }, [])

  return <MacroRings data={todaysTotals} /> // Shows wrong data initially
}
```

#### How to Fix This
```typescript
// ✅ GOOD - Proper loading states
const Dashboard = () => {
  const [todaysTotals, setTodaysTotals] = useState<NutrientVector | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)

    fetchTodaysTotals()
      .then(setTodaysTotals)
      .catch(err => setError(getErrorMessage(err)))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />
  if (!todaysTotals) return <EmptyDashboard />

  return <MacroRings data={todaysTotals} />
}
```

### 3. Event Bus Timing Race Conditions 🔥 CRITICAL

#### The Problem
Manually updating UI state while also using event bus creates inconsistent data.

#### Example of the Bug
```typescript
// ❌ BAD - Race condition between manual update and event
const logFood = async (food: FoodEntry) => {
  // Manual UI update
  setFoodLog(prev => [...prev, food])

  // Event bus update (might happen at different time)
  eventBus.emit('meal_logged', food)

  // Now UI and store might be out of sync!
}
```

#### How to Fix This
```typescript
// ✅ GOOD - Let event bus handle ALL updates
const logFood = async (food: FoodEntry) => {
  // Only emit event - no manual UI updates
  eventBus.emit('meal_logged', food)

  // Store reacts to event and updates state
  // UI automatically re-renders with new store state
}

// Store handler
eventBus.on('meal_logged', (food) => {
  dataStore.addFoodEntry(food)
  // UI components subscribed to dataStore automatically update
})
```

### 4. Database-TypeScript Type Mismatches 🔥 CRITICAL

#### The Problem
Database column types don't match TypeScript interface types.

#### Example of the Bug
```sql
-- Database schema
CREATE TABLE recipes (
  nutrition_data TEXT  -- ❌ Stored as TEXT but used as object
);
```

```typescript
// TypeScript interface
interface Recipe {
  nutritionData: NutrientVector // ❌ Expects object but gets string
}
```

#### How to Fix This
```sql
-- ✅ Database schema matches TypeScript
CREATE TABLE recipes (
  nutrition_data JSONB NOT NULL -- JSONB for complex objects
);
```

```typescript
// ✅ Repository handles conversion properly
async getRecipe(id: string): Promise<Recipe> {
  const { data } = await supabase
    .from('recipes')
    .select('nutrition_data')
    .eq('id', id)
    .single()

  return {
    nutritionData: data.nutrition_data as NutrientVector
  }
}
```

### 5. Performance Testing with Fake Data 🔥 CRITICAL

#### The Problem
Testing with 2-3 food items when production will have 1000+ items.

#### Example of the Bug
```typescript
// ❌ BAD - Performance looks great with minimal data
const testFoods = [
  { name: 'Apple', calories: 80 },
  { name: 'Banana', calories: 90 }
] // Only 2 items - performance seems perfect!
```

#### How to Fix This
```typescript
// ✅ GOOD - Test with realistic data volumes
const generateTestData = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `food-${i}`,
    name: `Test Food ${i}`,
    nutrients: {
      calories: Math.random() * 500,
      protein_g: Math.random() * 30,
      // ... full NutrientVector
    }
  }))
}

// Test with production-like data
const testFoods = generateTestData(1000) // Realistic volume
```

---

## Pre-Development Checklist

### Before You Write Any Code
- [ ] **Read NutrientVector definition** - Know the exact field names
- [ ] **Check existing database schema** - Look for similar patterns
- [ ] **Identify which store handles this data** - app/data/ui decision
- [ ] **Plan event emissions** - What events need to be sent/received
- [ ] **Define performance budget** - How fast should this operation be

### Before You Test Your Code
- [ ] **Test with realistic data volume** - 100+ items minimum
- [ ] **Test offline scenarios** - Turn off network and verify behavior
- [ ] **Test loading states** - Slow down network and check UI
- [ ] **Test error scenarios** - Invalid data, network failures
- [ ] **Test cross-session persistence** - Restart app and verify data

### Before You Consider Feature Complete
- [ ] **Full user journey works** - End-to-end without issues
- [ ] **Data persists correctly** - Survives app restarts
- [ ] **Performance meets budget** - Under realistic load
- [ ] **Error messages are friendly** - No technical jargon for users
- [ ] **Analytics track correctly** - Insights update properly

---

## Debugging Protocol

### When Something Doesn't Work

#### Step 1: Trace the Data Flow
```typescript
// Add console.log at each layer to trace data transformation
console.log('1. Database raw:', databaseResult)
console.log('2. Repository processed:', repositoryResult)
console.log('3. Facade output:', facadeResult)
console.log('4. Store state:', storeState)
console.log('5. Component props:', props)
```

#### Step 2: Verify Type Alignment
```typescript
// Check that types match at boundaries
const checkTypes = (data: unknown) => {
  console.log('Type:', typeof data)
  console.log('Shape:', Object.keys(data))
  console.log('Sample values:', data)
}
```

#### Step 3: Test Event Flow
```typescript
// Verify events are emitted and received
eventBus.on('meal_logged', (data) => {
  console.log('Event received:', data)
})

eventBus.emit('meal_logged', testData)
// Should see console.log output if working
```

#### Step 4: Check Performance
```typescript
const startTime = performance.now()
await operation()
const elapsed = performance.now() - startTime
console.log(`Operation took ${elapsed}ms`)

if (elapsed > PERFORMANCE_BUDGETS.operation) {
  console.warn('Performance budget exceeded!')
}
```

---

## Architecture Decision Checklist

### When Adding New Features

#### Data Storage Decision
```
Is this data about WHO the user is?
  ├─ YES → appStore (profile, preferences, auth)
  └─ NO → Continue...

Is this data about WHAT exists in the system?
  ├─ YES → dataStore (foods, recipes, logs)
  └─ NO → Continue...

Is this data about HOW the UI looks right now?
  ├─ YES → uiStore (modals, loading, search query)
  └─ ERROR → No other stores allowed!
```

#### Event Design Decision
```
Does this action affect other features?
  ├─ YES → Emit event via eventBus
  └─ NO → Direct store action is OK

Is this a cross-cutting concern?
  ├─ YES → Emit event (analytics, caching, etc.)
  └─ NO → Direct store action is OK
```

#### Performance Decision
```
Will this operation be used frequently?
  ├─ YES → Add to performance budget testing
  └─ NO → Monitor but no strict budget

Does this query large amounts of data?
  ├─ YES → Add caching strategy
  └─ NO → Direct query is OK

Could this block the UI?
  ├─ YES → Use background processing
  └─ NO → Synchronous is OK
```

---

## Common Error Messages and Solutions

### "Cannot read property 'X' of undefined"
**Cause:** Data shape mismatch or async timing issue
**Solution:** Add null checks and proper loading states

### "Performance budget exceeded"
**Cause:** Operation taking longer than expected
**Solution:** Add caching, optimize query, or increase budget if justified

### "Event not received"
**Cause:** Event bus wiring issue or timing problem
**Solution:** Verify event names match exactly, check listener setup

### "Type 'X' is not assignable to type 'Y'"
**Cause:** TypeScript type mismatch
**Solution:** Align database schema with domain models

### "Network request failed"
**Cause:** API connectivity issue
**Solution:** Add offline handling and retry logic

---

## Emergency Recovery Steps

### If You Break Something

1. **Identify the Layer**
   - Database issue? Check migrations and RLS policies
   - Repository issue? Check query syntax and type assertions
   - Facade issue? Check business logic and error handling
   - Store issue? Check event handlers and state updates
   - UI issue? Check component props and rendering logic

2. **Rollback Strategy**
   - Git: `git checkout -- filename` for single files
   - Database: Revert to previous migration
   - Features: Disable via feature flag

3. **Test Isolation**
   - Create minimal reproduction case
   - Test with single data item first
   - Gradually increase complexity

4. **Get Help**
   - Include exact error message
   - Provide steps to reproduce
   - Share relevant code snippets
   - Specify what you expected vs what happened

Remember: Most issues in full-stack development come from misalignment between layers. Focus on keeping your data contracts consistent and your types aligned, and you'll avoid 90% of common problems.