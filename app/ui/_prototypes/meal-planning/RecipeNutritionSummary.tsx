// ui/molecules/RecipeNutritionSummary.tsx - Recipe nutrition display component
import React from 'react'
import { View, StyleSheet } from 'react-native'

import { Card } from '../atoms/Card'
import { Text } from '../atoms/Text'
import { LoadingSpinner } from '../atoms/LoadingSpinner'
import { NutrientVector } from '../../domain/models'
import { useTheme } from '../theme/ThemeProvider'

interface RecipeNutritionSummaryProps {
  nutrients: NutrientVector
  servings: number
  isCalculating?: boolean
}

export const RecipeNutritionSummary: React.FC<RecipeNutritionSummaryProps> = ({
  nutrients,
  servings,
  isCalculating = false
}) => {
  const theme = useTheme()

  const getPerServingNutrients = (): NutrientVector => {
    if (servings <= 0) return {}

    return Object.entries(nutrients).reduce((perServing, [key, value]) => {
      if (typeof value === 'number' && value > 0) {
        perServing[key as keyof NutrientVector] = Math.round((value / servings) * 100) / 100
      }
      return perServing
    }, {} as NutrientVector)
  }

  const formatNutrientValue = (value: number | undefined, unit: string): string => {
    if (value === undefined || value <= 0) return '0' + unit
    return Math.round(value * 100) / 100 + unit
  }

  const perServingNutrients = getPerServingNutrients()
  const hasNutritionData = Object.keys(nutrients).length > 0

  const macroNutrients = [
    { key: 'calories', label: 'Calories', unit: '', color: '#FF6B6B' },
    { key: 'protein_g', label: 'Protein', unit: 'g', color: '#4ECDC4' },
    { key: 'carbs_g', label: 'Carbs', unit: 'g', color: '#45B7D1' },
    { key: 'fat_g', label: 'Fat', unit: 'g', color: '#FFA07A' },
    { key: 'fiber_g', label: 'Fiber', unit: 'g', color: '#98D8C8' }
  ]

  const microNutrients = [
    { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
    { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
    { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
    { key: 'iron_mg', label: 'Iron', unit: 'mg' },
    { key: 'vitaminC_mg', label: 'Vitamin C', unit: 'mg' },
    { key: 'vitaminA_µg', label: 'Vitamin A', unit: 'µg' }
  ]

  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Nutrition Information
        </Text>
        {isCalculating && <LoadingSpinner size="small" />}
      </View>

      {!hasNutritionData && !isCalculating ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            Add ingredients to see nutrition information
          </Text>
        </View>
      ) : (
        <>
          {/* Serving Size Info */}
          <View style={styles.servingInfo}>
            <Text style={[styles.servingText, { color: theme.colors.textSecondary }]}>
              Per serving ({servings} {servings === 1 ? 'serving' : 'servings'} total)
            </Text>
          </View>

          {/* Macro Nutrients */}
          <View style={styles.macroSection}>
            <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>
              Macronutrients
            </Text>
            <View style={styles.macroGrid}>
              {macroNutrients.map((nutrient) => {
                const value = perServingNutrients[nutrient.key as keyof NutrientVector] as number
                return (
                  <View key={nutrient.key} style={styles.macroCard}>
                    <View style={[styles.macroIndicator, { backgroundColor: nutrient.color }]} />
                    <View style={styles.macroContent}>
                      <Text style={[styles.macroValue, { color: theme.colors.text }]}>
                        {formatNutrientValue(value, nutrient.unit)}
                      </Text>
                      <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>
                        {nutrient.label}
                      </Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Micro Nutrients */}
          <View style={styles.microSection}>
            <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>
              Micronutrients
            </Text>
            <View style={styles.microGrid}>
              {microNutrients.map((nutrient) => {
                const value = perServingNutrients[nutrient.key as keyof NutrientVector] as number
                if (!value || value <= 0) return null

                return (
                  <View key={nutrient.key} style={styles.microRow}>
                    <Text style={[styles.microLabel, { color: theme.colors.textSecondary }]}>
                      {nutrient.label}
                    </Text>
                    <Text style={[styles.microValue, { color: theme.colors.text }]}>
                      {formatNutrientValue(value, nutrient.unit)}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>

          {/* Total Recipe Nutrition */}
          <View style={styles.totalSection}>
            <Text style={[styles.subsectionTitle, { color: theme.colors.text }]}>
              Total Recipe
            </Text>
            <View style={styles.totalGrid}>
              {macroNutrients.map((nutrient) => {
                const value = nutrients[nutrient.key as keyof NutrientVector] as number
                if (!value || value <= 0) return null

                return (
                  <Text key={nutrient.key} style={[styles.totalText, { color: theme.colors.textSecondary }]}>
                    {nutrient.label}: {formatNutrientValue(value, nutrient.unit)}
                  </Text>
                )
              })}
            </View>
          </View>

          {/* Nutrition Notes */}
          <View style={styles.notesSection}>
            <Text style={[styles.notesText, { color: theme.colors.textSecondary }]}>
              * Nutrition values are calculated from ingredient data and may vary based on specific brands and preparation methods.
            </Text>
          </View>
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  servingInfo: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  servingText: {
    fontSize: 14,
    textAlign: 'center',
  },
  macroSection: {
    marginBottom: 20,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    minWidth: '45%',
    flex: 1,
  },
  macroIndicator: {
    width: 4,
    height: 24,
    borderRadius: 2,
    marginRight: 8,
  },
  macroContent: {
    flex: 1,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  macroLabel: {
    fontSize: 12,
  },
  microSection: {
    marginBottom: 20,
  },
  microGrid: {
    gap: 8,
  },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  microLabel: {
    fontSize: 14,
  },
  microValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  totalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  totalText: {
    fontSize: 12,
  },
  notesSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  notesText: {
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
})