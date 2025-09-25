# MealMaster V2 - 2-Week Build Guide
*Optimized for Solo Developer + Claude Code Collaboration*

## Overview
This guide breaks down building a production-ready nutrition tracker in 2 weeks (80-100 development hours) using vertical slices and architectural discipline.

---

## **WEEK 1: Foundation + Core Vertical Slices**

### **Day 1 (6-8 hours): Project Foundation**

#### **Morning: Project Setup (3-4 hours)**
**Deliverables:**
- ✅ New Expo project with TypeScript strict mode
- ✅ ESLint/Prettier/Husky configured with architecture rules
- ✅ Folder structure matching foundation doc
- ✅ CI/CD pipeline (GitHub Actions)

**Working with Claude Code:**
```
"Create a new Expo React Native project with TypeScript. Set up the exact folder structure from the foundation document. Configure ESLint with the architectural rules to prevent cross-store imports and enforce file size limits."
```

**Decision Framework:**
- **Project Name**: Use exact same bundle ID as current app for smooth migration
- **Expo Version**: Use latest stable (not beta) for production reliability
- **TypeScript Config**: Strict mode enabled, no `any` types allowed

**Definition of Done:**
- [ ] Build succeeds with no warnings
- [ ] ESLint fails on cross-store imports (test it)
- [ ] Pre-commit hooks prevent bad commits
- [ ] All foundation document patterns enforced

#### **Afternoon: Core Domain Models (3-4 hours)**
**Deliverables:**
- ✅ `domain/models.ts` with canonical types
- ✅ `lib/eventBus.ts` with complete event schema
- ✅ `lib/featureFlags.ts` configuration
- ✅ Basic logging and error handling

**Working with Claude Code:**
```
"Implement the exact domain models from the foundation document. Create the typed event bus with all the events listed. Set up basic Sentry integration and structured logging."
```

**Critical Decisions:**
- **Event Schema**: Implement ALL events from foundation doc, even if not used yet
- **Type Safety**: Use strict union types, no optional fields that should be required
- **Logging Strategy**: Structure logs for easy querying, include userId context

**Definition of Done:**
- [ ] All types compile with strict TypeScript
- [ ] Event bus is fully typed (autocomplete works)
- [ ] Sentry catches and reports errors
- [ ] Performance tracking events emit correctly

---

### **Day 2 (8-10 hours): Database Schema + Pure Services**

#### **Morning: Supabase Schema (4-5 hours)**
**Deliverables:**
- ✅ All tables from foundation doc created
- ✅ Row Level Security (RLS) policies
- ✅ Database functions for rollups
- ✅ Migrations versioned and tested

**Working with Claude Code:**
```
"Create the complete Supabase schema from the foundation document. Set up proper RLS policies for user data isolation. Create the rollup functions for daily/weekly totals. Write idempotent migrations."
```

**Database Decision Framework:**
- **Table Naming**: Use singular nouns (profile, not profiles)
- **Indexes**: Add indexes for all common query patterns
- **Constraints**: Enforce data integrity at database level
- **RLS**: User can only access their own data, no exceptions

**Definition of Done:**
- [ ] All tables created with proper foreign keys
- [ ] RLS prevents cross-user data access (test it)
- [ ] Rollup functions return correct aggregates
- [ ] Can run migrations multiple times safely

#### **Afternoon: Pure Domain Services (4-5 hours)**
**Deliverables:**
- ✅ Macro calculation engine (extracted from legacy)
- ✅ Micronutrient engine (extracted from legacy)
- ✅ `TargetsService`, `LedgerService`, `TotalsService` interfaces
- ✅ Unit tests with golden fixtures

**Working with Claude Code:**
```
"Extract the macro and micro calculation engines from the legacy codebase. Create the domain service interfaces exactly as specified. Write comprehensive unit tests using 7-day fixtures to verify calculations."
```

**Extraction Strategy:**
- **Legacy File**: `src/services/macros/engine.ts` → Copy pure functions only
- **Dependencies**: Remove ALL React/Zustand dependencies
- **Testing**: Use exact same test cases as legacy to verify correctness
- **Interface Design**: Start with minimal interfaces, expand only as needed

