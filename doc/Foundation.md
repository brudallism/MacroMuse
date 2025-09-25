# MealMaster — Foundation for a Clean Rebuild

## Vision & Non-Goals
**Vision:** Ship a stable, manual-first nutrition tracker that’s dead-simple to reason about, with a clean domain layer that future AI can “press buttons” against.

**Non-Goals (for V1):**
- No AI/chat logic in core. AI comes later as an **orchestrator** calling the same domain facades.
- No over-polish. UI is functional, consistent, and cohesive.
- No multi-agent “systems,” no experimental error frameworks, no sprawling state.

---

## Core Architectural Tenets (what we optimize for)
1. **Single source of truth:** The codebase & schema determine reality (not specs, not mocks).
2. **Vertical slices:** Build features end-to-end (data → domain → facade → UI). Ship small, integrate fully.
3. **Pure domain core:** Deterministic TypeScript services with a **canonical nutrient model**.
4. **Stable interfaces, replaceable implementations:** Abstract things once, keep the abstractions boring.
5. **Unidirectional data flow:** UI → Facade → Domain → Repo/Adapters → State → UI.
6. **Minimal state:** Three stores max (App/Data/UI). **Zero cross-store imports.**
7. **Evented integration:** Cross-feature communication via events, not store-to-store calls.
8. **Make illegal states impossible:** Encode business rules in types.
9. **Performance budgets as tests:** Measure and enforce p95s.
10. **Observability day-one:** Sentry + structured logs for core events.

---

## Domain Model (canonical types)
```ts
// domain/models.ts
export type NutrientVector = {
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  sodium_mg?: number
  potassium_mg?: number
  calcium_mg?: number
  iron_mg?: number
}

export type TargetVector = Required<Pick<NutrientVector,
  'calories'|'protein_g'|'carbs_g'|'fat_g'
>> & { fiber_g?: number }

export type LogEntry = {
  id?: string
  userId: string
  loggedAt: string // ISO
  source: 'usda'|'spoonacular'|'barcode'|'custom'
  sourceId?: string
  qty: number
  unit: string
  nutrients: NutrientVector
  mealLabel?: 'breakfast'|'lunch'|'dinner'|'snack'
  recipeId?: string
}

export type Insight = {
  id: string
  dateRange: { start: string; end: string }
  key: string // e.g. "iron_low_streak"
  severity: 'info'|'warn'|'high'
  message: string
  details?: Record<string, unknown>
}
```

---

## Layered Architecture & Folder Layout
```
app/
  app/          # UI-facing facades/controllers (call domain)
  ui/           # RN screens/components (presentational)
  domain/       # pure TS services & models (no IO)
  infra/        # adapters/clients (USDA, Spoonacular, Barcode, Supabase)
  data/         # schema/migrations/sql or drizzle
  state/        # zustand: appStore, dataStore, uiStore
  lib/          # eventBus, logger, featureFlags, utils
  tests/        # unit/integration/e2e + fixtures
```

**Rules**
- UI never imports repositories/adapters—only **facades** in `app/`.
- Domain never imports React/Supabase—pure logic only.
- Adapters **normalize** into `NutrientVector` at the edge.
- **No file > ~400 LOC** (split aggressively).

---

## State Management (extensible, not explosive)
- `appStore`: auth + profile + preferences (diet, allergies, units).
- `dataStore`: entities & caches (foods, logs, recipes, plans, analytics snapshots).
- `uiStore`: ephemeral UI (modals, spinners, search query, toasts).

**Absolutely no store-to-store imports.** Cross-feature reactions use the event bus.

---

