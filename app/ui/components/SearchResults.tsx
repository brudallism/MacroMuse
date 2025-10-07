import React from 'react'
import { View, StyleSheet } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { VirtualizedFoodList } from '@ui/components/VirtualizedFoodList'
import { useTheme } from '@ui/theme/ThemeProvider'

interface FoodNutrients {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  saturated_fat_g?: number
}

interface FoodServingSize {
  amount: number
  unit: string
}

interface FoodItem {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'custom' | 'barcode'
  nutrients: FoodNutrients
  servingSize: FoodServingSize
  confidence?: number
  isFavorite?: boolean
}

interface SearchResultsProps {
  foods: FoodItem[]
  loading: boolean
  emptyStateText: string
  onFoodPress: (food: FoodItem) => void
  onAddToLog: (food: FoodItem) => void
  onToggleFavorite: (food: FoodItem) => void
  onEditCustomFood?: (food: FoodItem) => void
  onDeleteCustomFood?: (food: FoodItem) => void
  currentMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  onCalculatePortion?: (nutrients: FoodNutrients, baseServing: number, newServing: number, baseUnit: string, newUnit: string) => FoodNutrients
  onSuggestMealType?: (foodName: string, mealType: string) => 'excellent' | 'good' | 'fair' | 'poor'
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  foods,
  loading,
  emptyStateText,
  onFoodPress,
  onAddToLog,
  onToggleFavorite,
  onEditCustomFood,
  onDeleteCustomFood,
  currentMealType,
  onCalculatePortion,
  onSuggestMealType
}) => {
  const theme = useTheme()

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="secondary">Loading...</Text>
      </View>
    )
  }

  if (foods.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="secondary" style={styles.emptyText}>
          {emptyStateText}
        </Text>
      </View>
    )
  }

  return (
    <VirtualizedFoodList
      foods={foods}
      onFoodPress={onFoodPress}
      onAddToLog={onAddToLog}
      onToggleFavorite={onToggleFavorite}
      onEditCustomFood={onEditCustomFood}
      onDeleteCustomFood={onDeleteCustomFood}
      showMealSuitability={!!currentMealType}
      currentMealType={currentMealType}
      onCalculatePortion={onCalculatePortion}
      onSuggestMealType={onSuggestMealType}
    />
  )
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    textAlign: 'center',
    lineHeight: 24,
  },
})