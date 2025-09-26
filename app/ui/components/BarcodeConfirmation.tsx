import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { Button } from '@ui/atoms/Button'
import { Card } from '@ui/atoms/Card'
import { TextInput } from '@ui/atoms/TextInput'
import { BarcodeNutritionDisplay } from './BarcodeNutritionDisplay'
import { useTheme } from '@ui/theme/ThemeProvider'

// Inline interfaces to avoid domain/infra imports
interface BarcodeProduct {
  barcode: string
  name: string
  brand?: string
  image_url?: string
  nutrients: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
    sugar_g?: number
    sodium_mg?: number
    saturated_fat_g?: number
  }
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

export interface BarcodeConfirmationProps {
  product: BarcodeProduct
  onConfirm: (product: BarcodeProduct, servingSize: number, mealType?: string) => void
  onReject: () => void
  onManualEntry: () => void
  isVisible: boolean
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const BarcodeConfirmation: React.FC<BarcodeConfirmationProps> = ({
  product,
  onConfirm,
  onReject,
  onManualEntry,
  isVisible
}) => {
  const theme = useTheme()
  const [servingSize, setServingSize] = useState(product.servingSize.amount.toString())

  // Debug log to check product data
  React.useEffect(() => {
    console.log('BarcodeConfirmation received product:', {
      name: product.name,
      barcode: product.barcode,
      hasNutrients: !!product.nutrients,
      nutrients: product.nutrients,
      servingSize: product.servingSize
    })
  }, [product])
  const [selectedMealType, setSelectedMealType] = useState<MealType | undefined>()

  if (!isVisible) {
    return null
  }

  const handleConfirm = (): void => {
    const size = parseFloat(servingSize)
    if (isNaN(size) || size <= 0) {
      Alert.alert('Invalid Serving Size', 'Please enter a valid serving size greater than 0.')
      return
    }

    onConfirm(product, size, selectedMealType)
  }

  const handleManualEntry = (): void => {
    Alert.alert(
      'Switch to Manual Entry',
      'Are you sure you want to switch to manual food entry? You\'ll lose the scanned product information.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: onManualEntry }
      ]
    )
  }

  const MealTypeButton: React.FC<{ type: MealType; label: string }> = ({ type, label }) => (
    <Button
      title={label}
      onPress={() => setSelectedMealType(selectedMealType === type ? undefined : type)}
      variant={selectedMealType === type ? 'primary' : 'outline'}
      size="small"
      style={styles.mealButton}
    />
  )

  return (
    <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
      <Card style={styles.container}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              Confirm Product
            </Text>
            <Button
              title="×"
              onPress={onReject}
              variant="ghost"
              size="small"
              style={styles.closeButton}
            />
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={[styles.productName, { color: theme.colors.text.primary }]}>
              {product.name}
            </Text>
            {product.brand && (
              <Text style={[styles.brandName, { color: theme.colors.text.secondary }]}>
                {product.brand}
              </Text>
            )}
            <Text style={[styles.barcodeText, { color: theme.colors.text.tertiary }]}>
              Barcode: {product.barcode}
            </Text>
          </View>

          {/* Serving Size Input */}
          <View style={styles.servingSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Serving Size
            </Text>
            <View style={styles.servingInput}>
              <TextInput
                value={servingSize}
                onChangeText={setServingSize}
                placeholder="Enter amount"
                keyboardType="numeric"
                style={styles.servingTextInput}
              />
              <Text style={[styles.servingUnit, { color: theme.colors.text.secondary }]}>
                {product.servingSize.unit}
              </Text>
            </View>
          </View>

          {/* Nutrition Display */}
          <BarcodeNutritionDisplay product={product} servingSize={servingSize} />

          {/* Meal Type Selection */}
          <View style={styles.mealTypeSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
              Meal Type (Optional)
            </Text>
            <View style={styles.mealButtons}>
              <MealTypeButton type="breakfast" label="Breakfast" />
              <MealTypeButton type="lunch" label="Lunch" />
              <MealTypeButton type="dinner" label="Dinner" />
              <MealTypeButton type="snack" label="Snack" />
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Button
            title="Add to Log"
            onPress={handleConfirm}
            variant="primary"
            style={styles.confirmButton}
          />
          <View style={styles.secondaryActions}>
            <Button
              title="Not This Product"
              onPress={onReject}
              variant="outline"
              size="small"
              style={styles.rejectButton}
            />
            <Button
              title="Manual Entry"
              onPress={handleManualEntry}
              variant="ghost"
              size="small"
              style={styles.manualButton}
            />
          </View>
        </View>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 32,
    height: 32,
  },
  productInfo: {
    marginBottom: 20,
    alignItems: 'center',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  barcodeText: {
    fontSize: 12,
    textAlign: 'center',
  },
  servingSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  servingInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servingTextInput: {
    flex: 1,
  },
  servingUnit: {
    fontSize: 14,
    minWidth: 40,
  },
  mealTypeSection: {
    marginBottom: 20,
  },
  mealButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealButton: {
    flexBasis: '48%',
  },
  actions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E7E3DD', // theme.colors.gray[200]
  },
  confirmButton: {
    marginBottom: 12,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    flex: 1,
  },
  manualButton: {
    flex: 1,
  },
})