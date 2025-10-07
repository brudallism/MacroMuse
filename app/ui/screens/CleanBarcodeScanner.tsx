import React, { useState, useRef } from 'react'
import { View, StyleSheet, Alert, Vibration } from 'react-native'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { cleanBarcodeFacade } from '@facades/cleanBarcodeFacade'

import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { useTheme } from '@ui/theme/ThemeProvider'

import { logger } from '@lib/logger'

interface CleanBarcodeScannerProps {
  onProductFound: (productName: string, nutrients: any, barcode: string) => void
  onComplete: () => void
  onManualEntry: () => void
  userId: string
}

export const CleanBarcodeScanner: React.FC<CleanBarcodeScannerProps> = ({
  onProductFound,
  onComplete,
  onManualEntry,
  userId
}) => {
  const theme = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const lastScanRef = useRef<string>('')

  const handleBarcodeScan = async (data: string) => {
    // Prevent duplicate scans
    if (processing || data === lastScanRef.current) {
      return
    }

    lastScanRef.current = data
    setProcessing(true)
    setScanning(false)

    // Haptic feedback
    Vibration.vibrate(100)

    logger.info('Barcode scanned from camera', { barcode: data })

    try {
      const result = await cleanBarcodeFacade.scanBarcode(data)

      if (result.success && result.product) {
        Alert.alert(
          '✅ Product Found!',
          `${result.product.name}\n\n🏷️ Brand: ${result.product.brand || 'Unknown'}\n🔥 Calories: ${result.product.nutrients.calories || 'N/A'} per ${result.product.servingSize.amount}${result.product.servingSize.unit}`,
          [
            {
              text: '➕ Add to Log',
              onPress: () => {
                onProductFound(
                  result.product!.name,
                  result.product!.nutrients,
                  result.product!.barcode
                )
                onComplete()
              }
            },
            {
              text: '🔄 Scan Another',
              onPress: () => {
                setProcessing(false)
                setScanning(true)
                lastScanRef.current = ''
              }
            },
            {
              text: '✏️ Manual Entry',
              onPress: onManualEntry
            }
          ]
        )
      } else {
        const errorMessage = result.errorReason === 'invalid_barcode'
          ? 'Invalid barcode format'
          : result.errorReason === 'not_found'
          ? 'Product not found in database'
          : 'Network error occurred'

        Alert.alert(
          '❌ Scan Failed',
          `${errorMessage}\n\nBarcode: ${data}`,
          [
            {
              text: '🔄 Try Again',
              onPress: () => {
                setProcessing(false)
                setScanning(true)
                lastScanRef.current = ''
              }
            },
            {
              text: '✏️ Manual Entry',
              onPress: onManualEntry
            },
            {
              text: '❌ Cancel',
              onPress: onComplete,
              style: 'cancel'
            }
          ]
        )
      }
    } catch (error) {
      logger.error('Barcode processing error', { barcode: data, error })
      Alert.alert(
        '⚠️ Processing Error',
        'Failed to process barcode. Please try again.',
        [
          {
            text: '🔄 Try Again',
            onPress: () => {
              setProcessing(false)
              setScanning(true)
              lastScanRef.current = ''
            }
          },
          {
            text: '❌ Cancel',
            onPress: onComplete,
            style: 'cancel'
          }
        ]
      )
    }
  }

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.message, { color: theme.colors.text.primary }]}>
          Requesting camera permission...
        </Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.message, { color: theme.colors.text.primary }]}>
          Camera access is required for barcode scanning
        </Text>
        <Button
          title="Grant Permission"
          onPress={requestPermission}
          style={styles.button}
        />
        <Button
          title="Manual Entry Instead"
          onPress={onManualEntry}
          variant="secondary"
          style={styles.button}
        />
      </View>
    )
  }

  if (!scanning && !processing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          📱 Barcode Scanner
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
          Position barcode within the camera frame
        </Text>
        <Button
          title="🎥 Start Scanning"
          onPress={() => setScanning(true)}
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

  if (processing) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <Text style={[styles.message, { color: theme.colors.text.primary }]}>
          🔍 Looking up product...
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['upc_a', 'upc_e', 'ean13', 'ean8', 'code128', 'code39']
        }}
        onBarcodeScanned={(result) => handleBarcodeScan(result.data)}
      >
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.scanInstruction}>
            Position barcode within the frame
          </Text>
          <Button
            title="❌ Cancel"
            onPress={() => {
              setScanning(false)
              setProcessing(false)
              lastScanRef.current = ''
            }}
            variant="outline"
            style={styles.cancelButton}
          />
        </View>
      </CameraView>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 3,
    borderColor: '#00ff00',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  scanInstruction: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  cancelButton: {
    marginTop: 40,
    width: 120,
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
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    marginBottom: 15,
    width: '100%',
  },
})