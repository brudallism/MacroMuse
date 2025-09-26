import React, { useState, useMemo } from 'react'
import { View, StyleSheet, Pressable } from 'react-native'
import { Text } from '@ui/atoms/Text'
import { Card } from '@ui/atoms/Card'
import { Badge } from '@ui/atoms/Badge'
import { FoodCardActions } from '@ui/components/FoodCardActions'
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

export interface FoodCardProps {
  food: FoodItem
  variant?: 'search' | 'recent' | 'favorite' | 'custom' | 'barcode'
  showNutrition?: boolean
  showServingSize?: boolean
  showMealSuitability?: boolean
  showActions?: boolean
  onPress?: (food: FoodItem) => void
  onAddToLog?: (food: FoodItem) => void
  onToggleFavorite?: (food: FoodItem) => void
  onEdit?: (food: FoodItem) => void
  onDelete?: (food: FoodItem) => void
  isSelected?: boolean
  currentMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  servingAmount?: number
  servingUnit?: string
  onCalculatePortion?: (nutrients: FoodNutrients, baseServing: number, newServing: number, baseUnit: string, newUnit: string) => FoodNutrients
  onSuggestMealType?: (foodName: string, mealType: string) => 'excellent' | 'good' | 'fair' | 'poor'
}

export const FoodCard: React.FC<FoodCardProps> = ({
  food,
  variant = 'search',
  showNutrition = true,
  showServingSize = true,
  showMealSuitability = false,
  showActions = true,
  onPress,
  onAddToLog,
  onToggleFavorite,
  onEdit,
  onDelete,
  isSelected = false,
  currentMealType,
  servingAmount,
  servingUnit,
  onCalculatePortion,
  onSuggestMealType
}) => {
  const theme = useTheme()
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate nutrients for current serving size if different from base
  const displayNutrients = useMemo(() => {
    // Defensive check for nutrients
    if (!food.nutrients) {
      return {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0
      }
    }

    if (!servingAmount || !servingUnit ||
        (servingAmount === food.servingSize.amount && servingUnit === food.servingSize.unit)) {
      return food.nutrients
    }

    if (onCalculatePortion) {
      try {
        const result = onCalculatePortion(
          food.nutrients,
          food.servingSize.amount,
          servingAmount,
          food.servingSize.unit,
          servingUnit
        )
        // Ensure result has required properties
        return result || food.nutrients
      } catch (error) {
        console.warn('Error calculating portion:', error)
        return food.nutrients
      }
    }

    return food.nutrients
  }, [food.nutrients, food.servingSize, servingAmount, servingUnit, onCalculatePortion])

  // Calculate meal suitability if requested
  const mealSuitability = useMemo(() => {
    if (!showMealSuitability || !currentMealType || !onSuggestMealType) return null
    return onSuggestMealType(food.name, currentMealType)
  }, [food.name, currentMealType, showMealSuitability, onSuggestMealType])

  const handlePress = () => {
    if (onPress) {
      onPress(food)
    } else {
      setIsExpanded(!isExpanded)
    }
  }

  const getSourceBadgeColor = (): string => {
    switch (food.source) {
      case 'usda': return theme.colors.primary
      case 'spoonacular': return theme.colors.secondary
      case 'barcode': return theme.colors.warning
      case 'custom': return theme.colors.success
      default: return theme.colors.gray[500]
    }
  }

  const getVariantBadgeText = (): string | null => {
    switch (variant) {
      case 'recent': return 'Recent'
      case 'favorite': return 'Favorite'
      case 'custom': return 'Custom'
      case 'barcode': return 'Scanned'
      default: return null
    }
  }

  const getMealSuitabilityColor = (): string => {
    if (!mealSuitability) return theme.colors.gray[500]

    switch (mealSuitability) {
      case 'excellent': return theme.colors.success
      case 'good': return theme.colors.primary
      case 'fair': return theme.colors.warning
      case 'poor': return theme.colors.error
      default: return theme.colors.gray[500]
    }
  }

  const formatNutrient = (value: number | undefined, unit: string): string => {
    if (value === undefined || value === null) return '--'
    return `${value}${unit}`
  }

  const renderNutritionSummary = () => {
    if (!showNutrition) return null

    return (
      <View style={styles.nutritionSummary}>
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.colors.text.primary }]}>
              {formatNutrient(displayNutrients.calories, '')}
            </Text>
            <Text style={[styles.macroLabel, { color: theme.colors.text.secondary }]}>
              cal
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.colors.text.primary }]}>
              {formatNutrient(displayNutrients.protein_g, 'g')}
            </Text>
            <Text style={[styles.macroLabel, { color: theme.colors.text.secondary }]}>
              protein
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.colors.text.primary }]}>
              {formatNutrient(displayNutrients.carbs_g, 'g')}
            </Text>
            <Text style={[styles.macroLabel, { color: theme.colors.text.secondary }]}>
              carbs
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: theme.colors.text.primary }]}>
              {formatNutrient(displayNutrients.fat_g, 'g')}
            </Text>
            <Text style={[styles.macroLabel, { color: theme.colors.text.secondary }]}>
              fat
            </Text>
          </View>
        </View>
      </View>
    )
  }

  const renderServingInfo = () => {
    if (!showServingSize) return null

    const currentServing = servingAmount && servingUnit
      ? `${servingAmount}${servingUnit}`
      : `${food.servingSize.amount}${food.servingSize.unit}`

    return (
      <View style={styles.servingInfo}>
        <Text style={[styles.servingText, { color: theme.colors.text.secondary }]}>
          Per {currentServing}
        </Text>
        {food.confidence && (
          <Badge
            text={`${Math.round(food.confidence * 100)}% match`}
            color={food.confidence > 0.8 ? theme.colors.success : theme.colors.warning}
            size="small"
          />
        )}
      </View>
    )
  }

  const renderMealSuitability = () => {
    if (!showMealSuitability || !mealSuitability || !currentMealType) return null

    return (
      <View style={styles.mealSuitability}>
        <Badge
          text={`${mealSuitability} for ${currentMealType}`}
          color={getMealSuitabilityColor()}
          size="small"
        />
      </View>
    )
  }

  return (
    <Card style={[styles.container, isSelected && styles.selectedCard]}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        {/* Header Row */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text variant="body" weight="medium" style={styles.foodName}>
              {food.name}
            </Text>
            {food.brand && (
              <Text variant="caption" color="secondary" style={styles.brandName}>
                {food.brand}
              </Text>
            )}
          </View>

          <View style={styles.badges}>
            {getVariantBadgeText() && (
              <Badge
                text={getVariantBadgeText()!}
                color={theme.colors.gray[400]}
                size="small"
              />
            )}
            <Badge
              text={food.source.toUpperCase()}
              color={getSourceBadgeColor()}
              size="small"
            />
          </View>
        </View>

        {/* Serving Size Info */}
        {renderServingInfo()}

        {/* Nutrition Summary */}
        {renderNutritionSummary()}

        {/* Meal Suitability */}
        {renderMealSuitability()}

        {/* Actions */}
        <FoodCardActions
          food={food}
          variant={variant}
          showActions={showActions}
          onAddToLog={onAddToLog}
          onToggleFavorite={onToggleFavorite}
          onEdit={onEdit}
          onDelete={onDelete}
          isSelected={isSelected}
        />
      </Pressable>
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#213529', // theme.colors.primary[500]
  },
  pressable: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 2,
  },
  brandName: {
    fontSize: 12,
    lineHeight: 16,
  },
  badges: {
    flexDirection: 'row',
    gap: 4,
  },
  servingInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  servingText: {
    fontSize: 12,
    lineHeight: 16,
  },
  nutritionSummary: {
    marginBottom: 8,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  macroLabel: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  mealSuitability: {
    alignItems: 'flex-start',
    marginBottom: 8,
  },
})