## Event Bus & Feature Flags
```ts
// lib/eventBus.ts - Complete event schema for cross-store communication
type EventMap = {
  // User & Auth
  'user_authenticated': { userId: string; profile: UserProfile }
  'profile_updated': { userId: string; changes: Partial<UserProfile> }
  'preferences_changed': { userId: string; key: string; value: any }

  // Goals & Targets
  'macro_targets_calculated': { userId: string; targets: TargetVector; date: string }
  'micro_targets_updated': { userId: string; targets: MicronutrientRow[]; date: string }
  'goal_type_changed': { userId: string; goalType: Goal; effectiveDate: string }

  // Meal Tracking
  'meal_logged': { userId: string; entry: LogEntry }
  'meal_updated': { userId: string; entryId: string; changes: Partial<LogEntry> }
  'meal_deleted': { userId: string; entryId: string }
  'daily_totals_computed': { userId: string; date: string; totals: NutrientVector }

  // Food Search & Recognition
  'food_search_completed': { query: string; results: FoodSearchResult[]; source: string }
  'food_recognized': { input: string; confidence: number; result: RecognizedFood }
  'food_data_cached': { foodId: string; source: string; nutrients: NutrientVector }

  // Analytics & Insights
  'analytics_rollup_completed': { userId: string; period: 'daily' | 'weekly' | 'monthly'; date: string }
  'insights_generated': { userId: string; insights: Insight[] }
  'trend_analysis_updated': { userId: string; trends: TrendData }

  // System Events
  'performance_budget_exceeded': { operation: string; actualMs: number; budgetMs: number }
  'error_boundary_triggered': { error: string; componentStack: string; userId?: string }

  // Legacy events
  'goal_updated': { date: string }
  'plan_applied': { planId: string }
}
export const eventBus = createTypedEventBus<EventMap>()

// lib/featureFlags.ts
export const FEATURES = {
  BARCODE: { enabled: true },
  ADVANCED_ANALYTICS: { enabled: true },
  AI_ASSISTANT: { enabled: false } // post-V1
} as const
```

---

## Domain Services (stable contracts)
```ts
// domain/services/targets.ts
export interface TargetsService {
  get(dateISO: string): Promise<TargetVector> // precedence: menstrual > weekly > base
}

// domain/services/ledger.ts
export interface LedgerService {
  add(entry: LogEntry): Promise<void>        // idempotent
  remove(id: string): Promise<void>
}

// domain/services/totals.ts
export interface TotalsService {
  getDaily(dateISO: string): Promise<NutrientVector & { pctOfTarget: Partial<Record<keyof TargetVector, number>> }>
}

// domain/services/analytics.ts
export interface AnalyticsService {
  rollup(range: {start: string; end: string}): Promise<void>
  trends(range: {start: string; end: string}, keys: (keyof NutrientVector)[]): Promise<Record<string, unknown>>
}

// domain/services/insights.ts
export interface InsightRuleEngine {
  evaluate(range: {start: string; end: string}): Promise<Insight[]>
}

// domain/services/suggestions.ts
export interface SuggestionService {
  remainingMacros(box: TargetVector, prefs: Record<string, unknown>): Promise<Array<{ optionId: string; score: number }>>
  gapFoods(nutrientKey: keyof NutrientVector, prefs: Record<string, unknown>): Promise<Array<{ optionId: string; score: number }>>
}

// domain/services/recipes.ts
export interface RecipeService {
  create(data: any): Promise<string>
  update(id: string, data: any): Promise<void>
  computeNutrients(recipeId: string): Promise<NutrientVector>
  scale(recipeId: string, servings: number): Promise<void>
}

// domain/services/plans.ts
export interface PlanService {
  createWeek(startISO: string): Promise<string>
  applyToLedger(weekId: string): Promise<void>
  shoppingList(weekId: string): Promise<Array<{ name: string; qty: number; unit: string }>>
}
```

---

## Adapters (normalization at the edge)
- `UsdaAdapter`, `SpoonacularAdapter`, `BarcodeAdapter` → each returns **NutrientVector**.
- `FoodDedupeService` → deterministic ID + **confidence scoring** (prefer USDA on exact matches).
- **No mocks** in production paths. Dev-only stubs hidden behind `NODE_ENV==='development'`.

---

## Persistence & Schema (Supabase)
Tables you’ll need early:
- `profiles`, `goals_base`, `goals_weekly_cycle`, `goals_menstrual`
- `intake_log` (normalized entries), `daily_totals` (rollup)
- `nutrient_daily` / `nutrient_weekly` / `nutrient_monthly`
- `recipes`, `recipe_ingredients`, `recipe_nutrients`
- `meal_plan`, `meal_plan_items`

