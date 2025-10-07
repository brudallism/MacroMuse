import React from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { SearchInput } from '@ui/atoms/SearchInput'
import { SearchResults } from '@ui/components/SearchResults'
import { useTheme } from '@ui/theme/ThemeProvider'

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

type TabKey = 'search' | 'recent' | 'favorites' | 'custom'

interface SearchState {
  query: string
  results: FoodItem[]
  isLoading: boolean
  error: string | null
}

interface FoodSearchTabsProps {
  activeTab: TabKey
  searchState: SearchState
  recentFoods: FoodItem[]
  favoriteFoods: FoodItem[]
  customFoods: FoodItem[]
  favoriteCategories: string[]
  selectedFavoriteCategory?: string
  isLoadingRecent: boolean
  isLoadingFavorites: boolean
  isLoadingCustom: boolean
  currentMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  onSearchQueryChange: (query: string) => void
  onFoodPress: (food: FoodItem) => void
  onAddToLog: (food: FoodItem) => void
  onToggleFavorite: (food: FoodItem) => void
  onEditCustomFood: (food: FoodItem) => void
  onDeleteCustomFood: (food: FoodItem) => void
  onCustomFoodCreate: () => void
  onBarcodeScan: () => void
  onFavoriteCategoryChange: (category: string | undefined) => void
  onCalculatePortion?: (nutrients: FoodNutrients, baseServing: number, newServing: number, baseUnit: string, newUnit: string) => FoodNutrients
  onSuggestMealType?: (foodName: string, mealType: string) => 'excellent' | 'good' | 'fair' | 'poor'
}

export const FoodSearchTabs: React.FC<FoodSearchTabsProps> = ({
  activeTab,
  searchState,
  recentFoods,
  favoriteFoods,
  customFoods,
  favoriteCategories,
  selectedFavoriteCategory,
  isLoadingRecent,
  isLoadingFavorites,
  isLoadingCustom,
  currentMealType,
  onSearchQueryChange,
  onFoodPress,
  onAddToLog,
  onToggleFavorite,
  onEditCustomFood,
  onDeleteCustomFood,
  onCustomFoodCreate,
  onBarcodeScan,
  onFavoriteCategoryChange,
  onCalculatePortion,
  onSuggestMealType
}) => {
  const theme = useTheme()

  const getEmptyStateText = (): string => {
    switch (activeTab) {
      case 'search':
        if (!searchState.query) return 'Enter a food name to search'
        if (searchState.error) return searchState.error
        return 'No foods found for your search'
      case 'recent':
        return 'No recently used foods yet.\nFoods you log will appear here.'
      case 'favorites':
        return 'No favorite foods yet.\nTap the heart icon on foods to save them here.'
      case 'custom':
        return 'No custom foods yet.\nCreate your own foods for items not found in search.'
      default:
        return 'No results'
    }
  }

  const filteredFavoriteFoods = selectedFavoriteCategory
    ? favoriteFoods.filter(food =>
        food.source === selectedFavoriteCategory ||
        (selectedFavoriteCategory === 'other' && !['usda', 'spoonacular', 'custom'].includes(food.source))
      )
    : favoriteFoods

  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchHeader}>
        <SearchInput
          value={searchState.query}
          onChangeText={onSearchQueryChange}
          placeholder="Search for foods..."
          style={styles.searchInput}
        />
        <Button
          title="Scan Barcode"
          onPress={onBarcodeScan}
          variant="outline"
          size="small"
          style={styles.barcodeButton}
        />
      </View>

      <SearchResults
        foods={searchState.results}
        loading={searchState.isLoading}
        emptyStateText={getEmptyStateText()}
        onFoodPress={onFoodPress}
        onAddToLog={onAddToLog}
        onToggleFavorite={onToggleFavorite}
        currentMealType={currentMealType}
        onCalculatePortion={onCalculatePortion}
        onSuggestMealType={onSuggestMealType}
      />
    </View>
  )

  const renderRecentTab = () => (
    <SearchResults
      foods={recentFoods}
      loading={isLoadingRecent}
      emptyStateText={getEmptyStateText()}
      onFoodPress={onFoodPress}
      onAddToLog={onAddToLog}
      onToggleFavorite={onToggleFavorite}
      currentMealType={currentMealType}
      onCalculatePortion={onCalculatePortion}
      onSuggestMealType={onSuggestMealType}
    />
  )

  const renderFavoritesTab = () => (
    <View style={styles.tabContent}>
      {favoriteCategories.length > 0 && (
        <View style={styles.categoryFilter}>
          <Text variant="caption" color="secondary" style={styles.filterLabel}>
            Filter by source:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryButtons}
          >
            <Button
              title="All"
              onPress={() => onFavoriteCategoryChange(undefined)}
              variant={selectedFavoriteCategory === undefined ? 'primary' : 'outline'}
              size="small"
              style={styles.categoryButton}
            />
            {favoriteCategories.map((category) => (
              <Button
                key={category}
                title={category.charAt(0).toUpperCase() + category.slice(1)}
                onPress={() => onFavoriteCategoryChange(category)}
                variant={selectedFavoriteCategory === category ? 'primary' : 'outline'}
                size="small"
                style={styles.categoryButton}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <SearchResults
        foods={filteredFavoriteFoods}
        loading={isLoadingFavorites}
        emptyStateText={getEmptyStateText()}
        onFoodPress={onFoodPress}
        onAddToLog={onAddToLog}
        onToggleFavorite={onToggleFavorite}
        currentMealType={currentMealType}
        onCalculatePortion={onCalculatePortion}
        onSuggestMealType={onSuggestMealType}
      />
    </View>
  )

  const renderCustomTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.customHeader}>
        <Button
          title="Create Custom Food"
          onPress={onCustomFoodCreate}
          variant="primary"
          style={styles.createButton}
        />
      </View>

      <SearchResults
        foods={customFoods}
        loading={isLoadingCustom}
        emptyStateText={getEmptyStateText()}
        onFoodPress={onFoodPress}
        onAddToLog={onAddToLog}
        onToggleFavorite={onToggleFavorite}
        onEditCustomFood={onEditCustomFood}
        onDeleteCustomFood={onDeleteCustomFood}
        currentMealType={currentMealType}
        onCalculatePortion={onCalculatePortion}
        onSuggestMealType={onSuggestMealType}
      />
    </View>
  )

  switch (activeTab) {
    case 'search':
      return renderSearchTab()
    case 'recent':
      return renderRecentTab()
    case 'favorites':
      return renderFavoritesTab()
    case 'custom':
      return renderCustomTab()
    default:
      return null
  }
}

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
  },
  barcodeButton: {
    paddingHorizontal: 12,
  },
  categoryFilter: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  filterLabel: {
    marginBottom: 8,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
  },
  customHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createButton: {
    alignSelf: 'flex-start',
  },
})