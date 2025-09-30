import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { useTheme } from '@ui/theme/ThemeProvider'
import { logger } from '@lib/logger'

interface SimpleBarcodeProps {
  onComplete: () => void
  onManualEntry: () => void
  userId: string
}

export const SimpleBarcodeScanner: React.FC<SimpleBarcodeProps> = ({
  onComplete,
  onManualEntry,
}) => {
  const theme = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    setLastScanned(result.data)
    setScanning(false)

    try {
      logger.info('Barcode scanned with expo-camera', { barcode: result.data })

      // Direct API call to OpenFoodFacts
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${result.data}.json`, {
        headers: {
          'User-Agent': 'MacroMuse/1.0.0 (nutrition tracker app)'
        }
      })

      if (response.ok) {
        const apiData = await response.json()

        if (apiData.status === 1 && apiData.product) {
          const product = apiData.product
          const productName = product.product_name || 'Unknown Product'
          const brand = product.brands || 'Unknown Brand'
          const calories = product.nutriments?.['energy-kcal_100g'] || 'N/A'
          const protein = product.nutriments?.proteins_100g || 'N/A'
          const carbs = product.nutriments?.carbohydrates_100g || 'N/A'
          const fat = product.nutriments?.fat_100g || 'N/A'

          Alert.alert(
            '✅ Product Found!',
            `${productName}\n\n🏷️ Brand: ${brand}\n🔥 Calories: ${calories} per 100g\n🥩 Protein: ${protein}g\n🍞 Carbs: ${carbs}g\n🥑 Fat: ${fat}g`,
            [
              {
                text: '➕ Add to Log',
                onPress: () => {
                  logger.info('User selected to add scanned product to log', {
                    productName,
                    barcode: result.data
                  })
                  Alert.alert('Added!', `${productName} added to your food log`)
                  onComplete()
                }
              },
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '❌ Cancel', style: 'cancel' }
            ]
          )
        } else {
          Alert.alert(
            '❌ Product Not Found',
            `Barcode ${result.data} not found in OpenFoodFacts database.\n\nTry manual entry instead?`,
            [
              { text: '✏️ Manual Entry', onPress: onManualEntry },
              { text: '🔄 Scan Again', onPress: () => setLastScanned(null) },
              { text: '❌ Cancel', onPress: onComplete, style: 'cancel' }
            ]
          )
        }
      } else {
        throw new Error(`API request failed: ${response.status}`)
      }
    } catch (error) {
      logger.error('Barcode lookup failed', { barcode: result.data, error })
      Alert.alert(
        '⚠️ Lookup Failed',
        `Could not look up barcode ${result.data}.\n\nCheck your internet connection or try manual entry.`,
        [
          { text: '✏️ Manual Entry', onPress: onManualEntry },
          { text: '🔄 Try Again', onPress: () => setLastScanned(null) },
          { text: '❌ Cancel', onPress: onComplete, style: 'cancel' }
        ]
      )
    }
  }

  const startScanning = async () => {
    if (!permission?.granted) {
      const response = await requestPermission()
      if (!response.granted) {
        Alert.alert('Camera Permission', 'Camera permission is required to scan barcodes.')
        return
      }
    }
    setScanning(true)
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={{ color: theme.colors.text.primary }}>
          Requesting camera permission...
        </Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={{ color: theme.colors.text.primary, textAlign: 'center', marginBottom: 20 }}>
          Camera permission is required to scan barcodes
        </Text>
        <Button title="Manual Entry Instead" onPress={onManualEntry} />
        <Button title="Done" onPress={onComplete} variant="outline" style={{ marginTop: 10 }} />
      </View>
    )
  }

  if (scanning) {
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128'],
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.instructionText}>
            Point camera at barcode
          </Text>
          <Button
            title="Cancel"
            onPress={() => setScanning(false)}
            style={styles.cancelButton}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={[styles.title, { color: theme.colors.text.primary }]}>
        📱 Barcode Scanner
      </Text>

      <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
        Powered by OpenFoodFacts database
      </Text>

      {lastScanned && (
        <Text style={[styles.lastScanned, { color: theme.colors.text.secondary }]}>
          Last scanned: {lastScanned}
        </Text>
      )}

      <Button
        title="🔍 Start Camera Scan"
        onPress={startScanning}
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
    marginBottom: 30,
  },
  button: {
    marginBottom: 15,
    width: '100%',
  },
  scannerContainer: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'transparent',
    marginBottom: 20,
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  lastScanned: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
})