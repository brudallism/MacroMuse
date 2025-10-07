import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { searchFacade } from '@facades/searchFacade'

import { TabView } from '@ui/molecules/TabView'
import { SeparatedFoodSearch } from '@ui/screens/SeparatedFoodSearch'
// import { BarcodeFlow } from '@ui/screens/BarcodeFlow' // Complex facades causing issues
import { CleanBarcodeScanner } from '@ui/screens/CleanBarcodeScanner'
import { SimpleDashboard } from '@ui/screens/SimpleDashboard'
import { PlaygroundScreen } from '@ui/screens/PlaygroundScreen'
import { useTheme } from '@ui/theme/ThemeProvider'
import { Text } from '@ui/atoms/Text'

import { logger } from '@lib/logger'
// import { advancedFoodFacade } from '@facades/advancedFoodFacade' // Testing: disabled to isolate error

type Screen = 'dashboard' | 'search' | 'barcode' | 'profile' | 'playground'

const tabs = [
  { key: 'dashboard', title: 'Dashboard', icon: 'home' },
  { key: 'search', title: 'Food Search', icon: 'search' },
  { key: 'barcode', title: 'Scan', icon: 'barcode' },
  { key: 'profile', title: 'Profile', icon: 'user' },
  { key: 'playground', title: 'Components', icon: 'grid' },
]

