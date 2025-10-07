import React, { useCallback, useMemo } from 'react'
import { View, StyleSheet, Alert } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { Button } from '@ui/atoms/Button'
import { TabView } from '@ui/molecules/TabView'
import { FoodSearchTabs } from '@ui/components/FoodSearchTabs'
import { useFoodSearchState } from '@ui/hooks/useFoodSearchState'
import { useTheme } from '@ui/theme/ThemeProvider'
import { useFoodListOptimizations } from '@ui/components/VirtualizedFoodList'

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

export interface IntegratedFoodSearchProps {
  onFoodSelected: (food: FoodItem, servingSize: number, unit: string, mealType?: string) => void
  onCustomFoodCreate: () => void
  onBarcodeScan: () => void
  initialSearchQuery?: string
  currentMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  userId?: string
  // Facade functions - no direct domain calls
  searchFacade: {
    search: (query: string) => Promise<{ results: FoodItem[]; error?: string }>
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
    suggestServingSizes: (food: FoodItem) => Array<{ amount: number; unit: string }>
  }
  mealCategorizationFacade: {
    categorizeFoodForMeal: (foodName: string, mealType: string) => 'excellent' | 'good' | 'fair' | 'poor'
  }
}

type TabKey = 'search' | 'recent' | 'favorites' | 'custom'

interface TabData {
  key: TabKey
  title: string
  icon?: string
}

const TABS: TabData[] = [
  { key: 'search', title: 'Search', icon: 'search' },
  { key: 'recent', title: 'Recent', icon: 'clock' },
  { key: 'favorites', title: 'Favorites', icon: 'heart' },
  { key: 'custom', title: 'Custom', icon: 'plus-circle' }
]