**Jobs:**  
- `afterWriteRollup(date)` → update `daily_totals` idempotently.  
- Nightly `analyticsRollup` → daily/weekly/monthly tables.  
- Backfill script: safe to re-run.

---

## UI Principles (cohesion > clever)
- **Recipe Builder ≡ Recipe Display** components. Spoonacular import pre-fills the *same fields* the builder uses.
- Presentational components only: **zero** business logic.
- **One card style** for foods/recipes across search, planner, and logging.
- Dark/light theming via tokens; **no inline hex soup**.

---

## Error Handling & Resilience (boring on purpose)
- One error boundary.
- One error util: logs to Sentry, returns **friendly message**.
- Retries & debouncing only where warranted (search, network flake). No “orchestrators” or circuit-breaker frameworks.

---

## Performance Budgets (enforced)
```
cold start p95  < 2000 ms
search p95      < 800 ms
log flow p95    < 1200 ms
```
- Add test timers & analytics events for overages.
- Virtualize long lists; debounce search; precompute recipe nutrients; cache today's targets.

### Performance Implementation Strategy
```ts
// Automated performance tracking
const PERFORMANCE_BUDGETS = {
  search: 800,
  logFlow: 1200,
  coldStart: 2000
} as const

// Track and enforce budgets
const trackOperation = async (operation: keyof typeof PERFORMANCE_BUDGETS, fn: () => Promise<any>) => {
  const startTime = performance.now()
  const result = await fn()
  const elapsed = performance.now() - startTime

  if (elapsed > PERFORMANCE_BUDGETS[operation]) {
    eventBus.emit('performance_budget_exceeded', {
      operation,
      actualMs: elapsed,
      budgetMs: PERFORMANCE_BUDGETS[operation]
    })
  }

  return result
}

// Debounced search with deduplication
const debouncedSearch = useDebouncedCallback(
  async (query: string) => trackOperation('search', () => searchService.search(query)),
  300
)

// Optimistic UI updates
const logFood = async (entry: LogEntry) => {
  // Immediate UI update
  dataStore.optimisticallyAddEntry(entry)

  // Background processing within budget
  await trackOperation('logFlow', async () => {
    await Promise.all([
      ledgerService.add(entry),
      totalsService.recompute(entry.date),
      analyticsService.incrementalUpdate(entry)
    ])
  })
}
```

---

## Observability
- Sentry initialized with release/env & source maps.
- Structured logs for: `meal_logged`, `goal_updated`, `plan_applied`, `analytics_rollup`.
- Minimal metrics: operation timers (search, log, rollup), counts per day.

---

## Security & Privacy
- Consent modal; link to policy.
- PII minimization: food logs aren’t PII. Don’t log health details in Sentry.
- Secrets via env; never commit.

---

## Testing Strategy (fixtures first)
- **Unit (domain):** golden 7-day fixtures (macros & top micros). Assert totals, precedence (menstrual > weekly > base).
- **Integration:** adapters normalize → ledger writes → totals rollup.
- **E2E (Detox/Maestro):** "scan barcode → confirm → log → dashboard rings update."
- **Performance tests:** assert budgets.
- Coverage target: **80%+ domain & adapters**.

### Test Patterns for Vertical Slices:
```typescript
// Integration test pattern - full vertical slice
describe('Meal Logging Flow', () => {
  it('should complete full flow within budget', async () => {
    const startTime = performance.now()

    // Full integration: Search → Log → Calculate → Display
    const searchResults = await searchService.search('apple')
    const loggedMeal = await ledgerService.add(searchResults[0])
    const updatedTotals = await totalsService.getDaily(today)

    const elapsed = performance.now() - startTime
    expect(elapsed).toBeLessThan(1200)
    expect(updatedTotals.calories).toBeGreaterThan(0)
  })
})

// Performance budget enforcement in tests
describe('Performance Budgets', () => {
  it('should search within budget', async () => {
    const startTime = performance.now()
    await searchService.search('chicken breast')
    const elapsed = performance.now() - startTime

    expect(elapsed).toBeLessThan(800)
  })
})
```

### Mock Strategy (dev/testing only):
```typescript
// Only in development/testing environments
const createDevServices = (): Services => {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    throw new Error('Dev services only for development/testing')
  }

  return {
    searchService: new MockSearchService(),
    ledgerService: new InMemoryLedgerService(),
    // ... other mock implementations
  }
}
```

