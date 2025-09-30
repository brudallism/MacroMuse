// domain/services/barcodeLookup.ts - Pure domain logic (no IO)
import { BarcodeProductData, BarcodeLookupResult } from '../models/barcode'
import { NutrientVector } from '../models'

export interface BarcodeLookupService {
  validateBarcode(barcode: string): boolean
  normalizeOpenFoodFactsData(rawData: any): BarcodeProductData | null
  calculateServingNutrients(nutrients: NutrientVector, ratio: number): NutrientVector
}

export class BarcodeServiceImpl implements BarcodeLookupService {
  validateBarcode(barcode: string): boolean {
    // Pure validation logic
    if (!barcode || typeof barcode !== 'string') return false
    return /^\d{8,14}$/.test(barcode.trim())
  }

  normalizeOpenFoodFactsData(rawData: any): BarcodeProductData | null {
    // Pure transformation logic
    if (!rawData || !rawData.product) {
      return null
    }

    const product = rawData.product
    const nutrients = this.extractNutrients(product.nutriments || {})

    return {
      barcode: product.code || 'unknown',
      name: product.product_name || 'Unknown Product',
      brand: product.brands || undefined,
      nutrients,
      servingSize: this.determineServingSize(product),
      confidence: this.calculateConfidence(product),
      dataSource: 'openfoodfacts'
    }
  }

  calculateServingNutrients(nutrients: NutrientVector, ratio: number): NutrientVector {
    // Pure calculation logic
    const result: NutrientVector = {}

    Object.entries(nutrients).forEach(([key, value]) => {
      if (typeof value === 'number') {
        result[key as keyof NutrientVector] = Math.round((value * ratio) * 100) / 100
      }
    })

    return result
  }

  private extractNutrients(nutriments: any): NutrientVector {
    return {
      calories: nutriments['energy-kcal_100g'] || (
        nutriments['energy-kj_100g'] ?
        Math.round(nutriments['energy-kj_100g'] / 4.184) :
        undefined
      ),
      protein_g: nutriments.proteins_100g,
      carbs_g: nutriments.carbohydrates_100g,
      fat_g: nutriments.fat_100g,
      fiber_g: nutriments.fiber_100g,
      sodium_mg: nutriments.sodium_100g ? nutriments.sodium_100g * 1000 : undefined,
    }
  }

  private determineServingSize(product: any): { amount: number; unit: string } {
    // Try to extract serving size from product data
    if (product.serving_size) {
      const match = product.serving_size.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/)
      if (match) {
        return {
          amount: parseFloat(match[1]),
          unit: match[2].toLowerCase()
        }
      }
    }

    // Default to 100g
    return { amount: 100, unit: 'g' }
  }

  private calculateConfidence(product: any): number {
    let confidence = 0.5 // Base confidence

    if (product.product_name) confidence += 0.2
    if (product.brands) confidence += 0.1
    if (product.nutriments?.['energy-kcal_100g']) confidence += 0.2

    return Math.min(confidence, 1.0)
  }
}

// Export singleton for app use
export const barcodeService = new BarcodeServiceImpl()