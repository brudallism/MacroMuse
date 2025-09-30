import React, { useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'
import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { useTheme } from '@ui/theme/ThemeProvider'
import { logger } from '@lib/logger'

interface BarcodeFlowMinimalProps {
  onComplete: () => void
  onManualEntry: () => void
  userId: string
}

export const BarcodeFlowMinimal: React.FC<BarcodeFlowMinimalProps> = ({
  onComplete,
  onManualEntry,
}) => {
  const theme = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [showCamera, setShowCamera] = useState(false)
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    setScannedBarcode(result.data)
    setShowCamera(false)

    try {
      logger.info('Barcode scanned, attempting direct OpenFoodFacts lookup', { barcode: result.data })

      // Direct API call to OpenFoodFacts to bypass facade issues
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${result.data}.json`, {
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

          Alert.alert(
            'Product Found!',
            `${productName}\nBrand: ${brand}\nCalories: ${calories} per 100g`,
            [
              { text: 'Add to Log', onPress: () => {
                logger.info('User selected to add product to log', { productName })
                onComplete()
              }},
              { text: 'Manual Entry', onPress: onManualEntry },
              { text: 'Cancel', style: 'cancel' }
            ]
          )
        } else {
          Alert.alert(
            'Product Not Found',
            `Barcode ${result.data} not found in OpenFoodFacts database.\n\nWould you like to try manual entry instead?`,
            [
              { text: 'Manual Entry', onPress: onManualEntry },
              { text: 'Try Again', onPress: () => setShowCamera(true) },
              { text: 'Cancel', onPress: onComplete, style: 'cancel' }
            ]
          )
        }
      } else {
        throw new Error(`API request failed: ${response.status}`)
      }
    } catch (error) {
      logger.error('Barcode lookup failed', { barcode: result.data, error })
      Alert.alert(
        'Lookup Failed',
        `Could not look up barcode ${result.data}.\n\nWould you like to try manual entry?`,
        [
          { text: 'Manual Entry', onPress: onManualEntry },
          { text: 'Try Again', onPress: () => setShowCamera(true) },
          { text: 'Cancel', onPress: onComplete, style: 'cancel' }
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
    setShowCamera(true)
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128'],
          }}
        />
        <View style={styles.overlay}>
          <Text style={[styles.overlayText, { color: 'white' }]}>
            Point camera at barcode
          </Text>
          <Button
            title="Cancel"
            onPress={() => setShowCamera(false)}
            style={styles.cancelButton}
          />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <Text style={{ color: theme.colors.text.primary, textAlign: 'center', marginBottom: 20 }}>
        Barcode Scanner with Product Lookup
      </Text>

      {scannedBarcode && (
        <Text style={{ color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 20 }}>
          Last scanned: {scannedBarcode}
        </Text>
      )}

      <Button
        title="Start Camera Scan"
        onPress={startScanning}
        style={{ marginBottom: 10 }}
      />

      <Button
        title="Manual Entry"
        onPress={onManualEntry}
        variant="secondary"
        style={{ marginBottom: 10 }}
      />

      <Button
        title="Done"
        onPress={onComplete}
        variant="outline"
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
  },
  overlayText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
})