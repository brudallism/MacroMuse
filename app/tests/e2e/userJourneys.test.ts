import { device, element, by, waitFor, expect } from 'detox'

import { PERFORMANCE_BUDGETS } from '../../lib/performance'

describe('Complete User Journeys - Day 14 Final Testing', () => {
  beforeEach(async () => {
    await device.reloadReactNative()
    // Skip onboarding for faster test execution
    await element(by.id('skip-onboarding')).tap()
  })

  describe('New User Onboarding → First Food Log', () => {
    it('should complete full onboarding and log first meal within performance budget', async () => {
      const startTime = Date.now()

      // Step 1: Profile Setup
      await element(by.id('profile-setup-tab')).tap()
      await element(by.id('weight-input')).typeText('70')
      await element(by.id('height-input')).typeText('175')
      await element(by.id('age-input')).typeText('30')
      await element(by.id('activity-level-moderate')).tap()
      await element(by.id('save-profile-button')).tap()

      // Verify profile saved notification
      await waitFor(element(by.text('Profile saved successfully')))
        .toBeVisible()
        .withTimeout(2000)

      // Step 2: Goal Setting
      await element(by.id('goal-weight-loss')).tap()
      await element(by.id('target-weight-input')).typeText('65')
      await element(by.id('weekly-goal-moderate')).tap()
      await element(by.id('save-goals-button')).tap()

      // Verify goals calculated notification
      await waitFor(element(by.text('Goals calculated successfully')))
        .toBeVisible()
        .withTimeout(2000)

      // Step 3: First Food Search and Log
      await element(by.id('food-search-tab')).tap()
      await element(by.id('food-search-input')).typeText('grilled chicken breast')

      // Wait for search results within performance budget
      const searchStart = Date.now()
      await waitFor(element(by.id('search-results')))
        .toBeVisible()
        .withTimeout(3000)

      const searchTime = Date.now() - searchStart
      expect(searchTime).toBeLessThan(PERFORMANCE_BUDGETS.search)

      // Select first result and configure portion
      await element(by.id('food-result-0')).tap()
      await waitFor(element(by.id('food-confirmation-modal')))
        .toBeVisible()
        .withTimeout(2000)

      await element(by.id('serving-size-input')).clearText()
      await element(by.id('serving-size-input')).typeText('150')
      await element(by.id('meal-type-lunch')).tap()

      // Log the food
      const logStart = Date.now()
      await element(by.id('log-food-button')).tap()

      // Verify logging success within budget
      await waitFor(element(by.text('Food logged successfully')))
        .toBeVisible()
        .withTimeout(3000)

      const logTime = Date.now() - logStart
      expect(logTime).toBeLessThan(PERFORMANCE_BUDGETS.logFlow)

      // Step 4: Verify Dashboard Updates
      await element(by.id('dashboard-tab')).tap()

      // Check that macro rings show data
      await expect(element(by.id('calories-consumed'))).toBeVisible()
      await expect(element(by.id('protein-progress-bar'))).toBeVisible()
      await expect(element(by.id('carbs-progress-bar'))).toBeVisible()
      await expect(element(by.id('fat-progress-bar'))).toBeVisible()

      // Verify actual consumption values are non-zero
      const caloriesElement = await element(by.id('calories-consumed')).getAttributes()
      expect(parseInt(caloriesElement.text || '0')).toBeGreaterThan(0)

      // Total onboarding + first log should be under 30 seconds
      const totalTime = Date.now() - startTime
      expect(totalTime).toBeLessThan(30000)

      // Step 5: Verify Data Persistence
      await device.reloadReactNative()
      await element(by.id('dashboard-tab')).tap()

      // Data should persist after app reload
      await expect(element(by.id('calories-consumed'))).toBeVisible()
      const persistedCaloriesElement = await element(by.id('calories-consumed')).getAttributes()
      expect(parseInt(persistedCaloriesElement.text || '0')).toBeGreaterThan(0)
    })
  })

  describe('Power User Daily Workflow', () => {
    it('should handle heavy daily usage efficiently', async () => {
      const meals = [
        { name: 'steel cut oatmeal with blueberries', mealType: 'breakfast', expectedCalories: 200 },
        { name: 'quinoa mediterranean salad', mealType: 'lunch', expectedCalories: 400 },
        { name: 'grilled salmon with roasted vegetables', mealType: 'dinner', expectedCalories: 500 },
        { name: 'raw almonds', mealType: 'snack', expectedCalories: 150 }
      ]

      let totalCalories = 0

      for (const meal of meals) {
        const mealStartTime = Date.now()

        // Navigate to food search
        await element(by.id('food-search-tab')).tap()

        // Clear and enter search term
        await element(by.id('food-search-input')).clearText()
        await element(by.id('food-search-input')).typeText(meal.name)

        // Wait for search results
        await waitFor(element(by.id('search-results')))
          .toBeVisible()
          .withTimeout(2000)

        // Select and log food
        await element(by.id('food-result-0')).tap()
        await waitFor(element(by.id('food-confirmation-modal')))
          .toBeVisible()
          .withTimeout(1000)

        await element(by.id(`meal-type-${meal.mealType}`)).tap()
        await element(by.id('log-food-button')).tap()

        // Verify success
        await waitFor(element(by.text('Food logged successfully')))
          .toBeVisible()
          .withTimeout(2000)

        // Each meal log should be under 8 seconds
        const mealTime = Date.now() - mealStartTime
        expect(mealTime).toBeLessThan(8000)

        totalCalories += meal.expectedCalories
      }

      // Verify cumulative analytics are updated
      await element(by.id('analytics-tab')).tap()
      await expect(element(by.id('daily-summary-card'))).toBeVisible()
      await expect(element(by.id('macro-breakdown-chart'))).toBeVisible()

      // Check daily totals reflect all meals
      await element(by.id('dashboard-tab')).tap()
      const finalCaloriesElement = await element(by.id('calories-consumed')).getAttributes()
      const finalCalories = parseInt(finalCaloriesElement.text || '0')

      // Should be within reasonable range of expected total
      expect(finalCalories).toBeGreaterThan(totalCalories * 0.8)
      expect(finalCalories).toBeLessThan(totalCalories * 1.2)
    })
  })

  describe('Recipe Creation → Meal Planning → Shopping List', () => {
    it('should complete full recipe and meal planning workflow', async () => {
      // Step 1: Create Custom Recipe
      await element(by.id('recipes-tab')).tap()
      await element(by.id('create-recipe-button')).tap()

      await element(by.id('recipe-name-input')).typeText('Protein Power Bowl')
      await element(by.id('recipe-description-input')).typeText('High protein post-workout meal')
      await element(by.id('recipe-servings-input')).typeText('2')

      // Add quinoa ingredient
      await element(by.id('add-ingredient-button')).tap()
      await element(by.id('ingredient-search-input')).typeText('quinoa cooked')
      await waitFor(element(by.id('ingredient-search-results')))
        .toBeVisible()
        .withTimeout(2000)
      await element(by.id('ingredient-result-0')).tap()
      await element(by.id('ingredient-amount-input')).typeText('100')
      await element(by.id('ingredient-unit-grams')).tap()
      await element(by.id('confirm-ingredient-button')).tap()

      // Add chicken breast ingredient
      await element(by.id('add-ingredient-button')).tap()
      await element(by.id('ingredient-search-input')).clearText()
      await element(by.id('ingredient-search-input')).typeText('chicken breast grilled')
      await waitFor(element(by.id('ingredient-search-results')))
        .toBeVisible()
        .withTimeout(2000)
      await element(by.id('ingredient-result-0')).tap()
      await element(by.id('ingredient-amount-input')).clearText()
      await element(by.id('ingredient-amount-input')).typeText('200')
      await element(by.id('ingredient-unit-grams')).tap()
      await element(by.id('confirm-ingredient-button')).tap()

      // Add cooking instructions
      await element(by.id('recipe-instructions-input')).typeText('1. Cook quinoa according to package directions\n2. Grill chicken breast until internal temp reaches 165°F\n3. Combine and serve warm')

      // Save recipe
      await element(by.id('save-recipe-button')).tap()
      await waitFor(element(by.text('Recipe saved successfully')))
        .toBeVisible()
        .withTimeout(3000)

      // Step 2: Add to Meal Plan
      await element(by.id('meal-planning-tab')).tap()
      await element(by.id('create-meal-plan-button')).tap()
      await element(by.id('plan-name-input')).typeText('Weekly Test Plan')
      await element(by.id('plan-start-date-picker')).tap()
      // Select current week
      await element(by.id('date-picker-today')).tap()
      await element(by.id('confirm-date-selection')).tap()

      // Add recipe to Monday lunch
      await element(by.id('monday-lunch-slot')).tap()
      await element(by.id('add-recipe-to-plan')).tap()
      await waitFor(element(by.id('recipe-selection-modal')))
        .toBeVisible()
        .withTimeout(2000)
      await element(by.text('Protein Power Bowl')).tap()
      await element(by.id('confirm-add-recipe')).tap()

      // Verify recipe appears in plan
      await expect(element(by.text('Protein Power Bowl'))).toBeVisible()

      // Step 3: Generate Shopping List
      await element(by.id('generate-shopping-list-button')).tap()
      await waitFor(element(by.id('shopping-list-modal')))
        .toBeVisible()
        .withTimeout(3000)

      // Verify ingredients appear in shopping list
      await expect(element(by.text('quinoa'))).toBeVisible()
      await expect(element(by.text('chicken breast'))).toBeVisible()

      // Check quantities are calculated correctly
      const quinoaQuantity = await element(by.id('shopping-item-quinoa-quantity')).getAttributes()
      expect(parseInt(quinoaQuantity.text || '0')).toBeGreaterThan(0)

      // Step 4: Apply Meal Plan
      await element(by.id('close-shopping-list')).tap()
      await element(by.id('apply-meal-plan-button')).tap()
      await element(by.id('confirm-apply-plan')).tap()

      // Wait for plan application
      await waitFor(element(by.text('Meal plan applied successfully')))
        .toBeVisible()
        .withTimeout(5000)

      // Step 5: Verify meal appears in food log
      await element(by.id('food-log-tab')).tap()
      await expect(element(by.text('Protein Power Bowl'))).toBeVisible()

      // Verify nutritional data is calculated
      await element(by.text('Protein Power Bowl')).tap()
      await waitFor(element(by.id('meal-details-modal')))
        .toBeVisible()
        .withTimeout(2000)

      await expect(element(by.id('meal-calories'))).toBeVisible()
      await expect(element(by.id('meal-protein'))).toBeVisible()

      const mealCaloriesElement = await element(by.id('meal-calories')).getAttributes()
      expect(parseInt(mealCaloriesElement.text || '0')).toBeGreaterThan(200)
    })
  })

  describe('Barcode Scanning → Nutrition Analysis', () => {
    it('should scan barcode and provide complete nutrition analysis', async () => {
      await element(by.id('barcode-tab')).tap()

      // Handle camera permissions
      try {
        await element(by.id('grant-camera-permission')).tap()
        await waitFor(element(by.text('Camera access granted')))
          .toBeVisible()
          .withTimeout(3000)
      } catch (error) {
        // Permission might already be granted
      }

      // Use test barcode for consistent testing
      await element(by.id('test-barcode-input')).typeText('073230200939')
      await element(by.id('simulate-scan-button')).tap()

      // Verify product recognition within performance budget
      const lookupStart = Date.now()
      await waitFor(element(by.id('barcode-confirmation-modal')))
        .toBeVisible()
        .withTimeout(5000)

      const lookupTime = Date.now() - lookupStart
      expect(lookupTime).toBeLessThan(3000) // 3 second budget for barcode lookup

      // Verify product information is displayed
      await expect(element(by.id('product-name'))).toBeVisible()
      await expect(element(by.id('nutrition-facts'))).toBeVisible()
      await expect(element(by.id('calories-per-serving'))).toBeVisible()
      await expect(element(by.id('protein-per-serving'))).toBeVisible()

      // Test serving size adjustment and nutrition scaling
      const originalCaloriesElement = await element(by.id('calories-per-serving')).getAttributes()
      const originalCalories = parseInt(originalCaloriesElement.text || '0')

      await element(by.id('serving-size-input')).clearText()
      await element(by.id('serving-size-input')).typeText('2')

      // Wait for nutrition values to update
      await waitFor(async () => {
        const updatedCaloriesElement = await element(by.id('calories-per-serving')).getAttributes()
        const updatedCalories = parseInt(updatedCaloriesElement.text || '0')
        return updatedCalories === originalCalories * 2
      }).withTimeout(2000)

      // Verify scaling worked correctly
      const scaledCaloriesElement = await element(by.id('calories-per-serving')).getAttributes()
      const scaledCalories = parseInt(scaledCaloriesElement.text || '0')
      expect(scaledCalories).toBe(originalCalories * 2)

      // Complete logging process
      await element(by.id('meal-type-snack')).tap()
      await element(by.id('confirm-barcode-log')).tap()

      // Verify successful logging
      await waitFor(element(by.text('Food logged successfully')))
        .toBeVisible()
        .withTimeout(3000)

      // Verify food appears in dashboard
      await element(by.id('dashboard-tab')).tap()
      await expect(element(by.id('recent-foods-list'))).toBeVisible()

      // Product should appear in recent foods
      const productNameElement = await element(by.id('product-name')).getAttributes()
      await expect(element(by.text(productNameElement.text || ''))).toBeVisible()
    })
  })

  describe('Cross-Platform Features', () => {
    it('should work correctly on iOS', async () => {
      if (device.getPlatform() === 'ios') {
        // Test iOS-specific navigation gestures
        await element(by.id('dashboard-tab')).tap()

        // Test swipe navigation
        await element(by.id('dashboard-scroll-view')).swipeUp()
        await expect(element(by.id('weekly-summary-card'))).toBeVisible()

        await element(by.id('dashboard-scroll-view')).swipeDown()
        await expect(element(by.id('daily-summary-card'))).toBeVisible()

        // Test iOS notification permissions
        await element(by.id('settings-tab')).tap()
        await element(by.id('notification-settings')).tap()

        // Should show iOS-specific permission dialog
        await expect(element(by.text('Allow Notifications'))).toBeVisible()
      }
    })

    it('should work correctly on Android', async () => {
      if (device.getPlatform() === 'android') {
        // Test Android back button behavior
        await element(by.id('recipes-tab')).tap()
        await element(by.id('recipe-result-0')).tap()

        // Navigate to recipe detail
        await waitFor(element(by.id('recipe-detail-screen')))
          .toBeVisible()
          .withTimeout(2000)

        // Test Android back button
        await device.pressBack()
        await expect(element(by.id('recipes-list'))).toBeVisible()

        // Test Android permission handling
        await element(by.id('barcode-tab')).tap()
        await element(by.id('request-camera-permission-android')).tap()

        // Should show Android-specific permission flow
        await expect(element(by.text('Camera Permission Required'))).toBeVisible()
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle network failures gracefully', async () => {
      // Simulate network disconnection
      await device.setNetworkConnection(false)

      await element(by.id('food-search-tab')).tap()
      await element(by.id('food-search-input')).typeText('apple')

      // Should show offline message
      await waitFor(element(by.text('Offline - showing cached results')))
        .toBeVisible()
        .withTimeout(3000)

      // Should still show cached food results
      await expect(element(by.id('cached-food-results'))).toBeVisible()

      // Restore network connection
      await device.setNetworkConnection(true)

      // Should sync pending changes
      await waitFor(element(by.text('Syncing pending changes...')))
        .toBeVisible()
        .withTimeout(5000)
    })

    it('should handle invalid data inputs', async () => {
      await element(by.id('profile-setup-tab')).tap()

      // Test invalid weight
      await element(by.id('weight-input')).typeText('0')
      await element(by.id('save-profile-button')).tap()
      await expect(element(by.text('Please enter a valid weight'))).toBeVisible()

      // Test invalid height
      await element(by.id('weight-input')).clearText()
      await element(by.id('weight-input')).typeText('70')
      await element(by.id('height-input')).typeText('-5')
      await element(by.id('save-profile-button')).tap()
      await expect(element(by.text('Please enter a valid height'))).toBeVisible()

      // Test valid inputs work
      await element(by.id('height-input')).clearText()
      await element(by.id('height-input')).typeText('175')
      await element(by.id('age-input')).typeText('30')
      await element(by.id('activity-level-moderate')).tap()
      await element(by.id('save-profile-button')).tap()

      await waitFor(element(by.text('Profile saved successfully')))
        .toBeVisible()
        .withTimeout(2000)
    })
  })
})