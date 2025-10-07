# Enhanced Feature Addition Guide for LLM Agents

This guide provides a comprehensive framework for adding features to MacroMuse while maintaining Foundation.md architectural discipline. It includes specific templates for working with LLM code agents.

---

## Enhanced LLM Agent Instruction Template

When requesting new features from LLM agents, use this comprehensive template:

### Feature Request for LLM Agent

**Feature Name:** [Specific, clear name]
**User Story:** As a [user type], I want [capability] so that [benefit]
**Foundation Impact:** [Reference specific Foundation.md tenets affected]

### Technical Specification

#### Domain Model Changes
- **Extend:** [specific types in domain/models.ts that need modification]
- **Add:** [new types needed with clear definitions]
- **NutrientVector impact:** [how this feature affects nutrition data structure]
- **Type safety:** [new union types or enums needed]

#### Database Schema Impact
- **New tables:** [table names with brief purpose and relationships]
- **Extend tables:** [existing tables to modify with specific columns]
- **Migration complexity:** [low/medium/high with justification]
- **RLS policies:** [security requirements for new data]
- **Performance indexes:** [what indexes are needed for queries]

#### API Integration Requirements
- **USDA API:** [specific endpoints or data changes needed]
- **Spoonacular API:** [recipe/food data requirements]
- **External services:** [any new third-party integrations]
- **Rate limiting:** [API usage impact and caching needs]

#### Performance Requirements
- **Budget targets:** [specific millisecond targets for operations]
- **Caching strategy:** [what data needs caching and invalidation rules]
- **Analytics impact:** [how feature affects rollup computations]
- **Memory usage:** [expected memory footprint increase]

#### Event Bus Integration
- **New events:** [event names with full payload specifications]
- **Event reactions:** [which stores/facades need to react to events]
- **Cross-feature impact:** [how this affects other features via events]

### Implementation Scope

#### MVP Definition (must be extremely specific)
- **Include:** [exactly 3-5 core behaviors with measurable criteria]
- **Exclude:** [specific features out of scope for v1 to prevent scope creep]
- **Success metric:** [single measurable outcome that defines success]
- **Timeline:** [realistic development time estimate]

#### Testing Requirements
- **Unit tests:** [specific edge cases and business logic scenarios]
- **Integration tests:** [end-to-end user flows to verify]
- **Performance tests:** [specific load scenarios and timing requirements]
- **Error handling tests:** [failure scenarios to cover]

### Architecture Constraints (Non-Negotiable)

- ✅ **Must extend existing facades** (not replace them)
- ✅ **Must use event bus** for all cross-store communication
- ✅ **Must maintain three-store pattern** (app/data/ui only)
- ✅ **Must follow NutrientVector normalization** for all nutrition data
- ✅ **Must include proper RLS policies** for data security
- ✅ **Must meet performance budgets** with automated enforcement
- ✅ **Must provide user-friendly error messages** (no technical details)

### User Experience Impact

#### New Screens
- **Screen names:** [exact screen names and navigation paths]
- **Screen purposes:** [what each screen accomplishes]
- **Navigation integration:** [how screens fit into existing navigation]

