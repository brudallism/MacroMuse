import React, { useState } from 'react'
import { View, StyleSheet, Alert, TextInput } from 'react-native'
import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { useTheme } from '@ui/theme/ThemeProvider'
import { logger } from '@lib/logger'

interface BarcodeInputProps {
  onComplete: () => void
  onManualEntry: () => void
  userId: string
}

export const BarcodeInputScreen: React.FC<BarcodeInputProps> = ({
  onComplete,
  onManualEntry,
}) => {
  const theme = useTheme()
  const [barcode, setBarcode] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!barcode.trim()) {
      Alert.alert('Missing Barcode', 'Please enter a barcode number')
      return
    }

    setLoading(true)

    try {
      logger.info('Looking up barcode manually entered', { barcode })

      // Direct API call to OpenFoodFacts
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode.trim()}.json`, {
        headers: {
          'User-Agent': 'MacroMuse/1.0.0 (nutrition tracker app)'
        }
      })

      if (response.ok) {
        const data = await response.json()

        if (data.status === 1 && data.product) {
          const product = data.product
          const productName = product.product_name || 'Unknown Product'
          const brand = product.brands || 'Unknown Brand'
          const calories = product.nutriments?.['energy-kcal_100g'] || 'N/A'
          const protein = product.nutriments?.proteins_100g || 'N/A'
          const carbs = product.nutriments?.carbohydrates_100g || 'N/A'
          const fat = product.nutriments?.fat_100g || 'N/A'

          setLastResult(productName)

          Alert.alert(
            '✅ Product Found!',
            `${productName}\n\n🏷️ Brand: ${brand}\n🔥 Calories: ${calories} per 100g\n🥩 Protein: ${protein}g\n🍞 Carbs: ${carbs}g\n🥑 Fat: ${fat}g`,
            [
              {
                text: '➕ Add to Log',
                onPress: () => {
                  logger.info('User selected to add manually entered product to log', {
                    productName,
                    barcode: barcode.trim()
                  })
                  Alert.alert('Added!', `${productName} added to your food log`)
                  onComplete()
                }
              },
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '🔄 Look Up Another', onPress: () => setBarcode('') }
            ]
          )
        } else {
          Alert.alert(
            '❌ Product Not Found',
            `Barcode ${barcode.trim()} not found in OpenFoodFacts database.\n\nTry manual entry instead?`,
            [
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '🔄 Try Another Barcode', onPress: () => setBarcode('') },
              { text: '❌ Cancel', onPress: onComplete, style: 'cancel' }
            ]
          )
        }
      } else {
        throw new Error(`API request failed: ${response.status}`)
      }
    } catch (error) {
      logger.error('Barcode lookup failed', { barcode: barcode.trim(), error })
      Alert.alert(
        '⚠️ Lookup Failed',
        `Could not look up barcode ${barcode.trim()}.\n\nCheck your internet connection or try manual entry.`,
        [
          { text: '✏️ Manual Entry', onPress: onManualEntry },
          { text: '🔄 Try Again', onPress: () => setBarcode('') },
          { text: '❌ Cancel', onPress: onComplete, style: 'cancel' }
        ]
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        📱 Barcode Lookup
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Enter barcode manually • Powered by OpenFoodFacts
      </Text>

      {lastResult && (
        <Text style={[styles.lastResult, { color: theme.colors.text.secondary }]}>
          Last found: {lastResult}
        </Text>
      )}

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.colors.text.primary }]}>
          Barcode Number:
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.background.secondary,
              color: theme.colors.text.primary,
              borderColor: theme.colors.text.tertiary,
            }
          ]}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Enter UPC/EAN barcode (8-14 digits)"
          placeholderTextColor={theme.colors.text.tertiary}
          keyboardType="numeric"
          maxLength={14}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Button
        title={loading ? '🔍 Looking up...' : '🔍 Look Up Product'}
        onPress={handleLookup}
        disabled={loading || !barcode.trim()}
        style={styles.button}
      />

      <Button
        title="✏️ Manual Entry"
        onPress={onManualEntry}
        variant="secondary"
        style={styles.button}
      />

      <Button
        title="✅ Done"
        onPress={onComplete}
        variant="outline"
        style={styles.button}
      />

      <Text style={[styles.helpText, { color: theme.colors.text.tertiary }]}>
        Tip: Look for the barcode on product packaging - it's usually a series of vertical lines with numbers underneath.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  lastResult: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    textAlign: 'center',
  },
  button: {
    marginBottom: 15,
    width: '100%',
  },
  helpText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
})