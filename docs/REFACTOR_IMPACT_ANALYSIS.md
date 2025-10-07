# Refactor Impact Analysis: Pattern 1 Architecture Migration

## Summary
We refactored 3 services from Pattern 2 (direct Supabase imports) to Pattern 1 (clean repository layer). This analysis identifies all code that needs updates to work with the new architecture.

---

## ✅ What Changed

### Services Refactored
1. **favoritesService** - Now requires `FavoritesRepository` injection
2. **customFoodsService** - Now requires `CustomFoodsRepository` injection
3. **recentFoodsService** - Now requires `RecipeRepository` injection

### New Architecture
- Services no longer import Supabase directly
- Services receive repository dependencies via constructor
- Services are initialized via `initialize*Service()` functions
- All initialization handled in `app/infra/initialization.ts`

---

## 🔴 Breaking Changes

### 1. Service Exports Changed

**Before (Pattern 2):**
```typescript
// Services were immediately exported as singletons
export const favoritesService = new FavoritesServiceImpl()
export const customFoodsService = new CustomFoodsServiceImpl()
export const recentFoodsService = new RecentFoodsServiceImpl()
```

**After (Pattern 1):**
```typescript
// Services are exported as uninitialized variables
export let favoritesService: FavoritesService
export let customFoodsService: CustomFoodsService
export let recentFoodsService: RecentFoodsService

// Must be initialized before use
export function initializeFavoritesService(repository: FavoritesRepository): void
export function initializeCustomFoodsService(repository: CustomFoodsRepository): void
export function initializeRecentFoodsService(repository: RecipeRepository): void
```

**Impact:** Any code using these services will get `undefined` errors if services aren't initialized first.

---

## 📋 Files That Need Updates

### CRITICAL - Must Update

#### 1. **App.tsx** ⚠️ REQUIRED
**Location:** `/Users/dallasthompson/MacroMuse/App.tsx`

**Issue:** App doesn't call `initializeApp()` on startup

**Current Code (lines 13-23):**
```typescript
useEffect(() => {
  // Initialize store event system on app startup
  initializeStoreEventSystem()
  logger.info('MacroMuse app started', {
    features: {
      analytics: FEATURES.ADVANCED_ANALYTICS.enabled,
      barcode: FEATURES.BARCODE_SCANNING.enabled,
      ai: FEATURES.AI_SUGGESTIONS.enabled
    }
  })
}, [])
```

**Required Fix:**
```typescript
import { initializeApp } from '@infra/initialization'

useEffect(() => {
  // CRITICAL: Initialize repositories and services BEFORE anything else
  initializeApp()

  // Initialize store event system on app startup
  initializeStoreEventSystem()
  logger.info('MacroMuse app started', {
    features: {
      analytics: FEATURES.ADVANCED_ANALYTICS.enabled,
      barcode: FEATURES.BARCODE_SCANNING.enabled,
      ai: FEATURES.AI_SUGGESTIONS.enabled
    }
  })
}, [])
```

---

#### 2. **advancedFoodFacade.ts** ✅ WORKS (with initialization)
**Location:** `/Users/dallasthompson/MacroMuse/app/facades/advancedFoodFacade.ts`

**Issue:** Imports services directly (lines 2-4)

**Current Code:**
```typescript
import { recentFoodsService } from '@domain/services/recentFoods'
import { favoritesService } from '@domain/services/favorites'
import { customFoodsService, CustomFoodData } from '@domain/services/customFoods'
```

**Status:** ✅ This will work AFTER App.tsx calls `initializeApp()`

**Why it works:**
- The facade imports the service variables
- Once `initializeApp()` runs, these variables are populated
- No code changes needed here

**Action:** No changes required (depends on App.tsx fix)

---

#### 3. **advancedFoodFeatures.test.ts** ⚠️ NEEDS MOCKING
**Location:** `/Users/dallasthompson/MacroMuse/app/tests/integration/advancedFoodFeatures.test.ts`

**Issue:** Tests mock `@state/dataStore` but services now need repository mocks

**Current Mocks (lines 12-15):**
```typescript
jest.mock('@state/dataStore')
jest.mock('@infra/database/supabase')
jest.mock('@facades/searchFacade')
jest.mock('@facades/barcodeFacade')
```