---

## Migration & Delivery (strangler-fig)
- New app (clean folder). Extract: macro/micro engines, transformers, theme, atoms/molecules, nav skeleton.
- Prohibit importing legacy from new via ESLint `no-restricted-imports`.
- Reuse Supabase tables where sane; otherwise create v2 tables + write idempotent backfill.
- Ship by **vertical slices** (below). Delete legacy slice-by-slice once parity is reached.

### Legacy Code Extraction Strategy

#### Safe Extraction Order (Dependencies First):
1. **Pure Calculation Engines** (✅ Ready to extract)
   - `src/services/macros/engine.ts` → `domain/services/macros.ts`
   - `src/services/micros/engine.ts` → `domain/services/micros.ts`

2. **Theme & Design System** (✅ Ready to extract)
   - `src/utils/theme.ts` → `ui/theme/`
   - `src/components/atoms/` → `ui/atoms/`

3. **Entangled Components** (⚠️ Requires surgery before extraction)
   - `user-store.ts` → Split into `appStore` + `TargetsService`
   - `meal-store.ts` → Split into `dataStore` + `LedgerService`
   - `ai-store.ts` → Delete entirely, replace with facades

#### Extraction Rules:
- ✅ **Pure functions**: Extract directly to domain layer
- ⚠️ **Functions with side effects**: Wrap in service interface first
- 🚫 **Multi-concern components**: Split responsibilities before extraction
- 📝 **Document extraction decisions**: Track what was changed and why

---

## Vertical Slices (fastest path to parity)
1. **Daily Ledger & Targets** → settings writes profile/goals; dashboard rings are correct.
2. **Food Search & Logging (manual-first)** → adapters normalize; barcode confirm; 1-tap log.
3. **Goal Cycling & Menstrual** → precedence wired; dates flip targets.
4. **Analytics Rollups** → daily/weekly/monthly; InsightRuleEngine emits top 3 spotlights.
5. **Suggestions** → remaining-macros & gap-foods, scored; 3–6 options; 1-tap log.
6. **Recipe Builder (display parity)** → import or manual uses same components; precompute per-serving.
7. **Meal Planning** → create/apply week; shopping list; plans use same food/recipe cards.

*Coach dashboard and AI assistant come after this core loop is solid.*

---

## Definition of Done (for any feature)
- Data model & migrations merged.
- Domain service contracts stable; **unit tests** landed.
- Facade wired; **integration test** green.
- UI functional + empty/error/loading states.
- Sentry fingerprints added; logs/metrics in place.
- Perf check against budgets.
- Docs: 10-line README section (what it does, where it lives, how to test).

---

## PR Checklist (paste into every PR)
- [ ] Files < 400 LOC (or justified).
- [ ] No cross-store imports; UI only calls facades.
- [ ] Domain is pure TS; no IO.
- [ ] Adapters normalize to `NutrientVector`.
- [ ] Unit & integration tests included.
- [ ] Performance budget assertions.
- [ ] Sentry/Logs wired for new domain events.
- [ ] README updated (feature docs / commands / env).

---

## Best Practices (do these)
- Prefer **interfaces** + factories over deep class trees.
- Keep **naming boring and explicit** (no clever abbrevs).
- Use **union types** for UI states; avoid booleans soup.
- Make **idempotency** a default (ledger writes, rollups).
- Cache **today’s targets**; invalidate on goal/profile change.
- Keep **feature flags** in code, not hidden magic.

---

## Common Mistakes (avoid)
- Mixing UI with business logic.
- Store calling another store (circular & implicit deps).
- Multiple competing “systems” (AI, error handling, “manager” classes).
- Commented legacy code & mock fallbacks in production paths.
- Re-normalizing nutrients in multiple places (edge-normalize once).

---

## **AT ALL COSTS, DO NOT**
- Re-introduce 7+ Zustand stores or any store-to-store calls.
- Add “temporary” mocks into production flows.
- Build new AI orchestration inside core layers.
- Create new files > 400 LOC or functions with cyclomatic complexity > 10.
- Swallow errors or return defaults silently.
- Duplicate nutrient models—**there is only one `NutrientVector`.**