**Definition of Done:**
- [ ] Domain services have zero external dependencies
- [ ] All calculations match legacy system exactly
- [ ] Unit tests achieve 90%+ coverage on business logic
- [ ] Services can be imported without side effects

---

### **Day 3 (8-10 hours): State Management + Event Wiring**

#### **Morning: Three Store Architecture (4-5 hours)**
**Deliverables:**
- ✅ `appStore` (auth, profile, preferences)
- ✅ `dataStore` (entities, caches)
- ✅ `uiStore` (modals, loading states)
- ✅ Zero cross-store imports (ESLint enforced)

**Working with Claude Code:**
```
"Create the three Zustand stores exactly as specified in the foundation document. Wire them to the event bus for cross-store communication. Ensure no store directly imports another."
```

**Store Responsibility Decisions:**
- **appStore**: Everything about WHO the user is
- **dataStore**: Everything about WHAT data exists
- **uiStore**: Everything about HOW the app looks right now
- **Event Bus**: HOW stores communicate (never direct imports)

**Definition of Done:**
- [ ] Each store has single, clear responsibility
- [ ] ESLint prevents any store-to-store imports
- [ ] Event bus handles all cross-store reactions
- [ ] Store state can be logged for debugging

#### **Afternoon: Repository Pattern + Adapters (4-5 hours)**
**Deliverables:**
- ✅ Supabase repository implementations
- ✅ USDA/Spoonacular adapter stubs (returning NutrientVector)
- ✅ Caching layer for food data
- ✅ Connection pooling and error handling

**Working with Claude Code:**
```
"Create the repository pattern implementations for Supabase. Build adapter stubs that return the canonical NutrientVector format. Add caching and error handling."
```

**Adapter Design Decisions:**
- **Normalization**: ALL external APIs return NutrientVector at the boundary
- **Error Handling**: Fail fast, don't swallow errors
- **Caching Strategy**: Cache successful lookups, invalidate on errors
- **Retry Logic**: Simple exponential backoff, max 3 retries

**Definition of Done:**
- [ ] All adapters return exactly the same data structure
- [ ] Repository methods are idempotent (safe to call twice)
- [ ] Caching prevents duplicate API calls within 5 minutes
- [ ] Error boundaries catch and report all failures

---

### **Days 4-5 (16-20 hours): First Vertical Slice - Daily Ledger**

#### **Core Implementation (8-10 hours)**
**Deliverables:**
- ✅ Complete meal logging flow (add entry → update totals)
- ✅ Target calculation with precedence (base → weekly → menstrual)
- ✅ Dashboard with macro rings showing real data
- ✅ Settings screen for profile/goals

**Working with Claude Code:**
```
"Implement the complete daily ledger vertical slice. User can set their profile/goals, add food entries, and see updated macro totals in real-time on the dashboard."
```

**Integration Decisions:**
- **Data Flow**: Settings → Profile → Targets → Entry → Totals → Dashboard
- **Real-time Updates**: Use event bus to keep UI synchronized
- **Validation**: Client-side validation with server-side enforcement
- **Performance**: Cache today's targets, recalculate only on changes

#### **UI Implementation (4-5 hours)**
**Deliverables:**
- ✅ Extracted theme system from legacy
- ✅ Basic component library (atoms/molecules)
- ✅ Functional dashboard and settings screens
- ✅ Loading/error/empty states

**Working with Claude Code:**
```
"Extract the theme system and component library from the legacy codebase. Build functional (not fancy) dashboard and settings screens. Focus on data flow, not polish."
```

**UI Decision Framework:**
- **Theme Extraction**: Copy exact color/typography system
- **Component Reuse**: Reuse atoms/molecules but rebuild organisms
- **State Management**: Presentational components only, no business logic
- **Accessibility**: Basic a11y (labels, contrast), not advanced

#### **Testing & Integration (4-5 hours)**
**Deliverables:**
- ✅ Integration tests for complete flow
- ✅ Performance budget verification
- ✅ Error handling and edge cases
- ✅ Database rollup jobs working

**Working with Claude Code:**
```
"Write integration tests that verify the complete meal logging flow from UI to database. Test all error conditions and edge cases. Verify performance budgets are met."
```

