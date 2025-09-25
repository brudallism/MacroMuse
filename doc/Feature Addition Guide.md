# Feature Addition Guide

This guide provides a repeatable process for adding new features to the build without breaking architectural discipline.  
It follows the **Pattern for Future Feature Additions** and is based on lessons learned from adding complex systems mid-build.

---

## Pattern for Future Feature Additions

**Timeboxes (default):**
1. Foundation Impact Assessment (30m)  
2. Domain Model Extension (15m with LLM)  
3. Integration Point Mapping (20m)  
4. Vertical Slice Planning (30m)  
5. Implementation Order: Data → Domain → Facades → State → UI  
6. Event Bus Wiring (15m)  
7. Testing Complete Flow (45m)  

---

## 1. Foundation Impact Assessment (30m)

**Checklist**
- 🔎 Read `docs/Foundation.md` (tenets, boundaries, layers).
- ✅ Tenet alignment:
  - Single source of truth (where does feature data live?)
  - Vertical slice friendly (can deliver end-to-end without refactors?)
  - Pure domain core (logic as pure functions, no IO)
  - Stable interfaces (extend, don’t replace)
  - Unidirectional flow (UI → Facade → Domain → Store → UI)
  - Minimal state (add to existing store)
  - Event-driven (emit domain/UI events)
  - Type safety (strict enums & unions)
  - Performance (budget + caching plan)
  - Observability (logs, metrics)

**Verdict:** PROCEED / HOLD (with reasons)

**Template — Impact Note**
```txt
Feature: <Name>
Decision: PROCEED
Why: aligns with <tenets>; no new stores; pure domain services; UI is incremental
Risks: <db migration>, <perf>, <UX>
Mitigations: migration tests, cache, progressive enhancement
```

---

## 2. Domain Model Extension (15m with LLM)

**Goal:** Add/extend types **without breaking existing**.

**Template — models.ts patch**
```ts
// ADD (don’t replace)
export type <FeatureType> = {
  /* strict unions, no stringly-typed values */
}

export type ExistingEntity = {
  /* existing fields... */
  <featureField>?: <FeatureType>
}
```

**LLM Prompt**
> “Extend domain models to support <feature>. Add `<FeatureType>` and extend `<ExistingEntity>` without breaking compatibility. Use strict union types. No business logic here.”

---

## 3. Integration Point Mapping (20m)

**Decision Tree:** Where does this feature touch?

```
DOMAIN
  ├─ New: <ServiceName> (pure)
  ├─ Extends: <ExistingService>
DATA
  ├─ New: <table_or_doc>
  └─ Extends: profiles/<existing>
FACADES
  ├─ Extends: <User/Search/SuggestionFacade>
STATE
  ├─ Extends: appStore (add field + actions)
  └─ Events: <feature>_changed, <feature>_validated
UI
  ├─ New: <FeatureScreen/Modal>
  └─ Extends: existing screens to show warnings/badges
```

**Impact Assessment**
- Low: pure domain service  
- Medium: schema changes & performance in search/recs  
- High: UI flow fit (ensure progressive enhancement)

---

## 4. Vertical Slice Planning (30m)

**MVP scope template**
```txt
Include: <X, Y core behaviors>
Exclude: <advanced analysis / batch jobs / rare edge UX>
MVP Goal: <1-line measurable outcome>
```

**Build Order**
1. Data (schema/migration/seed)  
2. Domain (pure functions)  
3. Facades (wrap domain for app use)  
4. State (store fields + actions + events)  
5. UI (minimal screens + indicators)

---

## 5. Implementation Templates

### A. Data (migration)
```sql
-- 00X_add_<feature>.sql
CREATE TABLE IF NOT EXISTS <feature_table> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  <columns> ...,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE <feature_table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own <feature>"
  ON <feature_table> FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_<feature>_user_id ON <feature_table>(user_id);
```

**LLM Prompt**
> “Create an idempotent Supabase migration for `<feature>`. Use RLS, FKs, and performance indexes. Safe to run multiple times.”

---

### B. Domain (pure services)
```ts
// domain/services/<feature>-service.ts
export interface <FeatureService> {
  evaluate(input: InputShape, config: Config): OutputShape
  validate?(entity: Entity): ValidationResult
}

export class <FeatureServiceImpl> implements <FeatureService> {
  evaluate(input: InputShape, config: Config): OutputShape {
    // pure logic only; no IO; fully testable
  }
}
```

