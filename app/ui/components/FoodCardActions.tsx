import React from 'react'
import { View, StyleSheet } from 'react-native'

import { Button } from '@ui/atoms/Button'
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

export interface FoodCardActionsProps {
  food: FoodItem
  variant?: 'search' | 'recent' | 'favorite' | 'custom' | 'barcode'
  showActions?: boolean
  onAddToLog?: (food: FoodItem) => void
  onToggleFavorite?: (food: FoodItem) => void
  onEdit?: (food: FoodItem) => void
  onDelete?: (food: FoodItem) => void
  isSelected?: boolean
}

export const FoodCardActions: React.FC<FoodCardActionsProps> = ({
  food,
  variant = 'search',
  showActions = true,
  onAddToLog,
  onToggleFavorite,
  onEdit,
  onDelete,
  isSelected = false
}) => {
  const theme = useTheme()

  const handleAddToLog = () => {
    onAddToLog?.(food)
  }

  const handleToggleFavorite = () => {
    onToggleFavorite?.(food)
  }

  const handleEdit = () => {
    onEdit?.(food)
  }

  const handleDelete = () => {
    onDelete?.(food)
  }

  if (!showActions) return null

  const showEditDelete = variant === 'custom'
  const showFavorite = variant !== 'favorite'

  return (
    <View style={styles.actionsContainer}>
      {/* Primary Action - Add to Log */}
      <Button
        title={isSelected ? 'Selected' : 'Add to Log'}
        onPress={handleAddToLog}
        variant={isSelected ? 'secondary' : 'primary'}
        size="small"
        style={[
          styles.actionButton,
          styles.primaryAction,
          { backgroundColor: isSelected ? theme.colors.gray[200] : theme.colors.primary[500] }
        ]}
        disabled={!onAddToLog}
      />

      {/* Secondary Actions */}
      <View style={styles.secondaryActions}>
        {showFavorite && onToggleFavorite && (
          <Button
            title={food.isFavorite ? '♥' : '♡'}
            onPress={handleToggleFavorite}
            variant="ghost"
            size="small"
            style={[
              styles.actionButton,
              styles.iconButton,
              {
                backgroundColor: food.isFavorite
                  ? theme.colors.error[50]
                  : 'transparent'
              }
            ]}
          />
        )}

        {showEditDelete && (
          <>
            {onEdit && (
              <Button
                title="✏️"
                onPress={handleEdit}
                variant="ghost"
                size="small"
                style={[styles.actionButton, styles.iconButton]}
              />
            )}
            {onDelete && (
              <Button
                title="🗑️"
                onPress={handleDelete}
                variant="ghost"
                size="small"
                style={[styles.actionButton, styles.iconButton]}
              />
            )}
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E7E3DD', // theme.colors.gray[200]
  },
  actionButton: {
    minHeight: 36,
  },
  primaryAction: {
    flex: 1,
    marginRight: 8,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    paddingHorizontal: 0,
  },
})