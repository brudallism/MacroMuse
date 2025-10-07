// ui/organisms/WeeklyPlanGrid.tsx - Weekly meal planning grid with drag & drop
import React, { useState } from 'react'
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native'

import { DayColumn } from '../molecules/DayColumn'
import { AddMealModal } from '../molecules/AddMealModal'
import {
  WeeklyMealPlan,
  PlannedMeal,
  RecipeData,
  FoodItem
} from '../../domain/models'
import { calculateDayNutrients } from '../../domain/services/plans'
import { useTheme } from '../theme/ThemeProvider'

const { width: screenWidth } = Dimensions.get('window')
const DAY_COLUMN_WIDTH = Math.max(screenWidth / 4, 300) // Minimum 300px per column

interface WeeklyPlanGridProps {
  plan: WeeklyMealPlan
  onMealMove: (meal: PlannedMeal, targetDay: number, targetMealType: string) => void
  onMealAdd: (dayIndex: number, mealType: string, item: RecipeData | FoodItem) => void
  onMealRemove: (mealId: string) => void
  recipes: RecipeData[]
  foods: FoodItem[]
}

export const WeeklyPlanGrid: React.FC<WeeklyPlanGridProps> = ({
  plan,
  onMealMove,
  onMealAdd,
  onMealRemove,
  recipes,
  foods
}) => {
  const theme = useTheme()
  const [draggedMeal, setDraggedMeal] = useState<PlannedMeal | null>(null)
  const [showAddMeal, setShowAddMeal] = useState(false)
  const [addMealContext, setAddMealContext] = useState<{
    dayIndex: number
    mealType: string
  } | null>(null)

  const handleDragStart = (meal: PlannedMeal) => {
    setDraggedMeal(meal)
  }

  const handleDrop = (targetDay: number, targetMealType: string) => {
    if (draggedMeal) {
      onMealMove(draggedMeal, targetDay, targetMealType)
      setDraggedMeal(null)
    }
  }

  const handleMealAddPress = (dayIndex: number, mealType: string) => {
    setAddMealContext({ dayIndex, mealType })
    setShowAddMeal(true)
  }

  const handleAddMealConfirm = (item: RecipeData | FoodItem) => {
    if (addMealContext) {
      onMealAdd(addMealContext.dayIndex, addMealContext.mealType, item)
      setShowAddMeal(false)
      setAddMealContext(null)
    }
  }

  const handleAddMealCancel = () => {
    setShowAddMeal(false)
    setAddMealContext(null)
  }

  // Calculate planned nutrients for each day
  const daysWithCalculatedNutrients = plan.days.map(day => ({
    ...day,
    plannedNutrients: calculateDayNutrients(day)
  }))

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.scrollContent}
      >
        {daysWithCalculatedNutrients.map((day, dayIndex) => {
          const dayName = dayNames[dayIndex]
          const date = new Date(day.date)

          return (
            <DayColumn
              key={day.date}
              day={day}
              dayName={dayName}
              date={date}
              dayIndex={dayIndex}
              onDragStart={handleDragStart}
              onDrop={(mealType) => handleDrop(dayIndex, mealType)}
              onMealAdd={(mealType) => handleMealAddPress(dayIndex, mealType)}
              onMealRemove={onMealRemove}
              isDraggedOver={false} // Would implement actual drag over detection
              width={DAY_COLUMN_WIDTH}
            />
          )
        })}
      </ScrollView>

      {/* Add Meal Modal */}
      {showAddMeal && addMealContext && (
        <AddMealModal
          visible={showAddMeal}
          onClose={handleAddMealCancel}
          onAddMeal={handleAddMealConfirm}
          recipes={recipes}
          foods={foods}
          mealType={addMealContext.mealType}
          dayName={dayNames[addMealContext.dayIndex]}
        />
      )}

      {/* Drag Preview */}
      {draggedMeal && (
        <View style={[styles.dragPreview, { backgroundColor: theme.colors.primary + '20' }]}>
          {/* Drag preview would be implemented with gesture libraries */}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  horizontalScroll: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  dragPreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
})