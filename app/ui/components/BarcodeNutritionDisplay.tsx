import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

import { useTheme } from '@ui/theme/ThemeProvider'

interface NutrientVector {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  saturated_fat_g?: number
}

interface BarcodeProduct {
  barcode: string
  name: string
  brand?: string
  image_url?: string
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  confidence: number
  ingredients?: string
  allergens?: string
  dataQuality?: {
    isComplete: boolean
    isSuspicious: boolean
    warnings: string[]
  }
}

interface BarcodeNutritionDisplayProps {
  product: BarcodeProduct
  servingSize: string
}

export const BarcodeNutritionDisplay: React.FC<BarcodeNutritionDisplayProps> = ({
  product,
  servingSize
}) => {
  const theme = useTheme()

  const calculateNutrientsPerServing = (nutrients: NutrientVector, serving: number): NutrientVector => {
    const factor = serving / product.servingSize.amount
    return {
      calories: Math.round(nutrients.calories * factor),
      protein_g: Math.round(nutrients.protein_g * factor * 10) / 10,
      carbs_g: Math.round(nutrients.carbs_g * factor * 10) / 10,
      fat_g: Math.round(nutrients.fat_g * factor * 10) / 10,
      fiber_g: nutrients.fiber_g ? Math.round(nutrients.fiber_g * factor * 10) / 10 : undefined,
      sugar_g: nutrients.sugar_g ? Math.round(nutrients.sugar_g * factor * 10) / 10 : undefined,
      sodium_mg: nutrients.sodium_mg ? Math.round(nutrients.sodium_mg * factor) : undefined,
      saturated_fat_g: nutrients.saturated_fat_g ? Math.round(nutrients.saturated_fat_g * factor * 10) / 10 : undefined,
    }
  }

  const servingNutrients = calculateNutrientsPerServing(product.nutrients, parseFloat(servingSize) || product.servingSize.amount)

  const formatNutrientValue = (value: number | undefined, unit: string): string => {
    if (value === undefined || value === null) return '-- ' + unit
    return `${value}${unit}`
  }

  const DataQualityWarnings: React.FC = () => {
    if (product.confidence > 0.8) return null

    return (
      <View style={styles.warningContainer}>
        <Text style={[styles.warningTitle, { color: theme.colors.warning }]}>
          Data Quality Notice
        </Text>
        <Text style={[styles.warningText, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
          {product.confidence < 0.5
            ? 'Low confidence match. Please verify nutrition data before adding to log.'
            : 'Moderate confidence match. Some nutrition data may be estimated.'
          }
        </Text>
        <Text style={[styles.confidenceText, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.tertiary }]}>
          Match confidence: {Math.round(product.confidence * 100)}%
        </Text>
      </View>
    )
  }

  const NutrientRow: React.FC<{ label: string; value: number | undefined; unit: string }> = ({
    label,
    value,
    unit
  }) => (
    <View style={styles.nutrientRow}>
      <Text style={[styles.nutrientLabel, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
        {label}
      </Text>
      <Text style={[styles.nutrientValue, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
        {formatNutrientValue(value, unit)}
      </Text>
    </View>
  )

  return (
    <>
      <DataQualityWarnings />

      {/* Main Macros */}
      <View style={styles.macroSection}>
        <Text style={[styles.sectionTitle, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
          Main Nutrients
        </Text>
        <View style={styles.macroGrid}>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
              {servingNutrients.calories}
            </Text>
            <Text style={[styles.macroLabel, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
              Calories
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
              {servingNutrients.protein_g}g
            </Text>
            <Text style={[styles.macroLabel, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
              Protein
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
              {servingNutrients.carbs_g}g
            </Text>
            <Text style={[styles.macroLabel, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
              Carbs
            </Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }]}>
              {servingNutrients.fat_g}g
            </Text>
            <Text style={[styles.macroLabel, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
              Fat
            </Text>
          </View>
        </View>
      </View>

      {/* Detailed Micronutrients */}
      {(servingNutrients.fiber_g || servingNutrients.sugar_g || servingNutrients.sodium_mg || servingNutrients.saturated_fat_g) && (
        <View style={styles.microSection}>
          <Text style={[styles.subsectionTitle, { color: typeof theme.colors.textSecondary === 'string' ? theme.colors.textSecondary : theme.colors.text.secondary }]}>
            Additional Nutrients
          </Text>
          {servingNutrients.fiber_g !== undefined && (
            <NutrientRow label="Fiber" value={servingNutrients.fiber_g} unit="g" />
          )}
          {servingNutrients.sugar_g !== undefined && (
            <NutrientRow label="Sugar" value={servingNutrients.sugar_g} unit="g" />
          )}
          {servingNutrients.saturated_fat_g !== undefined && (
            <NutrientRow label="Saturated Fat" value={servingNutrients.saturated_fat_g} unit="g" />
          )}
          {servingNutrients.sodium_mg !== undefined && (
            <NutrientRow label="Sodium" value={servingNutrients.sodium_mg} unit="mg" />
          )}
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  warningContainer: {
    backgroundColor: 'rgba(241, 168, 72, 0.1)', // Light warning background
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(241, 168, 72, 1)', // Warning color
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  confidenceText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  macroSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  microSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)', // Light border
    paddingTop: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  nutrientLabel: {
    fontSize: 14,
    flex: 1,
  },
  nutrientValue: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'right',
  },
})