export const IntegratedFoodSearch: React.FC<IntegratedFoodSearchProps> = ({
  onFoodSelected,
  onCustomFoodCreate,
  onBarcodeScan,
  initialSearchQuery = '',
  currentMealType,
  userId = 'current_user',
  searchFacade,
  recentFoodsFacade,
  favoritesFacade,
  customFoodsFacade,
  portionCalculatorFacade,
  mealCategorizationFacade
}) => {
  const theme = useTheme()
  const { debouncedSearch } = useFoodListOptimizations()

  const facades = {
    searchFacade,
    recentFoodsFacade,
    favoritesFacade,
    customFoodsFacade
  }

  const {
    activeTab,
    setActiveTab,
    searchState,
    recentFoods,
    favoriteFoods,
    customFoods,
    favoriteCategories,
    selectedFavoriteCategory,
    setSelectedFavoriteCategory,
    isLoadingRecent,
    isLoadingFavorites,
    isLoadingCustom,
    selectedFood,
    setSelectedFood,
    servingAmount,
    setServingAmount,
    servingUnit,
    setServingUnit,
    performSearch,
    handleSearchQueryChange,
    handleFoodPress,
    handleToggleFavorite,
    handleDeleteCustomFood
  } = useFoodSearchState({
    userId,
    initialSearchQuery,
    facades
  })

  // Optimized debounced search
  const debouncedSearchFn = useMemo(() =>
    debouncedSearch((query: string) => {
      if (query.length >= 2) {
        performSearch(query)
      }
    }, 300),
    [debouncedSearch, performSearch]
  )

  const handleSearchQueryChangeDebounced = useCallback((query: string) => {
    handleSearchQueryChange(query)
    debouncedSearchFn(query)
  }, [handleSearchQueryChange, debouncedSearchFn])

  const handleAddToLog = useCallback((food: FoodItem) => {
    if (selectedFood?.id === food.id) {
      // Use custom serving size
      onFoodSelected(food, servingAmount, servingUnit, currentMealType)
    } else {
      // Use default serving size
      onFoodSelected(food, food.servingSize.amount, food.servingSize.unit, currentMealType)
    }
    setSelectedFood(null)
  }, [selectedFood, servingAmount, servingUnit, currentMealType, onFoodSelected, setSelectedFood])

  const handleToggleFavoriteWithError = useCallback(async (food: FoodItem) => {
    try {
      await handleToggleFavorite(food)
    } catch (error) {
      Alert.alert('Error', 'Failed to update favorite status')
    }
  }, [handleToggleFavorite])

  const handleEditCustomFood = useCallback((food: FoodItem) => {
    console.log('Edit custom food:', food.name)
  }, [])

  const handleDeleteCustomFoodWithAlert = useCallback(async (food: FoodItem) => {
    Alert.alert(
      'Delete Food',
      `Are you sure you want to delete "${food.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await handleDeleteCustomFood(food)
            } catch (error) {
              Alert.alert('Error', 'Failed to delete food')
            }
          }
        }
      ]
    )
  }, [handleDeleteCustomFood])

  const handleCalculatePortion = useCallback((
    nutrients: FoodNutrients,
    baseServing: number,
    newServing: number,
    baseUnit: string,
    newUnit: string
  ) => {
    return portionCalculatorFacade.calculateNutrients(
      nutrients,
      baseServing,
      newServing,
      baseUnit,
      newUnit
    )
  }, [portionCalculatorFacade])

  const handleSuggestMealType = useCallback((foodName: string, mealType: string) => {
    return mealCategorizationFacade.categorizeFoodForMeal(foodName, mealType)
  }, [mealCategorizationFacade])

  const renderPortionAdjustment = () => {
    if (!selectedFood) return null

    const suggestions = portionCalculatorFacade.suggestServingSizes(selectedFood).slice(0, 6)

    return (
      <View style={styles.portionContainer}>
        <View style={styles.portionHeader}>
          <Text variant="heading3">{selectedFood.name}</Text>
          <Button
            title="×"
            onPress={() => setSelectedFood(null)}
            variant="ghost"
            size="small"
          />
        </View>

        <Text variant="caption" color="secondary" style={styles.portionLabel}>
          Adjust serving size:
        </Text>

        <View style={styles.servingSuggestions}>
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              title={`${suggestion.amount}${suggestion.unit}`}
              onPress={() => {
                setServingAmount(suggestion.amount)
                setServingUnit(suggestion.unit)
              }}
              variant={
                servingAmount === suggestion.amount && servingUnit === suggestion.unit
                  ? 'primary'
                  : 'outline'
              }
              size="small"
              style={styles.suggestionButton}
            />
          ))}
        </View>

        <Button
          title="Add to Log"
          onPress={() => handleAddToLog(selectedFood)}
          variant="primary"
          style={styles.addButton}
        />
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <TabView
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabKey)}
      />

      <View style={styles.content}>
        <FoodSearchTabs
          activeTab={activeTab}
          searchState={searchState}
          recentFoods={recentFoods}
          favoriteFoods={favoriteFoods}
          customFoods={customFoods}
          favoriteCategories={favoriteCategories}
          selectedFavoriteCategory={selectedFavoriteCategory}
          isLoadingRecent={isLoadingRecent}
          isLoadingFavorites={isLoadingFavorites}
          isLoadingCustom={isLoadingCustom}
          currentMealType={currentMealType}
          onSearchQueryChange={handleSearchQueryChangeDebounced}
          onFoodPress={handleFoodPress}
          onAddToLog={handleAddToLog}
          onToggleFavorite={handleToggleFavoriteWithError}
          onEditCustomFood={handleEditCustomFood}
          onDeleteCustomFood={handleDeleteCustomFoodWithAlert}
          onCustomFoodCreate={onCustomFoodCreate}
          onBarcodeScan={onBarcodeScan}
          onFavoriteCategoryChange={setSelectedFavoriteCategory}
          onCalculatePortion={handleCalculatePortion}
          onSuggestMealType={handleSuggestMealType}
        />
      </View>

      {renderPortionAdjustment()}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  portionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F3EFE9', // theme.colors.background.light.secondary
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  portionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portionLabel: {
    marginBottom: 8,
  },
  servingSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  suggestionButton: {
    paddingHorizontal: 12,
  },
  addButton: {
    marginTop: 8,
  },
})