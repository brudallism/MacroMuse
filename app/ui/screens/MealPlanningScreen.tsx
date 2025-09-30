// ui/screens/MealPlanningScreen.tsx - Weekly meal planning interface
import React, { useState, useCallback, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { Text } from '../atoms/Text'
import { Button } from '../atoms/Button'
import { LoadingSpinner } from '../atoms/LoadingSpinner'
import { WeeklyPlanGrid } from '../organisms/WeeklyPlanGrid'
import { MealPlanningToolbar } from '../molecules/MealPlanningToolbar'
import { ShoppingListModal } from '../molecules/ShoppingListModal'
import {
  WeeklyMealPlan,
  PlannedMeal,
  TargetVector,
  RecipeData,
  FoodItem
} from '../../domain/models'
import {
  createEmptyWeekPlan,
  validateMealPlan,
  generateShoppingList
} from '../../domain/services/plans'
import { useTheme } from '../theme/ThemeProvider'

interface MealPlanningScreenProps {
  userId: string
  userTargets: TargetVector
  onSavePlan?: (plan: WeeklyMealPlan) => Promise<void>
  onApplyToLedger?: (planId: string) => Promise<void>
  existingPlan?: WeeklyMealPlan
  recipes?: RecipeData[]
  foods?: FoodItem[]
}

export const MealPlanningScreen: React.FC<MealPlanningScreenProps> = ({
  userId,
  userTargets,
  onSavePlan,
  onApplyToLedger,
  existingPlan,
  recipes = [],
  foods = []
}) => {
  const theme = useTheme()
  const [currentPlan, setCurrentPlan] = useState<WeeklyMealPlan>(() => {
    if (existingPlan) {
      return existingPlan
    }

    // Create new plan starting from next Monday
    const today = new Date()
    const daysUntilMonday = (1 + 7 - today.getDay()) % 7 || 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + daysUntilMonday)

    const emptyPlan = createEmptyWeekPlan(
      nextMonday.toISOString().split('T')[0],
      userId,
      userTargets
    )

    return {
      ...emptyPlan,
      id: `plan_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })

  const [isLoading, setIsLoading] = useState(false)
  const [showShoppingList, setShowShoppingList] = useState(false)
  const [draggedMeal, setDraggedMeal] = useState<PlannedMeal | null>(null)

  // Handle meal drag and drop
  const handleMealMove = useCallback((
    meal: PlannedMeal,
    targetDay: number,
    targetMealType: string
  ) => {
    setCurrentPlan(prev => {
      const updatedDays = [...prev.days]

      // Remove meal from its current position
      updatedDays.forEach(day => {
        Object.keys(day.meals).forEach(mealType => {
          day.meals[mealType as keyof typeof day.meals] =
            day.meals[mealType as keyof typeof day.meals].filter(m => m.id !== meal.id)
        })
      })

      // Add meal to new position
      const targetDayData = updatedDays[targetDay]
      if (targetDayData && targetDayData.meals[targetMealType as keyof typeof targetDayData.meals]) {
        targetDayData.meals[targetMealType as keyof typeof targetDayData.meals].push(meal)
      }

      return {
        ...prev,
        days: updatedDays,
        updatedAt: new Date().toISOString()
      }
    })
  }, [])

  // Handle adding new meal to plan
  const handleMealAdd = useCallback((
    dayIndex: number,
    mealType: string,
    item: RecipeData | FoodItem
  ) => {
    const isRecipe = 'ingredients' in item

    let plannedMeal: PlannedMeal
    if (isRecipe) {
      const recipe = item as RecipeData
      plannedMeal = {
        id: `planned_${Date.now()}`,
        type: 'recipe',
        recipeId: recipe.id,
        name: recipe.name,
        servings: 1,
        unit: 'serving',
        nutrients: recipe.nutrients
      }
    } else {
      const food = item as FoodItem
      plannedMeal = {
        id: `planned_${Date.now()}`,
        type: 'food',
        foodId: food.id,
        name: food.name,
        servings: 1,
        unit: food.servingSize.unit,
        nutrients: food.nutrients
      }
    }

    setCurrentPlan(prev => {
      const updatedDays = [...prev.days]
      const targetDay = updatedDays[dayIndex]

      if (targetDay && targetDay.meals[mealType as keyof typeof targetDay.meals]) {
        targetDay.meals[mealType as keyof typeof targetDay.meals].push(plannedMeal)
      }

      return {
        ...prev,
        days: updatedDays,
        updatedAt: new Date().toISOString()
      }
    })
  }, [])

  // Handle meal removal
  const handleMealRemove = useCallback((mealId: string) => {
    Alert.alert(
      'Remove Meal',
      'Are you sure you want to remove this meal from your plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCurrentPlan(prev => {
              const updatedDays = prev.days.map(day => ({
                ...day,
                meals: {
                  breakfast: day.meals.breakfast.filter(m => m.id !== mealId),
                  lunch: day.meals.lunch.filter(m => m.id !== mealId),
                  dinner: day.meals.dinner.filter(m => m.id !== mealId),
                  snacks: day.meals.snacks.filter(m => m.id !== mealId)
                }
              }))

              return {
                ...prev,
                days: updatedDays,
                updatedAt: new Date().toISOString()
              }
            })
          }
        }
      ]
    )
  }, [])

  // Handle save plan
  const handleSavePlan = useCallback(async () => {
    const errors = validateMealPlan(currentPlan)
    if (errors.length > 0) {
      Alert.alert('Validation Error', errors.join('\n'))
      return
    }

    setIsLoading(true)
    try {
      await onSavePlan?.(currentPlan)
      Alert.alert('Success', 'Meal plan saved successfully!')
    } catch (error) {
      console.error('Error saving meal plan:', error)
      Alert.alert('Error', 'Failed to save meal plan. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [currentPlan, onSavePlan])

  // Handle apply to ledger
  const handleApplyToLedger = useCallback(async () => {
    if (!currentPlan.id) {
      Alert.alert('Error', 'Please save the meal plan first.')
      return
    }

    Alert.alert(
      'Apply Meal Plan',
      'This will add all planned meals to your food log. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            setIsLoading(true)
            try {
              await onApplyToLedger?.(currentPlan.id)
              Alert.alert('Success', 'Meal plan applied to your food log!')
            } catch (error) {
              console.error('Error applying meal plan:', error)
              Alert.alert('Error', 'Failed to apply meal plan. Please try again.')
            } finally {
              setIsLoading(false)
            }
          }
        }
      ]
    )
  }, [currentPlan.id, onApplyToLedger])

  // Generate shopping list
  const handleGenerateShoppingList = useCallback(() => {
    setShowShoppingList(true)
  }, [])

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)

    const startFormatted = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
    const endFormatted = end.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })

    return `${startFormatted} - ${endFormatted}`
  }

  const getTotalMealsPlanned = (): number => {
    return currentPlan.days.reduce((total, day) => {
      return total +
        day.meals.breakfast.length +
        day.meals.lunch.length +
        day.meals.dinner.length +
        day.meals.snacks.length
    }, 0)
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <LoadingSpinner size="large" />
        <Text style={[styles.loadingText, { color: theme.colors.text }]}>
          Processing meal plan...
        </Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Weekly Meal Plan
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {formatDateRange(currentPlan.startDate, currentPlan.endDate)}
          </Text>
        </View>
        <View style={styles.headerStats}>
          <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
            {getTotalMealsPlanned()} meals planned
          </Text>
        </View>
      </View>

      {/* Toolbar */}
      <MealPlanningToolbar
        onSave={handleSavePlan}
        onApplyToLedger={handleApplyToLedger}
        onGenerateShoppingList={handleGenerateShoppingList}
        hasUnsavedChanges={currentPlan.updatedAt !== currentPlan.createdAt}
        disabled={isLoading}
      />

      {/* Weekly Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <WeeklyPlanGrid
          plan={currentPlan}
          onMealMove={handleMealMove}
          onMealAdd={handleMealAdd}
          onMealRemove={handleMealRemove}
          recipes={recipes}
          foods={foods}
        />
      </ScrollView>

      {/* Shopping List Modal */}
      {showShoppingList && (
        <ShoppingListModal
          visible={showShoppingList}
          onClose={() => setShowShoppingList(false)}
          shoppingItems={generateShoppingList(currentPlan, recipes)}
          planName={`Week of ${formatDateRange(currentPlan.startDate, currentPlan.endDate)}`}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  statsText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
})