**LLM Prompt**
> “Implement `<FeatureService>` with pure functions only. No IO or state mutations. Include unit tests for edge cases. Performance target <X ms> for N items.”

---

### C. Facades (extend, don’t break)
```ts
export interface ExistingFacade {
  // existing methods untouched
  // NEW:
  apply<Feature>(...args): Promise<ResultWith<FeatureAnnotations>>
}
```

**LLM Prompt**
> “Extend `<ExistingFacade>` to support `<feature>`. Do not break existing signatures. Reuse `<FeatureService>` for logic.”

---

### D. State (extend existing store)
```ts
interface AppState {
  // existing...
  <featureField>: <FeatureType> | null

  set<Feature>: (v: <FeatureType>) => Promise<void>
  get<Feature>: () => <FeatureType> | null
}

const appStore = create<AppState>((set, get) => ({
  <featureField>: null,
  set<Feature>: async (v) => {
    set({ <featureField>: v })
    await repository.update<Feature>(v)
    eventBus.emit('<feature>_changed', { userId: get().user?.id, value: v })
  }
}))
```

---

### E. UI (progressive enhancement)
```tsx
// Extend existing screen, don’t rewrite
const ExistingScreen = () => {
  const feature = useAppStore(s => s.<featureField>)
  const results = await facade.search(query)
  const final = feature ? featureService.evaluate(results, feature) : results
  return <ResultsList data={final} onItemPress={...} />
}
```

---

## 6. Event Bus Wiring (15m)

```ts
eventBus.on('<feature>_changed', async ({ userId, value }) => {
  await cache.invalidate(userId, '<affected_domain>')
  eventBus.emit('<affected_domain>_invalidated', { userId })
})
```

**Benefits:** loose coupling, testable reactions, perf isolation.

---

## 7. Testing Complete Flow (45m)

**Integration spec template**
```ts
describe('<Feature> Vertical Slice', () => {
  it('applies <feature> consistently across search → suggestions → UI', async () => {
    // arrange user + seed data
    // act through façade(s)
    // assert results filtered/annotated + UI indicators present
  })

  it('meets performance budget', async () => {
    const t0 = performance.now()
    await facade.runScenario(...)
    expect(performance.now() - t0).toBeLessThan(800)
  })
})
```

**Edge cases:** missing data, partial configs, toggle off/on, large result sets.

---

## Reusable Prompts (copy/paste)

**A) Foundation Check**
> “Following `docs/Foundation.md`, assess adding `<feature>`. Confirm single source of truth, vertical slice feasibility, pure domain logic, interface stability, unidirectional flow, minimal state, event-driven design, type safety, performance, and observability. Output PROCEED/HOLD with 3 bullets.”

**B) Domain Types**
> “Extend `domain/models.ts` for `<feature>`. Use strict unions, no string literals. Do not break existing types. Provide a patch.”

**C) Migration**
> “Create an idempotent Supabase migration for `<feature>` with FK to `profiles`, RLS policies, and performance index. Safe on reruns.”

**D) Pure Service**
> “Implement `<FeatureService>` as pure functions (no IO/state). Include unit tests for edge cases; perf target <X ms>.”

**E) Facade Extension**
> “Extend `<ExistingFacade>` with `<feature>` support without breaking signatures. Delegate to `<FeatureService>`.”

**F) Store**
> “Add `<featureField>` and actions to `appStore`. Persist via repository. Emit `<feature>_changed`.”

**G) Event Bus**
> “Wire `<feature>_changed` reactions in `SearchFacade/SuggestionFacade` to refresh caches and recalc results.”

**H) Integration Test**
> “Write an integration test for `<feature>` covering search → filtering → UI indicators. Add a performance assertion.”

---

## Quick Reference Card

- **Decide fast:** foundation check → PROCEED/HOLD  
- **Plan vertical slice:** MVP only, deliver end-to-end  
- **Build order:** Data → Domain → Facades → State → UI  
- **Keep purity:** domain has **no side effects**  
- **Don’t break stuff:** **extend** interfaces/stores  
- **Use events:** cross-system updates via event bus  
- **Prove it:** integration + perf tests before polish  
