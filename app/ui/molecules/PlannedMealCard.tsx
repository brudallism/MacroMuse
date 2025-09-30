// ui/molecules/PlannedMealCard.tsx - Individual planned meal card component
import React from 'react'
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { Icon } from '../atoms/Icon'
import { PlannedMeal } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface PlannedMealCardProps {
  meal: PlannedMeal
  onDragStart: () => void
  onRemove: () => void
  onEdit?: () => void
}

export const PlannedMealCard: React.FC<PlannedMealCardProps> = ({
  meal,
  onDragStart,
  onRemove,
  onEdit
}) => {
  const theme = useTheme()

  const getMealIcon = (): string => {
    return meal.type === 'recipe' ? '📝' : '🥗'
  }

  const formatNutrients = (nutrients: any): string => {
    const calories = nutrients.calories || 0
    const protein = nutrients.protein_g || 0
    const carbs = nutrients.carbs_g || 0
    const fat = nutrients.fat_g || 0

    return `${Math.round(calories)}cal • ${Math.round(protein)}p • ${Math.round(carbs)}c • ${Math.round(fat)}f`
  }

  const handleLongPress = () => {
    Alert.alert(
      meal.name,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move', onPress: onDragStart },
        ...(onEdit ? [{ text: 'Edit', onPress: onEdit }] : []),
        { text: 'Remove', style: 'destructive', onPress: onRemove }
      ]
    )
  }

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={styles.container}
    >
      <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          <Text style={styles.icon}>{getMealIcon()}</Text>
          <View style={styles.content}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {meal.name}
            </Text>
            <Text style={[styles.serving, { color: theme.colors.textSecondary }]}>
              {meal.servings} {meal.unit}{meal.servings !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRemove}
            style={styles.removeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="x" size={14} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.nutrition}>
          <Text style={[styles.nutritionText, { color: theme.colors.textSecondary }]}>
            {formatNutrients(meal.nutrients)}
          </Text>
        </View>

        {meal.type === 'recipe' && (
          <View style={styles.footer}>
            <View style={[styles.recipeBadge, { backgroundColor: theme.colors.primary + '20' }]}>
              <Text style={[styles.recipeBadgeText, { color: theme.colors.primary }]}>
                Recipe
              </Text>
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  card: {
    padding: 8,
    elevation: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
    marginTop: 2,
  },
  content: {
    flex: 1,
    marginRight: 4,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
    lineHeight: 16,
  },
  serving: {
    fontSize: 11,
  },
  removeButton: {
    padding: 2,
  },
  nutrition: {
    marginBottom: 4,
  },
  nutritionText: {
    fontSize: 10,
    lineHeight: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  recipeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recipeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
})