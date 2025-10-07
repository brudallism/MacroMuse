import { LogEntry, FoodSearchResult } from '@domain/models'

import { BarcodeAdapter, BarcodeProduct } from '@infra/adapters/barcode'

import { useDataStore } from '@state/dataStore'

import { eventBus } from '@lib/eventBus'
import { logger } from '@lib/logger'
import { trackOperation } from '@lib/performance'

import { searchFacade } from './searchFacade'

interface BarcodeFacadeConfig {
  maxRetries: number
  timeout: number
  enableFallbackSearch: boolean
}

const DEFAULT_CONFIG: BarcodeFacadeConfig = {
  maxRetries: 2,
  timeout: 5000, // 5 seconds for barcode lookup
  enableFallbackSearch: true
}

export interface BarcodeSessionData {
  barcode: string
  product?: BarcodeProduct
  searchFallbackUsed?: boolean
  manualEntryUsed?: boolean
}

export class BarcodeFacade {
  private barcodeAdapter: BarcodeAdapter
  private activeSessions = new Map<string, BarcodeSessionData>()

  constructor(private config: BarcodeFacadeConfig = DEFAULT_CONFIG) {
    this.barcodeAdapter = new BarcodeAdapter()
    this.setupEventListeners()
  }

  async lookupBarcode(barcode: string, sessionId?: string): Promise<BarcodeProduct | null> {
    if (!barcode || !/^\d{8,14}$/.test(barcode)) {
      logger.warn('Invalid barcode format provided', { barcode })
      return null
    }

    // Track session if provided
    if (sessionId) {
      this.activeSessions.set(sessionId, { barcode })
    }

    try {
      const product = await trackOperation('search', async () => {
        const startTime = Date.now()

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Barcode lookup timeout')), this.config.timeout)
          )

          try {
            const result = await Promise.race([
              this.barcodeAdapter.lookup(barcode),
              timeoutPromise
            ])

            if (result) {
              logger.info('Barcode lookup successful', {
                barcode,
                productName: result.name,
                attempt,
                elapsed: Date.now() - startTime
              })

              // Update session
              if (sessionId && this.activeSessions.has(sessionId)) {
                this.activeSessions.set(sessionId, {
                  ...this.activeSessions.get(sessionId)!,
                  product: result
                })
              }

              return result
            }

            logger.info('Product not found in Open Food Facts', { barcode, attempt })

          } catch (error) {
            logger.warn(`Barcode lookup attempt ${attempt} failed`, { barcode, error })

            if (attempt === this.config.maxRetries) {
              throw error
            }

            // Brief delay before retry
            await new Promise(resolve => setTimeout(resolve, 500 * attempt))
          }
        }

        return null
      })

