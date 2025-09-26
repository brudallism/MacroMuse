# Playground Screen Best Practices - Foundation.md Compliance

## Overview
The Playground Screen is designed to test and validate UI components while maintaining strict Foundation.md architectural compliance. Use this guide to ensure all component development follows our architectural principles.

## Foundation.md Compliance Rules

### 1. **UI Components Must Be Purely Presentational**
```typescript
// ✅ CORRECT - Props-driven, no business logic
interface ComponentProps {
  data: LocalInterface  // Inline interface, NOT imported from @domain
  onAction: (data: LocalInterface) => void  // Callbacks for actions
  variant?: 'primary' | 'secondary'
}

// ❌ WRONG - Business logic in UI
import { UserService } from '@domain/services/user'  // Domain import forbidden
const user = UserService.getCurrentUser()  // Service call in UI
```

### 2. **No Domain/Infra Imports in UI**
```typescript
// ✅ CORRECT - Inline interfaces
interface PlaygroundFood {
  id: string
  name: string
  nutrients: {
    calories: number
    protein_g: number
  }
}

// ❌ WRONG - Domain imports
import { FoodItem, NutrientVector } from '@domain/models'
```

### 3. **Theme Tokens Only (No Inline Hex)**
```typescript
// ✅ CORRECT - Theme tokens
backgroundColor: theme.colors.primary[500]
padding: tokens.spacing.md

// ❌ WRONG - Inline styles
backgroundColor: '#FF5733'
padding: 16
```

### 4. **File Size Limits (<400 LOC)**
- Split components if they exceed 400 lines
- Extract helper functions to separate files
- Keep single responsibility per component

## Playground Testing Methodology

### 1. **Component Isolation Testing**
Test each component independently with mock data:

```typescript
// Test all variants of a component
const foodVariants = [
  { ...mockFood, source: 'usda', variant: 'search' },
  { ...mockFood, source: 'custom', variant: 'favorite' },
  // ... all combinations
]

// Render each variant to verify visual consistency
{foodVariants.map(food => (
  <FoodCard key={food.id} food={food} variant={food.variant} />
))}
```

### 2. **Edge Case Testing**
Always test components with extreme data:

```typescript
// Long text edge case
const longNameFood = {
  name: 'Extremely long food name that tests text wrapping...',
  brand: 'Also very long brand name...'
}

// Empty/minimal data edge case
const minimalFood = {
  name: 'Basic Food',
  nutrients: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
}

// High values edge case
const highValueFood = {
  nutrients: { calories: 9999, protein_g: 999.9 }
}
```

### 3. **Interactive State Testing**
Test all interactive states and callbacks:

```typescript
// Test all possible states
const [isSelected, setIsSelected] = useState(false)
const [isLoading, setIsLoading] = useState(false)
const [hasError, setHasError] = useState(false)

// Mock callbacks that demonstrate functionality
const handleAction = (data: any) => {
  Alert.alert('Action Triggered', JSON.stringify(data))
}
```

### 4. **Theme Consistency Testing**
Verify components work in all theme variants:

```typescript
// Test light/dark mode compatibility
// Test color contrast ratios
// Test responsive behavior
```

## Component Development Workflow

### Step 1: Define Interface (Foundation Compliant)
```typescript
// Create inline interfaces - NO @domain imports
interface ComponentProps {
  data: {
    id: string
    name: string
    // ... only properties actually needed
  }
  variant?: 'primary' | 'secondary'
  onAction?: (data: ComponentProps['data']) => void
}
```

### Step 2: Create Mock Data
```typescript
// Create comprehensive test data in playground
const mockData = {
  basic: { /* normal case */ },
  edge: { /* edge cases */ },
  error: { /* error states */ },
  empty: { /* empty states */ }
}
```

### Step 3: Build Component (Presentational Only)
```typescript
export function Component({ data, variant, onAction }: ComponentProps) {
  // ✅ Local state only (no global state)
  const [localState, setLocalState] = useState()

  // ✅ Theme usage
  const theme = useTheme()

  // ✅ Event handlers (callbacks only)
  const handlePress = () => onAction?.(data)

  // ✅ Pure JSX rendering
  return <View>...</View>
}
```