---

## Automated Architecture Enforcement

### ESLint Rules (Build Fails on Violation):
```typescript
// .eslintrc.js
module.exports = {
  rules: {
    // Prevent cross-store imports
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['../stores/*'], message: 'Use eventBus for cross-store communication' },
        { group: ['**/domain/**'], message: 'UI cannot import domain directly - use facades' }
      ]
    }],

    // File size limits
    'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],

    // Function complexity limits
    'complexity': ['error', { max: 10 }]
  }
}
```

### Pre-commit Hooks:
```bash
#!/bin/sh
# Fail on architectural violations
npm run lint || exit 1
npm run type-check || exit 1
npm run test:unit || exit 1

# Check for forbidden patterns
if grep -r "store.*import.*store" src/; then
  echo "❌ Cross-store imports detected"
  exit 1
fi
```

### Architectural Decision Trees

#### "Where Should This Logic Go?"
```
New logic needed →
  ├─ Is it UI state? → uiStore
  ├─ Is it user profile/auth? → appStore
  ├─ Is it domain data? → dataStore
  └─ Is it business logic? → Domain service (not store!)
```

#### "Should I Add to Existing File or Create New One?"
```
Adding code →
  ├─ File > 300 lines? → Create new file
  ├─ Different responsibility? → Create new file
  ├─ Would require new imports? → Create new file
  └─ Otherwise → Add to existing (but set calendar reminder to split at 400 LOC)
```

#### "Temporary Solution Needed?"
```
Need quick fix →
  ├─ Create GitHub issue with "tech-debt" label
  ├─ Add TODO comment with issue number
  ├─ Set calendar reminder for 2 weeks
  └─ Add to "Known Technical Debt" section in README
```

### Mandatory Refactoring Triggers

#### File Complexity Signals:
- **200 lines**: Review for split opportunities
- **300 lines**: Create calendar reminder to split within 2 weeks
- **400 lines**: STOP - Split before adding more code
- **More than 5 imports from other business logic files**: Extract shared logic

#### Component Responsibility Signals:
- **Store handling 3+ distinct concerns**: Split into separate stores
- **Service with 5+ public methods**: Consider if it's really multiple services
- **Function with 3+ distinct steps**: Extract helper functions

#### Code Health Signals:
- **TODO comments older than 1 month**: Address or convert to issues
- **Any file modified by 3+ people in 1 week**: Review for clarity/ownership
- **Test file longer than the code it tests**: Simplify either tests or code

---

## First 3 PRs (to kickstart momentum)
1. **Foundation & Guardrails**
   - TS `strict`, ESLint/Prettier/Husky, CI on tests/lint.
   - `domain/models.ts`, eventBus, featureFlags, logger.
   - Theme + atoms/molecules imported; nav scaffold.

2. **Ledger + Targets Vertical**
   - Tables & repo; `TargetsService`, `LedgerService`, `TotalsService`.
   - Unit tests (precedence, conversions); integration (add log → totals).
   - Settings writes → Dashboard rings update.

3. **Search & Logging Vertical**
   - USDA/Spoonacular/Barcode adapters normalize to `NutrientVector`.
   - `LoggingFacade.logFood` → ledger/totals tests.
   - Search & barcode confirm UI (functional, not fancy).

---

## Feature Checklist Template (use for each slice)
- **Data Model:** tables, indexes, FKs, migrations.
- **Domain:** interfaces, pure functions, unit tests.
- **Adapters/Repos:** normalization, retries, caching.
- **Facade/State:** app facade API, data/ui store updates.
- **UI:** components/screens, empty/error/loading states.
- **Events:** emitted & handled (eventBus).
- **Perf:** p95 assertions.
- **Obs:** Sentry fingerprints, structured logs, timers.
- **Docs:** short README section.
- **DoD:** test plan & fixtures listed above.

---

## Closing Notes
- **Recipe Builder parity** with display is a **hard rule**—one UX, two input modes.
- **AI assistant is an automation layer** that calls your facades; it **adds zero new business logic**.
- Keep it **boring and repeatable**. Vertical slice after vertical slice; no mega-refactors.
