import React, { useState, useCallback } from 'react'
import { View, StyleSheet, TextInput } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { TabView } from '@ui/molecules/TabView'
import { VirtualizedFoodList } from '@ui/components/VirtualizedFoodList'
import { useTheme } from '@ui/theme/ThemeProvider'
import { tokens } from '@ui/theme/tokens'

// Foundation-compliant: inline interfaces to avoid domain imports
interface FoodNutrients {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  saturated_fat_g?: number
}

interface FoodServingSize {
  amount: number
  unit: string
}

interface FoodItem {
  id: string
  name: string
  brand?: string
  source: 'usda' | 'spoonacular' | 'custom' | 'barcode'
  nutrients: FoodNutrients
  servingSize: FoodServingSize
  confidence?: number
  isFavorite?: boolean
}

export interface SeparatedFoodSearchProps {
  onFoodSelected: (food: FoodItem, servingSize: number, unit: string, mealType?: string) => void
  onCustomFoodCreate: () => void
  onBarcodeScan: () => void
  initialSearchQuery?: string
  currentMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  userId?: string

  // Foundation-compliant: Facades only, no direct domain calls
  searchFacade: {
    search: (query: string, source: 'usda' | 'spoonacular') => Promise<{ results: FoodItem[]; error?: string }>
  }
  recentFoodsFacade: {
    getRecent: (userId: string) => Promise<FoodItem[]>
  }
  favoritesFacade: {
    getFavorites: (userId: string) => Promise<FoodItem[]>
    getCategories: (userId: string) => Promise<string[]>
    toggleFavorite: (userId: string, food: FoodItem) => Promise<boolean>
  }
  customFoodsFacade: {
    getCustom: (userId: string) => Promise<FoodItem[]>
    editCustom: (food: FoodItem) => Promise<void>
    deleteCustom: (foodId: string) => Promise<void>
  }
  portionCalculatorFacade: {
    calculateNutrients: (nutrients: FoodNutrients, baseServing: number, newServing: number, baseUnit: string, newUnit: string) => FoodNutrients
    suggestServingSizes: (food: FoodItem) => { amount: number; unit: string }[]
  }
  mealCategorizationFacade: {
    categorizeFoodForMeal: (foodName: string, mealType: string) => 'excellent' | 'good' | 'fair' | 'poor'
  }
}

type SearchTab = 'foods' | 'recipes'

const searchTabs = [
  { key: 'foods', title: 'Foods', icon: 'apple' },
  { key: 'recipes', title: 'Recipes', icon: 'chef-hat' },
] as const

export const SeparatedFoodSearch: React.FC<SeparatedFoodSearchProps> = ({
  onFoodSelected,
  onCustomFoodCreate,
  onBarcodeScan,
  initialSearchQuery = '',
  currentMealType = 'breakfast',
  userId = 'test-user',
  searchFacade,
  recentFoodsFacade,
  favoritesFacade,
  customFoodsFacade,
  portionCalculatorFacade,
  mealCategorizationFacade
}) => {
  const theme = useTheme()
  const [activeTab, setActiveTab] = useState<SearchTab>('foods')
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchResults, setSearchResults] = useState<FoodItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab as SearchTab)
    // Clear results when switching tabs
    setSearchResults([])
    setError(null)
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const source = activeTab === 'foods' ? 'usda' : 'spoonacular'
      const result = await searchFacade.search(query, source)

      if (result.error) {
        setError(result.error)
        setSearchResults([])
      } else {
        setSearchResults(result.results)
        setError(null)
      }
    } catch (err) {
      setError('Search failed. Please try again.')
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchFacade])

  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text)
    // Debounce search
    setTimeout(() => {
      handleSearch(text)
    }, 300)
  }, [handleSearch])

  const renderSearchContent = (): React.ReactNode => {
    if (isLoading) {
      return (
        <View style={styles.centerMessage}>
          <Text>Searching...</Text>
        </View>
      )
    }

    if (error) {
      return (
        <View style={styles.centerMessage}>
          <Text style={{ color: theme.colors.error }}>
            {error}
          </Text>
        </View>
      )
    }

    if (searchResults.length === 0 && searchQuery.trim()) {
      return (
        <View style={styles.centerMessage}>
          <Text>
            No {activeTab === 'foods' ? 'foods' : 'recipes'} found for "{searchQuery}"
          </Text>
        </View>
      )
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.centerMessage}>
          <Text color="secondary">
            {activeTab === 'foods'
              ? 'Search for whole foods and ingredients'
              : 'Search for recipes and prepared dishes'}
          </Text>
        </View>
      )
    }

    return (
      <VirtualizedFoodList
        foods={searchResults}
        onFoodSelected={onFoodSelected}
        currentMealType={currentMealType}
        portionCalculatorFacade={portionCalculatorFacade}
        mealCategorizationFacade={mealCategorizationFacade}
      />
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Search Type Tabs */}
      <View style={styles.headerSection}>
        <Text variant="title" style={styles.title}>
          Find Food
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          Search for {activeTab === 'foods' ? 'whole foods and ingredients' : 'recipes and prepared dishes'}
        </Text>

        <TabView
          tabs={searchTabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          style={[styles.tabView, { backgroundColor: theme.colors.background.secondary }]}
        />
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <TextInput
          style={[styles.searchInput, {
            backgroundColor: theme.colors.background.secondary,
            color: theme.colors.text,
            borderColor: theme.colors.gray[200]
          }]}
          placeholder={`Search ${activeTab === 'foods' ? 'foods and ingredients' : 'recipes and dishes'}...`}
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchInput}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {/* Search Content */}
      <View style={styles.contentSection}>
        {renderSearchContent()}
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Button
          variant="secondary"
          onPress={onBarcodeScan}
          style={styles.quickActionButton}
        >
          Scan Barcode
        </Button>
        <Button
          variant="outline"
          onPress={onCustomFoodCreate}
          style={styles.quickActionButton}
        >
          Create Custom Food
        </Button>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  tabView: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  contentSection: {
    flex: 1,
  },
  centerMessage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickActionsSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  quickActionButton: {
    flex: 1,
  },
})