### Step 4: Test in Playground
```typescript
// Add to PlaygroundScreen with all variants
<Section title="New Component" description="Test description">
  <Component data={mockData.basic} variant="primary" onAction={handleTest} />
  <Component data={mockData.edge} variant="secondary" onAction={handleTest} />
  // ... test all combinations
</Section>
```

### Step 5: Validate Foundation Compliance
Run these checks before considering component complete:

```bash
# No domain/infra imports
grep -r "from '@domain\|from '@infra" app/ui/components/NewComponent.tsx

# File size check
wc -l app/ui/components/NewComponent.tsx  # Must be <400

# No inline hex values
grep -r "#[0-9A-Fa-f]" app/ui/components/NewComponent.tsx

# No business logic
grep -r "Service\|Repository\|eventBus" app/ui/components/NewComponent.tsx
```

## Playground Screen Organization

### Section Structure
```typescript
<Section
  title="Component Name"
  description="What this component does and what you're testing"
>
  {/* All variants and edge cases */}
</Section>
```

### Required Test Categories
1. **Basic Functionality** - Normal use cases
2. **All Variants** - Every possible variant prop
3. **Edge Cases** - Extreme data scenarios
4. **Interactive States** - All user interactions
5. **Error States** - Error/loading/empty scenarios
6. **Accessibility** - Screen reader and keyboard navigation

## Integration with Main App

### After Playground Testing
Once component is validated in playground:

1. **Export for use**: Add to component index files
2. **Wire to facades**: Connect to real data via facades (not in UI)
3. **Add to screens**: Use in actual screen implementations
4. **Integration test**: Test full user flows

### Data Flow Pattern
```
✅ CORRECT: Screen → Facade → Domain → Data
❌ WRONG:   Component → Domain (direct)

// In playground: Mock data
// In real app: Data via props from facade-using parent
```

## Performance Considerations

### Component Performance
- Use `React.memo` for expensive renders
- Minimize re-renders with stable references
- Test with large datasets in playground

### Bundle Size
- Import only what's needed
- Use tree-shakeable imports
- Monitor bundle impact

## Documentation Requirements

### Component Documentation
Each component should document:
- Purpose and use cases
- Required vs optional props
- Callback expectations
- Theme integration points
- Accessibility features

### Playground Documentation
Document in playground:
- What each test demonstrates
- Known limitations or edge cases
- Expected behaviors
- Integration requirements

## Common Pitfalls to Avoid

### ❌ Anti-Patterns
```typescript
// Domain imports in UI
import { FoodService } from '@domain/services/food'

// Business logic in components
const processData = (data) => { /* complex logic */ }

// Direct service calls
const data = await foodService.search(query)

// Inline styles
style={{ backgroundColor: '#FF5733' }}

// Cross-store imports
import { useDataStore } from '@state/dataStore'
```

### ✅ Correct Patterns
```typescript
// Inline interfaces
interface LocalData { id: string; name: string }

// Props-driven data
const Component = ({ data, onAction }: Props) => { ... }

// Callback-based actions
const handleAction = () => onAction?.(data)

// Theme-based styles
style={{ backgroundColor: theme.colors.primary[500] }}

// Facade integration (parent level)
const data = await dashboardFacade.getData()
```

## Success Criteria

A component is ready for production when:

- [ ] **Foundation compliant**: No domain imports, <400 LOC, theme tokens only
- [ ] **Playground tested**: All variants, edge cases, and interactions work
- [ ] **Accessible**: Proper labels, contrast, keyboard navigation
- [ ] **Performant**: No unnecessary re-renders, efficient rendering
- [ ] **Documented**: Clear props, behaviors, and usage patterns
- [ ] **Integrated**: Works properly when connected to real data via facades

Remember: The playground is for **component validation**, not **business logic testing**. Business logic belongs in domain services with their own unit tests.