      return product

    } catch (error) {
      logger.error('Barcode lookup failed after all retries', { barcode, error })

      // Emit error event
      eventBus.emit('error_boundary_triggered', {
        error: error instanceof Error ? error.message : 'Barcode lookup failed',
        componentStack: 'BarcodeFacade.lookupBarcode'
      })

      return null
    }
  }

  async handleBarcodeNotFound(barcode: string, sessionId?: string): Promise<FoodSearchResult[]> {
    if (!this.config.enableFallbackSearch) {
      return []
    }

    logger.info('Attempting fallback search for barcode', { barcode })

    try {
      // Try searching for the barcode as a product name/identifier
      const searchResults = await searchFacade.searchFoods(barcode, 'usda', sessionId)

      // Update session to track fallback usage
      if (sessionId && this.activeSessions.has(sessionId)) {
        this.activeSessions.set(sessionId, {
          ...this.activeSessions.get(sessionId)!,
          searchFallbackUsed: true
        })
      }

      // Also try a broader search if no results
      if (searchResults.length === 0) {
        const broadSearchResults = await searchFacade.searchFoods(`product ${barcode}`, sessionId)
        return broadSearchResults
      }

      return searchResults

    } catch (error) {
      logger.error('Fallback search failed for barcode', { barcode, error })
      return []
    }
  }

  async logBarcodeProduct(
    product: BarcodeProduct,
    servingSize: number,
    mealType?: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    try {
      // Calculate nutrients based on serving size
      const ratio = servingSize / 100 // Assuming product nutrients are per 100g
      const adjustedNutrients = this.calculateServingNutrients(product.nutrients, ratio)

      // Create log entry
      const logEntry: LogEntry = {
        userId: userId || 'current_user', // TODO: Get from auth context
        loggedAt: new Date().toISOString(),
        source: 'barcode',
        sourceId: product.barcode,
        qty: servingSize,
        unit: product.servingSize.unit,
        nutrients: adjustedNutrients,
        mealLabel: mealType as LogEntry['mealLabel']
      }

      // Add to data store
      const dataStore = useDataStore.getState()
      await dataStore.addLogEntry(logEntry)

      // Track session completion
      if (sessionId && this.activeSessions.has(sessionId)) {
        const sessionData = this.activeSessions.get(sessionId)!
        logger.info('Barcode session completed successfully', {
          sessionId,
          barcode: sessionData.barcode,
          productName: product.name,
          servingSize,
          mealType,
          searchFallbackUsed: sessionData.searchFallbackUsed,
          manualEntryUsed: sessionData.manualEntryUsed
        })

        this.activeSessions.delete(sessionId)
      }

      logger.info('Barcode product logged successfully', {
        barcode: product.barcode,
        productName: product.name,
        servingSize,
        mealType
      })

    } catch (error) {
      logger.error('Failed to log barcode product', {
        barcode: product.barcode,
        error
      })
      throw error
    }
  }

  handleManualEntry(barcode: string, sessionId?: string): void {
    // Track that manual entry was used
    if (sessionId && this.activeSessions.has(sessionId)) {
      this.activeSessions.set(sessionId, {
        ...this.activeSessions.get(sessionId)!,
        manualEntryUsed: true
      })
    }

    logger.info('User switched to manual entry from barcode scan', { barcode, sessionId })

    // The actual manual entry flow is handled by the search facade
    // This just tracks the transition for analytics
  }

  cancelBarcodeSession(sessionId: string): void {
    if (this.activeSessions.has(sessionId)) {
      const sessionData = this.activeSessions.get(sessionId)!
      logger.info('Barcode session cancelled', {
        sessionId,
        barcode: sessionData.barcode,
        hadProduct: !!sessionData.product
      })

      this.activeSessions.delete(sessionId)
    }
  }

  getBarcodeStats(): {
    activeSessions: number
    cacheSize: number
    successRate?: number
  } {
    // Get basic stats
    const activeSessions = this.activeSessions.size

    // Call cleanup to get accurate cache size
    this.barcodeAdapter.cleanupCache()

    return {
      activeSessions,
      cacheSize: 0, // BarcodeAdapter doesn't expose cache size yet
      // successRate would require implementing analytics tracking
    }
  }

  private calculateServingNutrients(baseNutrients: any, ratio: number): any {
    const adjusted: any = {}

    Object.entries(baseNutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        adjusted[key] = Math.round((value * ratio) * 100) / 100
      }
    })

    return adjusted
  }

  private setupEventListeners(): void {
    // Listen for performance budget exceeded events
    eventBus.on('performance_budget_exceeded', (data) => {
      if (data.operation === 'search' && data.actualMs > 3000) {
        logger.warn('Barcode lookup performance issue', data)
      }
    })

    // Listen for search completion events from fallback
    eventBus.on('food_search_completed', (data) => {
      if (data.source === 'integrated_search' && data.query.match(/^\d{8,14}$/)) {
        logger.info('Barcode fallback search completed', {
          barcode: data.query,
          resultsCount: data.results.length
        })
      }
    })

    // Listen for cache events
    eventBus.on('food_data_cached', (data) => {
      if (data.source === 'barcode') {
        logger.debug('Barcode data cached', {
          barcode: data.foodId
        })
      }
    })
  }

  cleanup(): void {
    this.activeSessions.clear()
    this.barcodeAdapter.cleanupCache()
    logger.debug('BarcodeFacade cleaned up')
  }
}

// Singleton instance for app-wide use
export const barcodeFacade = new BarcodeFacade()

// Export factory function for testing
export function createBarcodeFacade(config?: Partial<BarcodeFacadeConfig>): BarcodeFacade {
  return new BarcodeFacade({ ...DEFAULT_CONFIG, ...config })
}