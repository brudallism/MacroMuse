// ui/molecules/DayColumn.tsx - Single day column for meal planning
import React from 'react'
import { View, StyleSheet, TouchableOpacity } from 'react-native'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { Button } from '../atoms/Button'
import { Icon } from '../atoms/Icon'
import { MacroRing } from './MacroRing'
import { PlannedMealCard } from './PlannedMealCard'
import {
  DayMealPlan,
  PlannedMeal,
  NutrientVector,
  TargetVector
} from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface DayColumnProps {
  day: DayMealPlan
  dayName: string
  date: Date
  dayIndex: number
  onDragStart: (meal: PlannedMeal) => void
  onDrop: (mealType: string) => void
  onMealAdd: (mealType: string) => void
  onMealRemove: (mealId: string) => void
  isDraggedOver: boolean
  width: number
}

interface MealSectionProps {
  title: string
  meals: PlannedMeal[]
  mealType: string
  onDragStart: (meal: PlannedMeal) => void
  onDrop: (mealType: string) => void
  onMealAdd: (mealType: string) => void
  onMealRemove: (mealId: string) => void
  isDraggedOver: boolean
}

const MealSection: React.FC<MealSectionProps> = ({
  title,
  meals,
  mealType,
  onDragStart,
  onDrop,
  onMealAdd,
  onMealRemove,
  isDraggedOver
}) => {
  const theme = useTheme()

  const getMealIcon = (type: string): string => {
    switch (type) {
      case 'breakfast': return '☀️'
      case 'lunch': return '🌞'
      case 'dinner': return '🌙'
      case 'snacks': return '🍎'
      default: return '🍽️'
    }
  }

  return (
    <View style={[
      styles.mealSection,
      isDraggedOver && { backgroundColor: theme.colors.primary + '10' }
    ]}>
      <View style={styles.mealHeader}>
        <Text style={[styles.mealHeaderIcon, { color: theme.colors.text }]}>
          {getMealIcon(mealType)}
        </Text>
        <Text style={[styles.mealTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <TouchableOpacity
          onPress={() => onMealAdd(mealType)}
          style={styles.addButton}
        >
          <Icon name="plus" size={16} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.mealsList}>
        {meals.length === 0 ? (
          <TouchableOpacity
            onPress={() => onMealAdd(mealType)}
            style={[styles.emptyMealSlot, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.emptyMealText, { color: theme.colors.textSecondary }]}>
              Tap to add meal
            </Text>
          </TouchableOpacity>
        ) : (
          meals.map((meal) => (
            <PlannedMealCard
              key={meal.id}
              meal={meal}
              onDragStart={() => onDragStart(meal)}
              onRemove={() => onMealRemove(meal.id)}
            />
          ))
        )}
      </View>
    </View>
  )
}

export const DayColumn: React.FC<DayColumnProps> = ({
  day,
  dayName,
  date,
  dayIndex,
  onDragStart,
  onDrop,
  onMealAdd,
  onMealRemove,
  isDraggedOver,
  width
}) => {
  const theme = useTheme()

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    })
  }

  const calculateNutrientPercentage = (
    current: number | undefined,
    target: number | undefined
  ): number => {
    if (!current || !target || target <= 0) return 0
    return Math.min((current / target) * 100, 100)
  }

  const macroPercentages = {
    calories: calculateNutrientPercentage(
      day.plannedNutrients.calories,
      day.targetNutrients.calories
    ),
    protein: calculateNutrientPercentage(
      day.plannedNutrients.protein_g,
      day.targetNutrients.protein_g
    ),
    carbs: calculateNutrientPercentage(
      day.plannedNutrients.carbs_g,
      day.targetNutrients.carbs_g
    ),
    fat: calculateNutrientPercentage(
      day.plannedNutrients.fat_g,
      day.targetNutrients.fat_g
    )
  }

  const isToday = date.toDateString() === new Date().toDateString()

  return (
    <Card style={[
      styles.dayColumn,
      { width },
      isToday && { borderColor: theme.colors.primary, borderWidth: 2 }
    ]}>
      {/* Day Header */}
      <View style={styles.dayHeader}>
        <View style={styles.dayInfo}>
          <Text style={[
            styles.dayName,
            { color: isToday ? theme.colors.primary : theme.colors.text }
          ]}>
            {dayName}
          </Text>
          <Text style={[styles.dayDate, { color: theme.colors.textSecondary }]}>
            {formatDate(date)}
          </Text>
        </View>
        {isToday && (
          <View style={[styles.todayBadge, { backgroundColor: theme.colors.primary }]}>
            <Text style={[styles.todayText, { color: theme.colors.surface }]}>
              Today
            </Text>
          </View>
        )}
      </View>

      {/* Nutrition Progress */}
      <View style={styles.nutritionSection}>
        <MacroRing
          current={{
            calories: day.plannedNutrients.calories || 0,
            protein: day.plannedNutrients.protein_g || 0,
            carbs: day.plannedNutrients.carbs_g || 0,
            fat: day.plannedNutrients.fat_g || 0
          }}
          target={{
            calories: day.targetNutrients.calories,
            protein: day.targetNutrients.protein_g,
            carbs: day.targetNutrients.carbs_g,
            fat: day.targetNutrients.fat_g
          }}
          size={60}
          showLabels={false}
        />
        <Text style={[styles.nutritionText, { color: theme.colors.textSecondary }]}>
          {Math.round(day.plannedNutrients.calories || 0)} / {day.targetNutrients.calories} cal
        </Text>
      </View>

      {/* Meal Sections */}
      <View style={styles.mealsContainer}>
        <MealSection
          title="Breakfast"
          meals={day.meals.breakfast}
          mealType="breakfast"
          onDragStart={onDragStart}
          onDrop={onDrop}
          onMealAdd={onMealAdd}
          onMealRemove={onMealRemove}
          isDraggedOver={isDraggedOver}
        />

        <MealSection
          title="Lunch"
          meals={day.meals.lunch}
          mealType="lunch"
          onDragStart={onDragStart}
          onDrop={onDrop}
          onMealAdd={onMealAdd}
          onMealRemove={onMealRemove}
          isDraggedOver={isDraggedOver}
        />

        <MealSection
          title="Dinner"
          meals={day.meals.dinner}
          mealType="dinner"
          onDragStart={onDragStart}
          onDrop={onDrop}
          onMealAdd={onMealAdd}
          onMealRemove={onMealRemove}
          isDraggedOver={isDraggedOver}
        />

        <MealSection
          title="Snacks"
          meals={day.meals.snacks}
          mealType="snacks"
          onDragStart={onDragStart}
          onDrop={onDrop}
          onMealAdd={onMealAdd}
          onMealRemove={onMealRemove}
          isDraggedOver={isDraggedOver}
        />
      </View>

      {/* Day Summary */}
      <View style={styles.daySummary}>
        <Text style={[styles.summaryText, { color: theme.colors.textSecondary }]}>
          {day.meals.breakfast.length + day.meals.lunch.length +
           day.meals.dinner.length + day.meals.snacks.length} meals planned
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  dayColumn: {
    marginHorizontal: 8,
    marginVertical: 8,
    padding: 12,
    minHeight: 600,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 14,
  },
  todayBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nutritionSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  nutritionText: {
    fontSize: 12,
    marginTop: 4,
  },
  mealsContainer: {
    flex: 1,
  },
  mealSection: {
    marginBottom: 16,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealHeaderIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  addButton: {
    padding: 4,
  },
  mealsList: {
    gap: 6,
  },
  emptyMealSlot: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  emptyMealText: {
    fontSize: 12,
  },
  daySummary: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 12,
  },
})