#### Modified Screens
- **Existing screens affected:** [which current screens need changes]
- **Change descriptions:** [specific UI modifications needed]
- **Backward compatibility:** [ensure existing users aren't disrupted]

#### Accessibility Requirements
- **Screen reader support:** [specific a11y labels and descriptions]
- **Keyboard navigation:** [tab order and focus management]
- **Color contrast:** [visual accessibility requirements]
- **Touch targets:** [minimum size requirements for interactive elements]

### Rollout Strategy

#### Feature Flag Implementation
- **Flag name:** [specific feature flag identifier]
- **Rollout percentage:** [gradual rollout strategy percentage]
- **Requirements:** [what conditions must be met for feature access]
- **Rollback plan:** [how to disable feature if issues arise]

#### Migration Strategy
- **Existing users:** [how current users are affected]
- **Data migration:** [any data structure changes needed]
- **Compatibility:** [backward compatibility requirements]

#### Monitoring Plan
- **Error tracking:** [specific error scenarios to monitor]
- **Performance monitoring:** [key metrics to track]
- **Usage analytics:** [adoption metrics to measure]

---

## Backend-Frontend Alignment Verification

### Critical Alignment Checkpoints

#### Data Flow Verification
- [ ] **Database schema matches domain models exactly**
  - Verify JSONB fields use NutrientVector structure
  - Confirm all foreign key relationships are correct
  - Check that database constraints match business rules

- [ ] **Repository returns match facade expectations**
  - Verify repository method signatures match facade needs
  - Confirm error handling propagates correctly
  - Check that data transformations preserve type safety

- [ ] **Facade responses match UI component props**
  - Verify facade return types match component prop types
  - Confirm loading states are properly communicated
  - Check that error states include user-friendly messages

- [ ] **Event payloads match store action signatures**
  - Verify event schemas match store expectations
  - Confirm all required fields are included in events
  - Check that event timing doesn't create race conditions

#### Type Safety Chain
- [ ] **Database JSONB fields typed as NutrientVector**
  - All nutrition data stored in consistent format
  - Database queries return properly typed data
  - No loose object types in database layer

- [ ] **Repository methods return proper domain types**
  - No `any` types in repository responses
  - All domain models properly exported and imported
  - Error types are domain-specific, not database-specific

- [ ] **Facade methods accept/return domain types**
  - No primitive obsession (strings for IDs, etc.)
  - Proper validation of input parameters
  - Consistent error handling and type conversion

- [ ] **UI components receive properly typed props**
  - No prop drilling of complex objects
  - Loading and error states have proper types
  - Event handlers use correct parameter types

#### Performance Alignment
- [ ] **Database queries meet facade performance budgets**
  - Queries execute within specified time limits
  - Proper indexes exist for common query patterns
  - No N+1 query problems in data fetching

- [ ] **Facade operations meet UI performance budgets**
  - API calls complete within UI timeout expectations
  - Caching prevents unnecessary repeated requests
  - Error handling doesn't block UI responsiveness

- [ ] **Caching strategy covers UI data needs**
  - Frequently accessed data is cached appropriately
  - Cache invalidation matches data update patterns
  - No stale data displayed in UI components

- [ ] **Analytics rollups support UI requirements**
  - Dashboard data loads within performance budget
  - Aggregation queries are optimized for display needs
  - Real-time updates don't impact overall performance

#### Error Handling Chain
- [ ] **Database errors properly mapped to domain errors**
  - Connection failures have specific error types
  - Constraint violations map to business rule errors
  - No database-specific error messages leak to UI

- [ ] **Repository errors handled by facades**
  - All database errors caught and transformed
  - Retry logic implemented where appropriate
  - Circuit breaker pattern for repeated failures

- [ ] **Facade errors converted to user-friendly messages**
  - No technical jargon in user-facing errors
  - Actionable error messages when possible
  - Proper error categorization (network, validation, etc.)

- [ ] **UI displays appropriate error states**
  - Error boundaries catch component failures
  - Loading states prevent user confusion
  - Retry mechanisms available where appropriate

---

## Common First-Time Developer Mistakes

### 1. Data Shape Mismatches
```typescript
// ❌ WRONG - Backend and frontend expect different shapes
// Backend returns: { calories: 250, protein_g: 30 }
// Frontend expects: { calories: 250, protein: 30 }

// ✅ CORRECT - Use NutrientVector as single source of truth
interface NutrientVector {
  calories?: number
  protein_g?: number // Always use exact field names
}
```

### 2. Async/Loading State Problems
```typescript
// ❌ WRONG - Shows stale data while loading
const Component = () => {
  const [data, setData] = useState(oldData) // Bug: stale data shown
  useEffect(() => {
    fetchData().then(setData) // No loading state
  }, [])
}

// ✅ CORRECT - Proper loading states
const Component = () => {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    fetchData()
      .then(setData)
      .catch(setError)
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!data) return <EmptyState />
  return <DataDisplay data={data} />
}
```

### 3. Event Bus Timing Issues
```typescript
// ❌ WRONG - Race condition between events and UI
eventBus.emit('meal_logged', mealData)
setMealsList([...meals, newMeal]) // Manual update can cause inconsistency

// ✅ CORRECT - Let event bus handle all updates
eventBus.emit('meal_logged', mealData)
// UI automatically updates when store reacts to event
```

### 4. Performance Testing with Unrealistic Data
```typescript
// ❌ WRONG - Testing with minimal data
// Testing with 5 foods looks great!

// ✅ CORRECT - Test with realistic volumes
// Test with 1000+ foods, 90 days of logs, 50+ recipes
```

### 5. Missing Error Boundaries
```typescript
// ❌ WRONG - No error handling for component failures
const App = () => (
  <FeatureComponent /> // If this crashes, whole app crashes
)

// ✅ CORRECT - Proper error boundaries
const App = () => (
  <ErrorBoundary fallback={<ErrorScreen />}>
    <FeatureComponent />
  </ErrorBoundary>
)
```

---

## Emergency Debugging Protocol

### When Something Breaks During Development

#### Step 1: Identify the Layer
```bash
Database → Repository → Facade → Store → UI
# Use console.log to trace data through each layer
# Verify data shape and type at each step
```

#### Step 2: Check Event Flow
```bash
# Event emitted? Check eventBus.emit calls
# Event received? Check eventBus.on handlers
# Store updated? Check store state changes
# UI updated? Check component re-renders
```

#### Step 3: Verify Types
```bash
# TypeScript errors? Fix type mismatches first
# Runtime type errors? Check actual vs expected data shapes
# Missing fields? Verify API responses match expectations
```

#### Step 4: Performance Analysis
```bash
# Slow queries? Check database query plans
# Slow UI? Check for unnecessary re-renders
# Memory leaks? Check for uncleaned event listeners
```

#### Step 5: Test Data Isolation
```bash
# Test with minimal data first
# Gradually increase data volume
# Identify performance breaking points
```

---

## Feature Addition Workflow Checklist

### Pre-Implementation (Foundation Check)
- [ ] Read Foundation.md tenets relevant to feature
- [ ] Verify feature aligns with architectural principles
- [ ] Confirm no new stores needed (extend existing)
- [ ] Plan event bus integration
- [ ] Define performance budgets

### During Implementation
- [ ] Start with database schema and migration
- [ ] Implement pure domain services (no I/O)
- [ ] Create/extend facades (business logic layer)
- [ ] Update stores with new state and actions
- [ ] Build UI components (presentational only)
- [ ] Wire event bus connections
- [ ] Add comprehensive error handling

### Post-Implementation Verification
- [ ] Unit tests for domain logic
- [ ] Integration tests for complete flows
- [ ] Performance tests meet budgets
- [ ] Error scenarios handled gracefully
- [ ] UI/UX tested on real devices
- [ ] Documentation updated

### Pre-Production Checklist
- [ ] Feature flag implementation complete
- [ ] Monitoring and analytics in place
- [ ] Error tracking configured
- [ ] Rollback plan tested
- [ ] Performance benchmarks established

---

## LLM Agent Communication Best Practices

### When Requesting Features
1. **Be extremely specific** about data structures and API contracts
2. **Reference existing patterns** in the codebase for consistency
3. **Specify error handling requirements** explicitly
4. **Include performance budgets** and testing requirements
5. **Define success criteria** with measurable outcomes

### When Reviewing Code
1. **Verify architectural compliance** against Foundation.md
2. **Check type safety** throughout the entire data flow
3. **Test with realistic data** volumes and scenarios
4. **Validate error handling** with network failures and edge cases
5. **Confirm performance budgets** are met under load

### When Debugging Issues
1. **Provide complete error messages** and stack traces
2. **Include data samples** that demonstrate the problem
3. **Specify exact steps** to reproduce the issue
4. **Describe expected vs actual behavior** clearly
5. **Include environment details** (device, OS, app version)

Remember: The goal is to maintain architectural discipline while enabling rapid feature development. Use this guide as a checklist for every feature addition to ensure consistency and quality.