**Testing Strategy:**
- **Golden Path**: Happy path integration test with real data
- **Edge Cases**: Empty states, network failures, invalid inputs
- **Performance**: Measure actual timing, fail if over budget
- **Database**: Test rollup jobs with various meal combinations

**Definition of Done:**
- [ ] Can log a meal and see dashboard update in <1200ms
- [ ] Target precedence works (menstrual overrides weekly)
- [ ] All error states render properly
- [ ] Database rollup jobs run without errors

---

### **Weekend Review & Planning (2-4 hours)**
**Activities:**
- Code review of Week 1 work with Claude Code
- Performance analysis and optimization opportunities
- Week 2 planning and risk assessment
- Documentation updates

---

## **WEEK 2: Feature Completion + Production Polish**

### **Days 6-7 (16-20 hours): Food Search & Logging Vertical**

#### **Core Search Implementation (8-10 hours)**
**Deliverables:**
- ✅ USDA API integration with proper error handling
- ✅ Spoonacular API integration (recipes)
- ✅ Food search with debouncing and caching
- ✅ Food selection and confirmation flow

**Working with Claude Code:**
```
"Implement complete food search using USDA and Spoonacular APIs. Include proper debouncing, caching, and error handling. Build the food selection and confirmation UI."
```

**Search Strategy Decisions:**
- **Primary Source**: USDA for whole foods, Spoonacular for recipes
- **Fallback Chain**: USDA → Spoonacular → Cached results → Manual entry
- **Debouncing**: 300ms delay, cancel previous requests
- **Results Ranking**: Prefer exact matches, then partial, then fuzzy

#### **Barcode Integration (4-5 hours)**
**Deliverables:**
- ✅ Camera integration for barcode scanning
- ✅ Barcode lookup via Open Food Facts
- ✅ Confirmation flow with nutritional data
- ✅ Manual entry fallback

**Working with Claude Code:**
```
"Add barcode scanning using Expo Camera. Integrate Open Food Facts API for barcode lookup. Create confirmation flow that shows nutritional data before logging."
```

**Barcode Decision Framework:**
- **Camera Permissions**: Request only when needed, graceful degradation
- **API Integration**: Open Food Facts primary, manual fallback
- **UX Flow**: Scan → Confirm → Adjust portion → Log
- **Data Quality**: Validate nutritional data, flag suspicious entries

#### **Advanced Food Features (4-5 hours)**
**Deliverables:**
- ✅ Recent foods and favorites
- ✅ Custom food creation
- ✅ Portion size adjustments
- ✅ Meal type categorization

**Working with Claude Code:**
```
"Implement recent foods, favorites, and custom food creation. Add portion size adjustments and meal type categorization (breakfast, lunch, dinner, snacks)."
```

**Feature Prioritization:**
- **Recent Foods**: Cache last 20 foods per user
- **Favorites**: Star system with categories
- **Custom Foods**: Manual nutritional data entry
- **Portions**: Common serving sizes + custom amounts

**Definition of Done:**
- [ ] Search returns results within 800ms performance budget
- [ ] Barcode scanning works on 80%+ of products
- [ ] All food sources normalize to NutrientVector format
- [ ] Error handling provides clear user feedback

---

### **Days 8-9 (16-20 hours): Analytics & Insights Vertical**

#### **Data Analytics Implementation (8-10 hours)**
**Deliverables:**
- ✅ Daily/weekly/monthly rollup jobs
- ✅ Trend analysis and pattern detection
- ✅ Insight rule engine (nutrient deficiency alerts)
- ✅ Progress tracking visualizations

**Working with Claude Code:**
```
"Implement the analytics rollup system with daily, weekly, and monthly aggregations. Build trend analysis and insight generation. Create progress tracking visualizations."
```

**Analytics Architecture Decisions:**
- **Rollup Strategy**: Daily rollups on meal log, weekly/monthly in background
- **Trend Detection**: Compare current week vs. previous 4 weeks
- **Insight Rules**: Focus on macro balance and micronutrient adequacy
- **Performance**: Pre-compute analytics, don't calculate on-demand

#### **Advanced Goal Management (4-5 hours)**
**Deliverables:**
- ✅ Weekly goal cycling (different targets per day)
- ✅ Menstrual cycle integration for goal precedence
- ✅ Goal adjustment recommendations
- ✅ Progress celebration and motivation