export const AppNavigator: React.FC = () => {
  const theme = useTheme()
  const [activeScreen, setActiveScreen] = useState<Screen>('search') // Start with search for testing
  const [showBarcodeFlow, setShowBarcodeFlow] = useState(false)

  // Real facades with error handling for missing implementations
  const realSearchFacade = {
    search: async (query: string, source: 'usda' | 'spoonacular' = 'usda') => {
      try {
        const results = await searchFacade.searchFoods(query, source)
        return { results }
      } catch (error) {
        logger.error('Search facade error', { error })
        return { results: [], error: 'Search temporarily unavailable' }
      }
    }
  }

  const realRecentFoodsFacade = {
    getRecent: async (userId: string) => {
      try {
        // Fixed: dataStore methods now implemented
        // return await advancedFoodFacade.getRecentFoods(userId, 10)
        logger.info('Recent foods facade temporarily disabled for debugging')
        return []
      } catch (error) {
        logger.error('Recent foods error', { error })
        return []
      }
    }
  }

  const realFavoritesFacade = {
    getFavorites: async (userId: string) => {
      try {
        // TODO: Fix property configuration issue in advancedFoodFacade
        logger.info('Favorites requested for user (mocked)', { userId })
        return []
        // return await advancedFoodFacade.getFavorites(userId)
      } catch (error) {
        logger.error('Favorites error', { error })
        return []
      }
    },
    getCategories: async (userId: string) => {
      try {
        logger.info('Favorite categories requested for user (mocked)', { userId })
        return []
        // return await advancedFoodFacade.getFavoriteCategories(userId)
      } catch (error) {
        logger.error('Favorite categories error', { error })
        return []
      }
    },
    toggleFavorite: async (userId: string, food: any) => {
      try {
        logger.info('Toggle favorite requested (mocked)', { userId, foodId: food.id })
        return false
        // const isFav = await advancedFoodFacade.isFavorite(userId, food.id)
        // if (isFav) {
        //   await advancedFoodFacade.removeFromFavorites(userId, food.id)
        // } else {
        //   await advancedFoodFacade.addToFavorites(userId, food)
        // }
        // return !isFav
      } catch (error) {
        logger.error('Toggle favorite error', { error })
        return false
      }
    }
  }

  const realCustomFoodsFacade = {
    getCustom: async (userId: string) => {
      try {
        logger.info('Custom foods requested for user (mocked)', { userId })
        return []
        // return await advancedFoodFacade.getCustomFoods(userId)
      } catch (error) {
        logger.error('Custom foods error', { error })
        return []
      }
    },
    editCustom: async (food: any) => {
      try {
        logger.info('Edit custom food requested (mocked)', { foodId: food.id })
        // await advancedFoodFacade.updateCustomFood('test-user', food.id, food)
      } catch (error) {
        logger.error('Edit custom food error', { error })
      }
    },
    deleteCustom: async (foodId: string) => {
      try {
        logger.info('Delete custom food requested (mocked)', { foodId })
        // await advancedFoodFacade.deleteCustomFood('test-user', foodId)
      } catch (error) {
        logger.error('Delete custom food error', { error })
      }
    }
  }

  const realPortionCalculatorFacade = {
    calculateNutrients: (nutrients: any, baseServing: number, newServing: number, /*baseUnit: string, newUnit: string*/) => {
      try {
        // Use fallback calculation instead of problematic facade method
        const ratio = newServing / baseServing
        return {
          calories: Math.round(nutrients.calories * ratio),
          protein_g: Math.round(nutrients.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(nutrients.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(nutrients.fat_g * ratio * 10) / 10,
        }
        // const food = { nutrients, servingSize: { amount: baseServing, unit: 'serving' } } as any
        // return advancedFoodFacade.calculateNutrients(food, newServing, 'serving')
      } catch (error) {
        logger.error('Calculate nutrients error', { error })
        const ratio = newServing / baseServing
        return {
          calories: Math.round(nutrients.calories * ratio),
          protein_g: Math.round(nutrients.protein_g * ratio * 10) / 10,
          carbs_g: Math.round(nutrients.carbs_g * ratio * 10) / 10,
          fat_g: Math.round(nutrients.fat_g * ratio * 10) / 10,
        }
      }
    },
    suggestServingSizes: (food: any) => {
      try {
        logger.info('Suggest serving sizes requested (mocked)', { foodId: food?.id })
        return [
          { amount: 1, unit: 'serving' },
          { amount: 100, unit: 'g' },
          { amount: 1, unit: 'cup' }
        ]
        // return advancedFoodFacade.getServingSuggestions(food)
      } catch (error) {
        logger.error('Suggest serving sizes error', { error })
        return [
          { amount: 1, unit: 'serving' },
          { amount: 100, unit: 'g' },
          { amount: 1, unit: 'cup' }
        ]
      }
    }
  }

  const realMealCategorizationFacade = {
    categorizeFoodForMeal: (foodName: string, mealType: string) => {
      try {
        logger.info('Categorize food for meal requested (mocked)', { foodName, mealType })
        return 'good' as 'excellent' | 'good' | 'fair' | 'poor'
        // const food = { name: foodName } as any
        // return advancedFoodFacade.categorizeFoodForMeal(food, mealType as any)
      } catch (error) {
        logger.error('Categorize food error', { error })
        return 'good' as 'excellent' | 'good' | 'fair' | 'poor'
      }
    }
  }

  const handleFoodSelected = (food: any, servingSize: number, unit: string, mealType?: string) => {
    logger.info('Food selected for logging', {
      foodId: food.id,
      foodName: food.name,
      servingSize,
      unit,
      mealType
    })

    // In a real app, this would add to the meal log
    // For now, just log the selection
    alert(`Added ${food.name} (${servingSize}${unit}) to your log!`)
  }

  const handleCustomFoodCreate = () => {
    logger.info('Custom food creation requested')
    alert('Custom food creation - would open custom food form')
  }

  const handleBarcodeScan = () => {
    setShowBarcodeFlow(true)
  }

  const handleBarcodeComplete = () => {
    logger.info('AppNavigator handleBarcodeComplete called')
    setShowBarcodeFlow(false)
  }

  const handleManualEntry = () => {
    logger.info('AppNavigator handleManualEntry called')
    setShowBarcodeFlow(false)
    setActiveScreen('search')
  }

  const handleProductFound = (productName: string, nutrients: any, barcode: string) => {
    logger.info('Product found from barcode scan', {
      productName,
      barcode,
      nutrients
    })

    // In a real app, this would add to the meal log
    // For now, just show confirmation
    alert(`Added ${productName} to your log!\n\nCalories: ${nutrients.calories || 'N/A'}\nProtein: ${nutrients.protein_g || 'N/A'}g`)
  }

  const renderScreen = () => {
    if (showBarcodeFlow) {
      return (
        <CleanBarcodeScanner
          onProductFound={handleProductFound}
          onComplete={handleBarcodeComplete}
          onManualEntry={handleManualEntry}
          userId="test-user"
        />
      )
    }

    switch (activeScreen) {
      case 'dashboard':
        return (
          <SimpleDashboard />
        )
      case 'search':
        return (
          <SeparatedFoodSearch
            onFoodSelected={handleFoodSelected}
            onCustomFoodCreate={handleCustomFoodCreate}
            onBarcodeScan={handleBarcodeScan}
            userId="test-user"
            searchFacade={realSearchFacade}
            recentFoodsFacade={realRecentFoodsFacade}
            favoritesFacade={realFavoritesFacade}
            customFoodsFacade={realCustomFoodsFacade}
            portionCalculatorFacade={realPortionCalculatorFacade}
            mealCategorizationFacade={realMealCategorizationFacade}
          />
        )
      case 'barcode':
        return (
          <CleanBarcodeScanner
            onProductFound={handleProductFound}
            onComplete={() => setActiveScreen('search')} // Go back to search when done
            onManualEntry={() => setActiveScreen('search')} // Go to search for manual entry
            userId="test-user"
          />
        )
      case 'profile':
        return (
          <View style={styles.placeholder}>
            <Text style={{ color: theme.colors.text.primary }}>
              Profile screen coming soon!
            </Text>
          </View>
        )
      case 'playground':
        return <PlaygroundScreen />
      default:
        return null
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />

        {!showBarcodeFlow && (
          <TabView
            tabs={tabs}
            activeTab={activeScreen}
            onTabChange={(tab) => setActiveScreen(tab as Screen)}
            style={[styles.tabView, { backgroundColor: theme.colors.background.secondary }]}
          />
        )}

        <View style={styles.content}>
          {renderScreen()}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabView: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
})