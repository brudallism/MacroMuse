import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { TabView } from '@ui/molecules/TabView'
import { SeparatedFoodSearch } from '@ui/screens/SeparatedFoodSearch'
import { BarcodeFlow } from '@ui/screens/BarcodeFlow'
import { SimpleDashboard } from '@ui/screens/SimpleDashboard'
import { PlaygroundScreen } from '@ui/screens/PlaygroundScreen'
import { useTheme } from '@ui/theme/ThemeProvider'
import { logger } from '@lib/logger'
import { Text } from '@ui/atoms/Text'
import { searchFacade } from '@facades/searchFacade'

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

  // Mock facades to prevent undefined errors - using real searchFacade
  const mockSearchFacade = {
    search: async (query: string, source: 'usda' | 'spoonacular' = 'usda') => {
      // Use real search facade with source parameter
      try {
        const results = await searchFacade.searchFoods(query, source)
        return { results }
      } catch (error) {
        logger.error('Search facade error', { error })
        return { results: [], error: 'Search temporarily unavailable' }
      }
    }
  }

  const mockRecentFoodsFacade = {
    getRecent: async (/*userId: string*/) => {
      return []
    }
  }

  const mockFavoritesFacade = {
    getFavorites: async (/*userId: string*/) => {
      return []
    },
    getCategories: async (/*userId: string*/) => {
      return []
    },
    toggleFavorite: async (/*userId: string, food: any*/) => {
      return true
    }
  }

  const mockCustomFoodsFacade = {
    getCustom: async (/*userId: string*/) => {
      return []
    },
    editCustom: async (/*food: any*/) => {
      // Mock implementation
    },
    deleteCustom: async (/*foodId: string*/) => {
      // Mock implementation
    }
  }

  const mockPortionCalculatorFacade = {
    calculateNutrients: (nutrients: any, baseServing: number, newServing: number, /*baseUnit: string, newUnit: string*/) => {
      const ratio = newServing / baseServing
      return {
        calories: Math.round(nutrients.calories * ratio),
        protein_g: Math.round(nutrients.protein_g * ratio * 10) / 10,
        carbs_g: Math.round(nutrients.carbs_g * ratio * 10) / 10,
        fat_g: Math.round(nutrients.fat_g * ratio * 10) / 10,
      }
    },
    suggestServingSizes: (food: any) => {
      return [
        { amount: 1, unit: 'serving' },
        { amount: 100, unit: 'g' },
        { amount: 1, unit: 'cup' }
      ]
    }
  }

  const mockMealCategorizationFacade = {
    categorizeFoodForMeal: (/*foodName: string, mealType: string*/) => {
      return 'good' as 'excellent' | 'good' | 'fair' | 'poor'
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

  const renderScreen = () => {
    if (showBarcodeFlow) {
      return (
        <BarcodeFlow
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
            searchFacade={mockSearchFacade}
            recentFoodsFacade={mockRecentFoodsFacade}
            favoritesFacade={mockFavoritesFacade}
            customFoodsFacade={mockCustomFoodsFacade}
            portionCalculatorFacade={mockPortionCalculatorFacade}
            mealCategorizationFacade={mockMealCategorizationFacade}
          />
        )
      case 'barcode':
        setShowBarcodeFlow(true)
        return null
      case 'profile':
        return (
          <View style={styles.placeholder}>
            <Text style={{ color: typeof theme.colors.text === 'string' ? theme.colors.text : theme.colors.text.primary }}>
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