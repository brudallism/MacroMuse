// domain/models/barcode.ts - Pure domain types
import { NutrientVector } from '../models'

export interface BarcodeProductData {
  barcode: string
  name: string
  brand?: string
  nutrients: NutrientVector
  servingSize: {
    amount: number
    unit: string
  }
  confidence: number
  dataSource: 'openfoodfacts' | 'fallback'
}

export interface BarcodeLookupResult {
  success: boolean
  product?: BarcodeProductData
  errorReason?: 'not_found' | 'network_error' | 'invalid_barcode'
}

export interface BarcodeLogEntry {
  barcode: string
  productName: string
  servingSize: number
  nutrients: NutrientVector
  loggedAt: string
  userId: string
}