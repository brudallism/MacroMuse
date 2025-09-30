// facades/cleanBarcodeFacade.ts - Simple coordination layer
import { BarcodeLookupResult, BarcodeLogEntry } from '../domain/models/barcode'
import { barcodeService } from '../domain/services/barcodeLookup'
import { barcodeLookupAdapter } from '../infra/adapters/cleanBarcodeAdapter'
import { logger } from '../lib/logger'

export interface CleanBarcodeFacade {
  scanBarcode(barcode: string): Promise<BarcodeLookupResult>
  calculatePortionNutrients(result: BarcodeLookupResult, servingRatio: number): BarcodeLookupResult
  createLogEntry(result: BarcodeLookupResult, userId: string, servingRatio?: number): BarcodeLogEntry | null
}

class CleanBarcodeFacadeImpl implements CleanBarcodeFacade {
  async scanBarcode(barcode: string): Promise<BarcodeLookupResult> {
    logger.info('Starting barcode scan', { barcode })

    // Delegate to adapter for external lookup
    const result = await barcodeLookupAdapter.lookupBarcode(barcode)

    logger.info('Barcode scan completed', {
      barcode,
      success: result.success,
      productName: result.product?.name
    })

    return result
  }

  calculatePortionNutrients(result: BarcodeLookupResult, servingRatio: number): BarcodeLookupResult {
    if (!result.success || !result.product) {
      return result
    }

    // Use pure domain service for calculation
    const adjustedNutrients = barcodeService.calculateServingNutrients(
      result.product.nutrients,
      servingRatio
    )

    return {
      ...result,
      product: {
        ...result.product,
        nutrients: adjustedNutrients,
        servingSize: {
          ...result.product.servingSize,
          amount: result.product.servingSize.amount * servingRatio
        }
      }
    }
  }

  createLogEntry(result: BarcodeLookupResult, userId: string, servingRatio: number = 1): BarcodeLogEntry | null {
    if (!result.success || !result.product) {
      return null
    }

    const adjustedResult = this.calculatePortionNutrients(result, servingRatio)
    if (!adjustedResult.product) {
      return null
    }

    return {
      barcode: adjustedResult.product.barcode,
      productName: adjustedResult.product.name,
      servingSize: adjustedResult.product.servingSize.amount,
      nutrients: adjustedResult.product.nutrients,
      loggedAt: new Date().toISOString(),
      userId
    }
  }
}

// Export singleton for app use
export const cleanBarcodeFacade = new CleanBarcodeFacadeImpl()