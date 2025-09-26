import React, { useState, useEffect } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { BarcodeScanner } from '@ui/components/BarcodeScanner'
import { BarcodeConfirmation } from '@ui/components/BarcodeConfirmation'
import { Button } from '@ui/atoms/Button'
import { Card } from '@ui/atoms/Card'
import { Text } from '@ui/atoms/Text'
import { LoadingSpinner } from '@ui/atoms/LoadingSpinner'
import { useTheme } from '@ui/theme/ThemeProvider'
import { barcodeFacade } from '@facades/barcodeFacade'
import { searchFacade } from '@facades/searchFacade'
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

interface FoodSearchResult {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'custom' | 'barcode'
  nutrients: {
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    fiber_g?: number
    sugar_g?: number
    sodium_mg?: number
  }
  servingSize: {
    amount: number
    unit: string
  }
  confidence?: number
}
import { logger } from '@lib/logger'

type FlowState =
  | 'scanner'
  | 'loading'
  | 'confirmation'
  | 'not_found'
  | 'error'
  | 'success'

interface BarcodeFlowProps {
  onComplete: () => void
  onManualEntry: () => void
  userId?: string
}

export const BarcodeFlow: React.FC<BarcodeFlowProps> = ({
  onComplete,
  onManualEntry,
  userId
}) => {
  const theme = useTheme()
  const [flowState, setFlowState] = useState<FlowState>('scanner')
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [product, setProduct] = useState<BarcodeProduct | null>(null)
  const [fallbackResults, setFallbackResults] = useState<FoodSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sessionId] = useState(() => `barcode_session_${Date.now()}`)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      barcodeFacade.cancelBarcodeSession(sessionId)
    }
  }, [sessionId])

  const handleBarcodeScanned = async (barcode: string): Promise<void> => {
    setScannedBarcode(barcode)
    setFlowState('loading')
    setError(null)

    logger.info('Barcode scanned, starting lookup', { barcode, sessionId })

    try {
      // Lookup product in Open Food Facts
      const foundProduct = await barcodeFacade.lookupBarcode(barcode, sessionId)

      if (foundProduct) {
        setProduct(foundProduct)
        setFlowState('confirmation')

        logger.info('Product found for barcode', {
          barcode,
          productName: foundProduct.name,
          dataQuality: foundProduct.dataQuality
        })
      } else {
        // Product not found, try fallback search
        logger.info('Product not found, trying fallback search', { barcode })

        const fallbackResults = await barcodeFacade.handleBarcodeNotFound(barcode, sessionId)

        if (fallbackResults.length > 0) {
          setFallbackResults(fallbackResults)
          setFlowState('not_found')
        } else {
          setFlowState('not_found')
        }
      }
    } catch (error) {
      logger.error('Barcode lookup failed', { barcode, error })
      setError(error instanceof Error ? error.message : 'Failed to lookup barcode')
      setFlowState('error')
    }
  }

  const handleConfirmProduct = async (
    confirmedProduct: BarcodeProduct,
    servingSize: number,
    mealType?: string
  ): Promise<void> => {
    try {
      setFlowState('loading')

      await barcodeFacade.logBarcodeProduct(
        confirmedProduct,
        servingSize,
        mealType,
        userId,
        sessionId
      )

      setFlowState('success')

      // Auto-close after brief success display
      setTimeout(() => {
        onComplete()
      }, 1500)

    } catch (error) {
      logger.error('Failed to log barcode product', { error })
      setError('Failed to save food entry')
      setFlowState('error')
    }
  }

  const handleRejectProduct = (): void => {
    logger.info('User rejected barcode product', {
      barcode: scannedBarcode,
      productName: product?.name
    })

    setFlowState('scanner')
    setProduct(null)
    setScannedBarcode(null)
  }

  const handleManualEntry = (): void => {
    logger.info('BarcodeFlow handleManualEntry called')
    try {
      if (scannedBarcode) {
        barcodeFacade.handleManualEntry(scannedBarcode, sessionId)
      }
    } catch (error) {
      logger.warn('Error in barcode facade manual entry', { error })
    }
    logger.info('Calling onManualEntry callback')
    onManualEntry()
  }

  const handleError = (errorMessage: string): void => {
    setError(errorMessage)
    setFlowState('error')
  }

  const handlePermissionDenied = (): void => {
    Alert.alert(
      'Camera Permission Required',
      'To scan barcodes, please enable camera access in your device settings.',
      [
        { text: 'Manual Entry', onPress: handleManualEntry },
        { text: 'Cancel', onPress: onComplete }
      ]
    )
  }

  const handleRetry = (): void => {
    setFlowState('scanner')
    setError(null)
    setProduct(null)
    setScannedBarcode(null)
    setFallbackResults([])
  }

  const handleFallbackSelection = (result: FoodSearchResult): void => {
    // Convert FoodSearchResult to BarcodeProduct-like structure for confirmation
    const pseudoProduct: BarcodeProduct = {
      barcode: scannedBarcode || '',
      name: result.name,
      brand: result.brand,
      nutrients: result.nutrients,
      servingSize: result.servingSize,
      ingredients: result.ingredients,
      allergens: result.allergens,
      dataQuality: {
        isComplete: true,
        isSuspicious: false,
        warnings: ['Product found via fallback search - verify details']
      }
    }

    setProduct(pseudoProduct)
    setFlowState('confirmation')
  }

  const renderContent = (): React.ReactNode => {
    switch (flowState) {
      case 'scanner':
        return (
          <BarcodeScanner
            onBarcodeScanned={handleBarcodeScanned}
            onError={handleError}
            onPermissionDenied={handlePermissionDenied}
            onClose={() => {
              logger.info('BarcodeScanner onClose called')
              onComplete()
            }}
            onManualEntry={() => {
              logger.info('BarcodeScanner onManualEntry called')
              handleManualEntry()
            }}
            isVisible={true}
          />
        )

      case 'loading':
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Card style={styles.loadingCard}>
              <LoadingSpinner size="large" />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                {scannedBarcode ? 'Looking up product...' : 'Processing...'}
              </Text>
              {scannedBarcode && (
                <Text style={[styles.barcodeText, { color: theme.colors.textSecondary }]}>
                  Barcode: {scannedBarcode}
                </Text>
              )}
            </Card>
          </View>
        )

      case 'confirmation':
        return product ? (
          <BarcodeConfirmation
            product={product}
            onConfirm={handleConfirmProduct}
            onReject={handleRejectProduct}
            onManualEntry={handleManualEntry}
            isVisible={true}
          />
        ) : null

      case 'not_found':
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Card style={styles.messageCard}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Product Not Found
              </Text>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                We couldn't find this product in our database.
              </Text>
              {scannedBarcode && (
                <Text style={[styles.barcodeText, { color: theme.colors.textSecondary }]}>
                  Barcode: {scannedBarcode}
                </Text>
              )}

              {fallbackResults.length > 0 && (
                <View style={styles.fallbackSection}>
                  <Text style={[styles.fallbackTitle, { color: theme.colors.text }]}>
                    Similar Products Found:
                  </Text>
                  {fallbackResults.slice(0, 3).map((result, index) => (
                    <Button
                      key={index}
                      title={result.name}
                      onPress={() => handleFallbackSelection(result)}
                      variant="secondary"
                      style={styles.fallbackButton}
                    />
                  ))}
                </View>
              )}

              <View style={styles.actionContainer}>
                <Button
                  title="Try Manual Entry"
                  onPress={handleManualEntry}
                  variant="primary"
                />
                <Button
                  title="Scan Another"
                  onPress={handleRetry}
                  variant="secondary"
                />
                <Button
                  title="Cancel"
                  onPress={onComplete}
                  variant="ghost"
                />
              </View>
            </Card>
          </View>
        )

      case 'error':
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Card style={styles.messageCard}>
              <Text style={[styles.title, { color: theme.colors.error }]}>
                Error
              </Text>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                {error || 'An unexpected error occurred'}
              </Text>

              <View style={styles.actionContainer}>
                <Button
                  title="Try Again"
                  onPress={handleRetry}
                  variant="primary"
                />
                <Button
                  title="Manual Entry"
                  onPress={handleManualEntry}
                  variant="secondary"
                />
                <Button
                  title="Cancel"
                  onPress={onComplete}
                  variant="ghost"
                />
              </View>
            </Card>
          </View>
        )

      case 'success':
        return (
          <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
            <Card style={styles.messageCard}>
              <Text style={[styles.title, { color: theme.colors.success }]}>
                ✅ Added to Log!
              </Text>
              <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                {product?.name} has been added to your meal log.
              </Text>
              <View style={styles.actionContainer}>
                <Button
                  title="Done"
                  onPress={onComplete}
                  variant="primary"
                />
              </View>
            </Card>
          </View>
        )

      default:
        return null
    }
  }

  return <View style={styles.container}>{renderContent()}</View>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingCard: {
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingText: {
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  messageCard: {
    padding: 24,
    maxWidth: 400,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  barcodeText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  fallbackSection: {
    marginBottom: 20,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  fallbackButton: {
    marginVertical: 4,
  },
  actionContainer: {
    gap: 12,
  },
})