**Working with Claude Code:**
```
"Implement advanced goal management with weekly cycling and menstrual cycle integration. Add goal adjustment recommendations based on progress data."
```

**Goal Management Decisions:**
- **Precedence**: Menstrual > Weekly > Base (as specified)
- **Cycling**: User can set different goals for different days
- **Recommendations**: Suggest adjustments based on adherence patterns
- **Motivation**: Celebrate streaks and achievements

#### **Suggestion Engine (4-5 hours)**
**Deliverables:**
- ✅ Remaining macros suggestions
- ✅ Nutrient gap recommendations
- ✅ Meal timing optimization
- ✅ Shopping list generation

**Working with Claude Code:**
```
"Build the suggestion engine that recommends foods to hit remaining macro targets and fill nutrient gaps. Add meal timing optimization and shopping list generation."
```

**Suggestion Algorithm:**
- **Macro Targets**: Find foods that best complete remaining macros
- **Nutrient Gaps**: Identify micronutrient deficiencies, suggest foods
- **Timing**: Recommend meal spacing based on user patterns
- **Shopping**: Generate lists from meal plans and recipes

**Definition of Done:**
- [ ] Analytics rollups complete without errors
- [ ] Insights are relevant and actionable (not generic)
- [ ] Suggestions improve macro adherence by measurable amount
- [ ] Goal precedence works correctly for all edge cases

---

### **Days 10-11 (16-20 hours): Recipe & Meal Planning**

#### **Recipe Management (8-10 hours)**
**Deliverables:**
- ✅ Recipe builder with ingredient management
- ✅ Spoonacular recipe import and display
- ✅ Recipe nutritional analysis and scaling
- ✅ Recipe sharing and favorites

**Working with Claude Code:**
```
"Build complete recipe management system. Recipe builder should use the same components as recipe display (foundation doc requirement). Import recipes from Spoonacular and allow manual creation."
```

**Recipe Architecture Decisions:**
- **Builder = Display**: Same components for consistency (hard requirement)
- **Scaling**: Recalculate nutrition when serving size changes
- **Import**: Spoonacular recipes pre-fill builder fields
- **Storage**: Recipes stored as ingredients + instructions + metadata

#### **Meal Planning (8-10 hours)**
**Deliverables:**
- ✅ Weekly meal plan creation
- ✅ Drag & drop meal organization
- ✅ Meal plan application to ledger
- ✅ Shopping list generation from plans

**Working with Claude Code:**
```
"Implement weekly meal planning with drag & drop organization. Allow users to apply meal plans to their food log and generate shopping lists automatically."
```

**Meal Planning Strategy:**
- **Planning Horizon**: Focus on 1 week, with templates for recurring plans
- **Flexibility**: Easy to adjust plans, don't over-constrain users
- **Integration**: Planned meals become entries when applied
- **Shopping Lists**: Consolidate ingredients, group by food type

**Definition of Done:**
- [ ] Recipe builder and display use identical components
- [ ] Meal plans can be created, edited, and applied seamlessly
- [ ] Shopping lists accurately reflect meal plan ingredients
- [ ] Recipe scaling maintains nutritional accuracy

---

### **Days 12-14 (18-24 hours): Production Polish & Launch Prep**

#### **Performance Optimization (6-8 hours)**
**Deliverables:**
- ✅ Performance budget enforcement in all flows
- ✅ Image optimization and lazy loading
- ✅ Database query optimization
- ✅ Bundle size analysis and code splitting

**Working with Claude Code:**
```
"Optimize performance across all user flows. Ensure performance budgets are met. Optimize database queries, implement lazy loading, and analyze bundle size."
```

**Performance Optimization Strategy:**
- **Critical Path**: Optimize cold start and core user flows first
- **Database**: Add indexes for slow queries, optimize rollup jobs
- **Images**: Optimize food photos, implement progressive loading
- **Bundle**: Code split by feature, lazy load non-critical components

#### **Error Handling & Resilience (4-6 hours)**
**Deliverables:**
- ✅ Global error boundary with user-friendly messages
- ✅ Offline mode with sync when reconnected
- ✅ Data validation and sanitization
- ✅ Graceful degradation for API failures

