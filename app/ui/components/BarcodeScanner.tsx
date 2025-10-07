import React, { useState, useRef, useEffect } from 'react'
import { View, Text, StyleSheet, Alert, Platform } from 'react-native'
import { Camera, CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera'

import { Button } from '@ui/atoms/Button'
import { Card } from '@ui/atoms/Card'
import { useTheme } from '@ui/theme/ThemeProvider'

import { logger } from '@lib/logger'

export interface BarcodeScannerProps {
  onBarcodeScanned: (barcode: string) => void
  onError: (error: string) => void
  onPermissionDenied: () => void
  onClose: () => void
  onManualEntry?: () => void
  isVisible: boolean
}

type ScanningState = 'idle' | 'scanning' | 'processing' | 'success' | 'error'

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeScanned,
  onError,
  onPermissionDenied,
  onClose,
  onManualEntry,
  isVisible
}) => {
  const theme = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanningState, setScanningState] = useState<ScanningState>('idle')
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout>()

  // Auto-request permission when scanner becomes visible
  useEffect(() => {
    if (isVisible && !permission?.granted) {
      handleRequestPermission()
    }
  }, [isVisible, permission?.granted])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current)
      }
    }
  }, [])

  const handleRequestPermission = async (): Promise<void> => {
    try {
      setScanningState('idle')
      const result = await requestPermission()

      if (!result.granted) {
        logger.warn('Camera permission denied by user')
        onPermissionDenied()
        return
      }

      setScanningState('scanning')
      logger.info('Camera permission granted, starting barcode scanning')
    } catch (error) {
      logger.error('Failed to request camera permission', { error })
      onError('Failed to request camera permission')
    }
  }

  const handleBarcodeScanned = ({ data }: BarcodeScanningResult): void => {
    // Prevent duplicate scans of the same barcode
    if (scanningState === 'processing' || data === lastScannedBarcode) {
      return
    }

    // Validate barcode format (should be 8-14 digits)
    if (!/^\d{8,14}$/.test(data)) {
      logger.warn('Invalid barcode format scanned', { barcode: data })
      setScanningState('error')

      // Auto-reset to scanning after brief delay
      scanTimeoutRef.current = setTimeout(() => {
        setScanningState('scanning')
      }, 1500)
      return
    }

    setScanningState('processing')
    setLastScannedBarcode(data)

    logger.info('Valid barcode scanned', { barcode: data })

    // Brief delay to show success state before closing
    scanTimeoutRef.current = setTimeout(() => {
      setScanningState('success')
      onBarcodeScanned(data)
    }, 500)
  }

  const handleManualEntry = (): void => {
    logger.info('User chose manual barcode entry')
    if (onManualEntry) {
      onManualEntry()
    } else {
      onClose()
    }
    // Trigger manual entry flow (handled by parent component)
  }

  const handleError = (error: string): void => {
    logger.error('Camera error occurred', { error })
    setScanningState('error')
    onError(error)
  }

  if (!isVisible) {
    return null
  }

  // Permission not determined yet
  if (!permission) {
    return (
      <View style={styles.container}>
        <Card style={styles.messageCard}>
          <Text style={[styles.messageText, { color: theme.colors.text }]}>
            Preparing camera...
          </Text>
        </Card>
      </View>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Card style={styles.messageCard}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Camera Permission Required
          </Text>
          <Text style={[styles.messageText, { color: theme.colors.textSecondary }]}>
            To scan barcodes, we need access to your camera. This allows you to quickly add food items by scanning their barcodes.
          </Text>

          <View style={styles.buttonContainer}>
            <Button
              title="Grant Permission"
              onPress={handleRequestPermission}
              variant="primary"
              style={styles.button}
            />
            <Button
              title="Enter Manually"
              onPress={handleManualEntry}
              variant="secondary"
              style={styles.button}
            />
            <Button
              title="Cancel"
              onPress={() => {
                logger.info('Cancel button pressed in permission denied state')
                onClose()
              }}
              variant="ghost"
              style={styles.button}
            />
          </View>
        </Card>
      </View>
    )
  }

  // Camera permission granted - show scanner
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanningState === 'scanning' ? handleBarcodeScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13',
            'ean8',
            'upc_a',
            'upc_e',
            'code128',
            'code39',
            'code93',
            'codabar',
            'itf14'
          ],
        }}
      >
        {/* Scanner overlay */}
        <View style={styles.overlay}>
          {/* Top section */}
          <View style={[styles.overlaySection, styles.topSection]}>
            <Text style={styles.instructionText}>
              Position the barcode within the frame
            </Text>
          </View>

          {/* Middle section with scanning frame */}
          <View style={styles.middleSection}>
            <View style={styles.scannerFrame}>
              <View style={[styles.frameCorner, styles.topLeft]} />
              <View style={[styles.frameCorner, styles.topRight]} />
              <View style={[styles.frameCorner, styles.bottomLeft]} />
              <View style={[styles.frameCorner, styles.bottomRight]} />

              {/* Scanning line animation */}
              {scanningState === 'scanning' && (
                <View style={styles.scanLine} />
              )}
            </View>
          </View>

          {/* Bottom section with status and controls */}
          <View style={[styles.overlaySection, styles.bottomSection]}>
            {scanningState === 'processing' && (
              <Text style={styles.statusText}>Processing barcode...</Text>
            )}
            {scanningState === 'error' && (
              <Text style={[styles.statusText, styles.errorText]}>
                Invalid barcode. Try again.
              </Text>
            )}
            {scanningState === 'success' && (
              <Text style={[styles.statusText, styles.successText]}>
                Barcode scanned successfully!
              </Text>
            )}

            <View style={styles.controlsContainer}>
              <Button
                title="Enter Manually"
                onPress={handleManualEntry}
                variant="secondary"
                style={styles.controlButton}
              />
              <Button
                title="Cancel"
                onPress={() => {
                  logger.info('Cancel button pressed in scanner overlay')
                  onClose()
                }}
                variant="ghost"
                style={styles.controlButton}
              />
            </View>
          </View>
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1410', // theme.colors.text.primary for camera overlay
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlaySection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  topSection: {
    flex: 2,
  },
  middleSection: {
    flex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    flex: 2,
  },
  instructionText: {
    color: '#F3EFE9', // theme.colors.text.inverse
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  scannerFrame: {
    width: 280,
    height: 160,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  frameCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#9CAF88', // theme.colors.success[500]
    borderWidth: 3,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#9CAF88', // theme.colors.success[500]
    top: '50%',
    shadowColor: '#9CAF88', // theme.colors.success[500]
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  statusText: {
    color: '#F3EFE9', // theme.colors.text.inverse
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorText: {
    color: '#B95D40', // theme.colors.error[500]
  },
  successText: {
    color: '#9CAF88', // theme.colors.success[500]
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 40,
  },
  controlButton: {
    minWidth: 120,
  },
  messageCard: {
    margin: 20,
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 12,
  },
  button: {
    marginVertical: 6,
  },
})