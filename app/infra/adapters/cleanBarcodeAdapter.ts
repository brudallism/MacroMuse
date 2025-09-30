// infra/adapters/cleanBarcodeAdapter.ts - External API integration (IO boundary)
import { BarcodeProductData, BarcodeLookupResult } from '../../domain/models/barcode'
import { barcodeService } from '../../domain/services/barcodeLookup'
import { logger } from '../../lib/logger'

export interface BarcodeAdapter {
  lookupBarcode(barcode: string): Promise<BarcodeLookupResult>
}

export class OpenFoodFactsBarcodeAdapter implements BarcodeAdapter {
  private readonly baseUrl = 'https://world.openfoodfacts.org/api/v2/product'
  private readonly userAgent = 'MacroMuse/1.0.0 (nutrition tracker app)'

  async lookupBarcode(barcode: string): Promise<BarcodeLookupResult> {
    // Use pure domain validation
    if (!barcodeService.validateBarcode(barcode)) {
      return {
        success: false,
        errorReason: 'invalid_barcode'
      }
    }

    try {
      logger.info('Attempting to fetch product data', { barcode, url: `${this.baseUrl}/${barcode.trim()}.json` })
      const response = await this.fetchProduct(barcode)

      logger.info('Fetch response received', { barcode, status: response.status, ok: response.ok })

      if (!response.ok) {
        logger.warn('OpenFoodFacts API error', {
          barcode,
          status: response.status,
          statusText: response.statusText
        })
        return {
          success: false,
          errorReason: 'network_error'
        }
      }

      const rawData = await response.json()
      logger.info('JSON data parsed successfully', { barcode, hasProduct: !!rawData.product })

      // Use pure domain service to normalize data
      const product = barcodeService.normalizeOpenFoodFactsData(rawData)

      if (!product) {
        logger.info('Product not found in OpenFoodFacts', { barcode })
        return {
          success: false,
          errorReason: 'not_found'
        }
      }

      logger.info('Successfully looked up product', {
        barcode,
        productName: product.name,
        confidence: product.confidence
      })

      return {
        success: true,
        product
      }

    } catch (error) {
      logger.error('Barcode lookup failed', {
        barcode,
        error: error instanceof Error ? error.message : String(error),
        errorType: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      })
      return {
        success: false,
        errorReason: 'network_error'
      }
    }
  }

  private async fetchProduct(barcode: string): Promise<Response> {
    return fetch(`${this.baseUrl}/${barcode.trim()}.json`, {
      headers: {
        'User-Agent': this.userAgent
      }
      // Removed AbortSignal.timeout - not supported in React Native
    })
  }
}

// Export singleton for app use
export const barcodeLookupAdapter = new OpenFoodFactsBarcodeAdapter()