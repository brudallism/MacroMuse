import { FoodSearchResult } from '@domain/models'

import { logger } from '@lib/logger'

interface DeduplicationConfig {
  nameThreshold: number
  nutrientThreshold: number
  preferenceOrder: Array<'usda' | 'spoonacular' | 'custom'>
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  nameThreshold: 0.85, // 85% similarity for name matching
  nutrientThreshold: 0.90, // 90% similarity for nutrient matching
  preferenceOrder: ['usda', 'spoonacular', 'custom'] // USDA preferred per requirements
}

export class FoodDedupeService {
  constructor(private config: DeduplicationConfig = DEFAULT_CONFIG) {}

  async deduplicate(results: FoodSearchResult[]): Promise<FoodSearchResult[]> {
    if (results.length <= 1) {
      return results
    }

    const groups = this.groupSimilarFoods(results)
    const deduplicated = this.selectBestFromGroups(groups)

    logger.debug('Food deduplication completed', {
      originalCount: results.length,
      deduplicatedCount: deduplicated.length,
      groupsFound: groups.length
    })

    return deduplicated
  }

  private groupSimilarFoods(results: FoodSearchResult[]): FoodSearchResult[][] {
    const groups: FoodSearchResult[][] = []
    const processed = new Set<number>()

    for (let i = 0; i < results.length; i++) {
      if (processed.has(i)) continue

      const group: FoodSearchResult[] = [results[i]]
      processed.add(i)

      for (let j = i + 1; j < results.length; j++) {
        if (processed.has(j)) continue

        if (this.areFoodsSimilar(results[i], results[j])) {
          group.push(results[j])
          processed.add(j)
        }
      }

      groups.push(group)
    }

    return groups
  }

  private areFoodsSimilar(food1: FoodSearchResult, food2: FoodSearchResult): boolean {
    // Generate deterministic IDs for comparison
    const id1 = this.generateDeterministicId(food1)
    const id2 = this.generateDeterministicId(food2)

    if (id1 === id2) {
      return true
    }

    // Check name similarity
    const nameSimilarity = this.calculateNameSimilarity(food1.name, food2.name)
    if (nameSimilarity < this.config.nameThreshold) {
      return false
    }

    // Check nutrient similarity
    const nutrientSimilarity = this.calculateNutrientSimilarity(food1.nutrients, food2.nutrients)

    return nutrientSimilarity >= this.config.nutrientThreshold
  }

  private generateDeterministicId(food: FoodSearchResult): string {
    // Create a deterministic ID based on normalized name and key nutrients
    const normalizedName = this.normalizeName(food.name)
    const keyNutrients = [
      food.nutrients.calories || 0,
      food.nutrients.protein_g || 0,
      food.nutrients.carbs_g || 0,
      food.nutrients.fat_g || 0
    ].map(n => Math.round(n * 100) / 100) // Round to 2 decimal places

    return `${normalizedName}:${keyNutrients.join(':')}`
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .replace(/\b(raw|cooked|fresh|frozen|canned|dried)\b/g, '') // Remove common modifiers
      .trim()
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const norm1 = this.normalizeName(name1)
    const norm2 = this.normalizeName(name2)

    if (norm1 === norm2) {
      return 1.0
    }

    // Use Jaccard similarity on word sets
    const words1 = new Set(norm1.split(/\s+/))
    const words2 = new Set(norm2.split(/\s+/))

    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  private calculateNutrientSimilarity(nutrients1: Record<string, unknown>, nutrients2: Record<string, unknown>): number {
    const keyNutrients = ['calories', 'protein_g', 'carbs_g', 'fat_g']
    let totalDifference = 0
    let comparedCount = 0

    for (const nutrient of keyNutrients) {
      const value1 = typeof nutrients1[nutrient] === 'number' ? nutrients1[nutrient] as number : 0
      const value2 = typeof nutrients2[nutrient] === 'number' ? nutrients2[nutrient] as number : 0

      // Skip if both are zero
      if (value1 === 0 && value2 === 0) {
        continue
      }

      const maxValue = Math.max(value1, value2)
      if (maxValue === 0) {
        continue
      }

      const difference = Math.abs(value1 - value2) / maxValue
      totalDifference += difference
      comparedCount++
    }

    if (comparedCount === 0) {
      return 1.0 // Both have no nutrient data, consider them similar
    }

    const averageDifference = totalDifference / comparedCount
    return Math.max(0, 1 - averageDifference)
  }

  private selectBestFromGroups(groups: FoodSearchResult[][]): FoodSearchResult[] {
    return groups.map(group => this.selectBestFromGroup(group))
  }

  private selectBestFromGroup(group: FoodSearchResult[]): FoodSearchResult {
    if (group.length === 1) {
      return group[0]
    }

    // Sort by preference order first, then by confidence
    const sorted = group.sort((a, b) => {
      // Prefer USDA on exact matches as per requirements
      const aPreferenceIndex = this.config.preferenceOrder.indexOf(a.source)
      const bPreferenceIndex = this.config.preferenceOrder.indexOf(b.source)

      if (aPreferenceIndex !== bPreferenceIndex) {
        return aPreferenceIndex - bPreferenceIndex
      }

      // If same source preference, prefer higher confidence
      const aConfidence = a.confidence || 0
      const bConfidence = b.confidence || 0

      if (Math.abs(aConfidence - bConfidence) > 0.1) {
        return bConfidence - aConfidence
      }

      // If confidence is similar, prefer more complete nutrient data
      const aNutrientCount = this.countNonZeroNutrients(a.nutrients)
      const bNutrientCount = this.countNonZeroNutrients(b.nutrients)

      return bNutrientCount - aNutrientCount
    })

    const selected = sorted[0]
    if (!selected) {
      throw new Error('No foods in group to select from')
    }

    // Log the merge decision for debugging
    if (group.length > 1) {
      logger.debug('Merged duplicate foods', {
        selected: { id: selected.id, name: selected.name, source: selected.source },
        merged: group.slice(1).map(f => ({ id: f.id, name: f.name, source: f.source }))
      })
    }

    return selected
  }

  private countNonZeroNutrients(nutrients: Record<string, unknown>): number {
    return Object.values(nutrients).filter(value =>
      typeof value === 'number' && value > 0
    ).length
  }

  // Method to boost confidence for exact USDA matches as per requirements
  enhanceConfidenceScoring(results: FoodSearchResult[], query: string): FoodSearchResult[] {
    return results.map(result => {
      if (result.source === 'usda' && result.confidence && result.confidence >= 0.9) {
        // Boost USDA confidence for exact matches
        return {
          ...result,
          confidence: Math.min(1.0, result.confidence + 0.05)
        }
      }
      return result
    })
  }
}