**Working with Claude Code:**
```
"Implement comprehensive error handling and offline support. Ensure the app gracefully handles all failure modes with user-friendly messages."
```

**Resilience Strategy:**
- **Error Boundaries**: Catch all React errors, provide recovery options
- **Offline Mode**: Cache recent data, queue actions for later sync
- **API Failures**: Show cached data when possible, clear error messages
- **Data Corruption**: Validate all inputs, sanitize before storage

#### **Production Readiness (4-6 hours)**
**Deliverables:**
- ✅ App store build configuration
- ✅ Privacy policy and data handling compliance
- ✅ Analytics and crash reporting setup
- ✅ Feature flags for gradual rollout

**Working with Claude Code:**
```
"Configure the app for App Store submission. Set up privacy compliance, analytics, and feature flags for controlled rollout."
```

**Launch Preparation:**
- **App Store**: Configure build variants, icons, screenshots
- **Privacy**: Implement consent flows, data export/deletion
- **Monitoring**: Sentry for errors, analytics for usage patterns
- **Rollout**: Feature flags to enable features gradually

#### **Final Testing & Documentation (4-4 hours)**
**Deliverables:**
- ✅ End-to-end testing on real devices
- ✅ Performance testing under load
- ✅ Documentation for future development
- ✅ Deployment scripts and CI/CD

**Working with Claude Code:**
```
"Perform comprehensive testing on real devices. Document the architecture and deployment process for future development cycles."
```

**Final Validation:**
- **E2E Testing**: Test complete user journeys on iOS and Android
- **Performance**: Verify all budgets met under realistic conditions
- **Documentation**: Update foundation doc with any architectural changes
- **Deployment**: Automated build and deployment pipeline

**Definition of Done:**
- [ ] App passes App Store review guidelines
- [ ] All performance budgets consistently met
- [ ] Error rates below 1% in production
- [ ] Documentation complete for future developers

---

## **Success Metrics & Monitoring**

### **Technical Health Metrics:**
- **Build Time**: < 30 seconds from save to reload
- **Test Coverage**: > 80% for domain and adapters
- **Performance Budgets**: All flows within specified limits
- **Error Rate**: < 1% of user sessions

### **Architecture Health:**
- **File Size**: No files > 400 LOC (automated enforcement)
- **Cyclomatic Complexity**: No functions > 10 complexity
- **Store Coupling**: Zero cross-store imports (ESLint enforced)
- **Type Safety**: 100% TypeScript coverage, no `any` types

### **User Experience:**
- **App Store Rating**: Target 4.5+ stars
- **Crash Rate**: < 0.1% of sessions
- **User Retention**: 40%+ return after 7 days
- **Feature Adoption**: 60%+ use core logging features daily

---

## **Risk Mitigation Strategies**

### **High-Risk Areas:**
1. **Performance Budgets**: Build performance tracking into every feature
2. **Data Migration**: Test migration scripts extensively before launch
3. **API Rate Limits**: Implement proper caching and fallback strategies
4. **State Management**: Use event bus consistently, avoid shortcuts

### **Contingency Plans:**
- **Schedule Slippage**: Cut advanced features (meal planning, analytics)
- **API Issues**: Fall back to manual entry with cached suggestions
- **Performance Problems**: Implement progressive loading and background sync
- **Data Corruption**: Implement data validation and backup/restore

---

## **Claude Code Collaboration Tips**

### **Effective Prompting Patterns:**
```
// Good: Specific with context
"Implement the TargetsService interface from the foundation document. It should handle goal precedence (menstrual > weekly > base) and return cached targets for today."

// Bad: Vague request
"Build the targets system."
```

### **Architecture Enforcement:**
```
// Always reference the foundation document
"Following the foundation document architecture, create..."

// Specify constraints explicitly
"This must be a pure function with no side effects..."
```

### **Decision Documentation:**
- Document all architectural decisions in commit messages
- Reference foundation document sections when making choices
- Update foundation document when patterns emerge

This guide provides the framework for building a production-ready nutrition tracker in 2 weeks while maintaining architectural discipline and avoiding the pitfalls that led to the current codebase's complexity.