**Required Fix:**
```typescript
// Add repository mocks
jest.mock('@infra/repositories/FavoritesRepository')
jest.mock('@infra/repositories/CustomFoodsRepository')
jest.mock('@infra/repositories/RecipeRepository')

// In beforeEach, initialize services with mocked repositories
beforeEach(() => {
  jest.clearAllMocks()

  // Initialize services with mocked repositories
  const mockFavoritesRepo = new FavoritesRepositoryImpl(mockSupabase as any)
  const mockCustomFoodsRepo = new CustomFoodsRepositoryImpl(mockSupabase as any)
  const mockRecipeRepo = new RecipeRepositoryImpl(mockSupabase as any)

  initializeFavoritesService(mockFavoritesRepo)
  initializeCustomFoodsService(mockCustomFoodsRepo)
  initializeRecentFoodsService(mockRecipeRepo)

  // ... rest of setup
})
```

---

### SAFE - No Updates Needed

#### Services Still Using Pattern 2 (unchanged)
These services still use the old singleton pattern and will continue working:

1. **portionCalculatorService** - Pure logic, no database
   ```typescript
   export const portionCalculatorService = new PortionCalculatorServiceImpl()
   ```

2. **mealCategorizationService** - Pure logic, no database
   ```typescript
   export const mealCategorizationService = new MealCategorizationServiceImpl()
   ```

3. **barcodeService** - Pure logic, no database
   ```typescript
   export const barcodeService = new BarcodeServiceImpl()
   ```

**Action:** None - these don't need refactoring

---

## 🎯 Migration Checklist

### Step 1: Update App.tsx (REQUIRED)
- [ ] Import `initializeApp` from `@infra/initialization`
- [ ] Call `initializeApp()` as FIRST line in useEffect
- [ ] Test app launches without errors

### Step 2: Update Tests (RECOMMENDED)
- [ ] Update `advancedFoodFeatures.test.ts` with repository mocks
- [ ] Add service initialization in test setup
- [ ] Run tests to verify they pass

### Step 3: Verify Runtime Behavior
- [ ] Test recent foods functionality
- [ ] Test favorites functionality
- [ ] Test custom foods functionality
- [ ] Check console for any "undefined service" errors

---

## 🚨 Common Errors After Migration

### Error 1: "Cannot read properties of undefined (reading 'getFavorites')"
**Cause:** `favoritesService` is undefined
**Fix:** Ensure `initializeApp()` is called in App.tsx

### Error 2: "RecipeRepository not initialized"
**Cause:** `dataStore` methods called before initialization
**Fix:** Ensure `initializeApp()` runs before any service usage

### Error 3: Tests failing with "service is not a function"
**Cause:** Test mocks don't initialize services
**Fix:** Add service initialization in test `beforeEach()` blocks

---

## 📊 Architecture Comparison

### Before (Pattern 2)
```
Domain Service
    ↓
Directly imports Supabase
    ↓
Queries database
```
**Issues:**
- ❌ Domain layer depends on infrastructure
- ❌ Hard to test (must mock Supabase)
- ❌ Violates Foundation principles

### After (Pattern 1)
```
Domain Service
    ↓
Receives Repository (via constructor)
    ↓
Repository
    ↓
Uses Supabase
```
**Benefits:**
- ✅ Clean architecture
- ✅ Easy to test (mock repository)
- ✅ Follows Foundation principles
- ✅ Swappable database implementation

---

## 🔧 Maintenance Notes

### Adding New Features
When adding new database-backed features:

1. Create repository in `app/infra/repositories/`
2. Create service in `app/domain/services/`
3. Add initialization function to service
4. Wire up in `app/infra/initialization.ts`
5. Call from facades/UI as needed

### Testing New Services
Always initialize services in test setup:
```typescript
beforeEach(() => {
  const mockRepo = new YourRepositoryImpl(mockSupabase)
  initializeYourService(mockRepo)
})
```

---

## ✅ Success Criteria

Migration is complete when:
1. ✅ App.tsx calls `initializeApp()`
2. ✅ All services work in runtime
3. ✅ All tests pass with mocked repositories
4. ✅ No console errors about undefined services
5. ✅ Recipe tracking functionality works end-to-end

---

## 📞 Support

If you encounter issues:
1. Check if `initializeApp()` is called in App.tsx
2. Verify initialization order (repos → services → stores)
3. Check console for initialization logs
4. Use `isAppInitialized()` helper to debug

**Initialization Success Log:**
```
[Initialization] App successfully initialized with repositories and services
```
