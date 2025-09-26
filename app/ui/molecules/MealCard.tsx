// app/ui/molecules/MealCard.tsx - Pure presentational meal card component
// Foundation.md compliant, extracted from legacy MealCard.tsx

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

import { tokens } from '../theme/tokens'

export interface MealData {
  id: string
  food_name: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  calories: number
  protein: number
  carbs: number
  fat: number
  logged_at: string
  quantity_grams?: number
  notes?: string
  ai_confidence?: number
  user_confirmed?: boolean
}

export interface MealCardProps {
  meal: MealData
  onPress?: () => void
  variant?: 'default' | 'compact' | 'detailed'
  showDetails?: boolean
}

export function MealCard({
  meal,
  onPress,
  variant = 'default',
  showDetails = true,
}: MealCardProps): JSX.Element {
  const mealTypeColor = tokens.colors.mealTypes[meal.meal_type]

  const formatMacros = () => {
    if (variant === 'compact') {
      return `${Math.round(meal.calories)} cal`
    }
    return `${Math.round(meal.calories)} cal • ${Math.round(meal.protein)}g protein • ${Math.round(meal.carbs)}g carbs • ${Math.round(meal.fat)}g fat`
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatMealType = (mealType: string) => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1)
  }

  const cardStyle = [
    styles.card,
    variant === 'compact' && styles.compactCard,
    { borderLeftColor: mealTypeColor }
  ]

  const CardContent = (
    <View style={cardStyle}>
      {/* Header with meal name and type */}
      <View style={styles.header}>
        <Text
          style={[
            styles.mealName,
            variant === 'compact' && styles.compactMealName
          ]}
          numberOfLines={1}
        >
          {meal.food_name}
        </Text>

        <View style={styles.mealTypeContainer}>
          <Text style={[styles.mealType, { color: mealTypeColor }]}>
            {formatMealType(meal.meal_type)}
          </Text>
        </View>
      </View>

      {/* Macros (optional) */}
      {showDetails && (
        <Text style={[
          styles.macros,
          variant === 'compact' && styles.compactMacros
        ]}>
          {formatMacros()}
        </Text>
      )}

      {/* Footer with time and additional info */}
      <View style={styles.footer}>
        <Text style={styles.time}>
          {formatTime(meal.logged_at)}
        </Text>

        {/* AI confidence indicator for detailed variant */}
        {variant === 'detailed' && meal.ai_confidence && meal.ai_confidence < 1.0 && (
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceText}>
              AI: {Math.round(meal.ai_confidence * 100)}%
            </Text>
            {!meal.user_confirmed && (
              <View style={styles.unconfirmedIndicator} />
            )}
          </View>
        )}

        {/* Quantity */}
        {meal.quantity_grams && (
          <Text style={styles.quantity}>
            {meal.quantity_grams}g
          </Text>
        )}
      </View>

      {/* Notes for detailed variant */}
      {variant === 'detailed' && meal.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          💭 {meal.notes}
        </Text>
      )}
    </View>
  )

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    )
  }

  return CardContent
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.supporting.creamLinen,
    padding: tokens.spacing.base,
    marginBottom: tokens.spacing.sm,
    borderRadius: tokens.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: tokens.colors.primary[500], // Default
    ...tokens.shadows.sm,
  },
  compactCard: {
    padding: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },

  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  mealName: {
    fontSize: tokens.typography.body.base.fontSize,
    fontWeight: '600',
    color: tokens.colors.text.primary,
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  compactMealName: {
    fontSize: tokens.typography.body.small.fontSize,
    marginBottom: tokens.spacing.xs,
  },

  // Meal type badge
  mealTypeContainer: {
    backgroundColor: tokens.colors.supporting.warmBeige,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.borderRadius.xl,
  },
  mealType: {
    fontSize: tokens.typography.body.caption.fontSize,
    fontWeight: '500',
    textTransform: 'uppercase',
  },

  // Macros
  macros: {
    fontSize: tokens.typography.body.small.fontSize,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.sm,
    lineHeight: 18,
  },
  compactMacros: {
    fontSize: tokens.typography.body.caption.fontSize,
    marginBottom: tokens.spacing.xs,
  },

  // Footer styles
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  time: {
    fontSize: tokens.typography.body.caption.fontSize,
    color: tokens.colors.text.tertiary,
  },

  // AI confidence
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceText: {
    fontSize: 11,
    color: tokens.colors.warning[500],
    marginRight: tokens.spacing.xs,
  },
  unconfirmedIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.error[500],
  },

  // Quantity
  quantity: {
    fontSize: 11,
    color: tokens.colors.text.tertiary,
    fontStyle: 'italic',
  },

  // Notes
  notes: {
    fontSize: tokens.typography.body.caption.fontSize,
    color: tokens.colors.text.secondary,
    fontStyle: 'italic',
    marginTop: tokens.spacing.sm,
    lineHeight: 16,
  },
})