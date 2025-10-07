# Meal Planning UI Prototypes

## Status: PROTOTYPE / REFERENCE ONLY

These components were scaffolded during initial development to test the meal planning domain logic and facade layer. They are **NOT production-ready** and should be considered reference material only.

---

## Components in This Directory

### Screens
- `MealPlanningScreen.tsx` - Main meal planning screen with weekly view

### Organisms
- `WeeklyPlanGrid.tsx` - Weekly grid with drag & drop support
- `RecipeForm.tsx` - Recipe creation/editing form

### Molecules
- `AddMealModal.tsx` - Modal for adding meals to plan
- `DayColumn.tsx` - Single day column in weekly view
- `MealPlanningToolbar.tsx` - Toolbar with week navigation
- `PlannedMealCard.tsx` - Individual planned meal card
- `RecipeBasicInfo.tsx` - Recipe basic information display
- `RecipeIngredientsList.tsx` - Recipe ingredients list
- `RecipeInstructionsList.tsx` - Recipe cooking instructions
- `RecipeNutritionSummary.tsx` - Recipe nutrition summary
- `ShoppingListModal.tsx` - Shopping list generation modal

**Total:** 12 components, ~87KB of code

---

## Why These Are Here

1. **Preserve Development Work** - These represent thought and effort, don't throw away
2. **Avoid Architectural Violations** - They import domain directly (violates Foundation.md)
3. **No Wireframes Yet** - Built without UX design, may not match final vision
4. **Proof of Concept** - Demonstrate how to integrate with `MealPlanningFacade`
5. **Reference Material** - Can cherry-pick patterns when building real UI

---

## What to Do With These

### ✅ DO
- Review when building actual meal planning UI
- Extract useful patterns (e.g., shopping list aggregation)
- Reference for facade integration examples
- Copy small utility functions if applicable

### ❌ DON'T
- Import these into production code
- Fix linting errors (they're ignored intentionally)
- Spend time refactoring them
- Use as-is without proper wireframes

---

## Foundation Layer Status

The **domain layer is production-ready** and should be used:

✅ **Keep Using:**
- `app/domain/models.ts` - Recipe/meal plan types
- `app/domain/services/plans.ts` - Business logic (267 LOC)
- `app/domain/services/recipes.ts` - Recipe calculations (196 LOC)
- `app/facades/MealPlanningFacade.ts` - Application facade (371 LOC)
- `app/data/migrations/010_extend_recipe_meal_plan_schema.sql` - Database schema

**Total Foundation:** ~1200 LOC of solid, tested, architecture-compliant code

---

## Next Steps

1. ✅ Complete user journey documentation in `docs/`
2. ✅ Create wireframes for meal planning feature
3. ✅ Build production UI using `MealPlanningFacade` (no direct domain imports!)
4. ✅ Delete this directory when no longer needed

---

## Architectural Compliance

These components violate Foundation.md:
- ❌ UI imports domain directly (should use facades only)
- ❌ No wireframes to validate UX
- ❌ Not part of documented user journeys

Once you build proper UI:
- ✅ Use `MealPlanningFacade` for all meal planning operations
- ✅ Import only from `app/facades/`, never `app/domain/`
- ✅ Follow your actual wireframes and design system

---

## Questions?

See Foundation.md section on "Layered Architecture & Folder Layout":
> "UI never imports repositories/adapters—only facades in `app/`."

This directory exists to comply with that principle while preserving reference material.
