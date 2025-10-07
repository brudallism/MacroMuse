import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { searchFacade } from '@facades/searchFacade'
import { advancedFoodFacade } from '@facades/advancedFoodFacade'

import { useTheme } from '@ui/theme/ThemeProvider'
import { TabView } from '@ui/molecules/TabView'
import { SimpleDashboard } from '@ui/screens/SimpleDashboard'
import { SeparatedFoodSearch } from '@ui/screens/SeparatedFoodSearch'

const tabs = [
  { key: 'test', title: 'Test', icon: 'home' },
  { key: 'other', title: 'Other', icon: 'search' },
]

export const AppNavigatorMinimal: React.FC = () => {
  const theme = useTheme()
  const [activeScreen, setActiveScreen] = useState<string>('test')

  // Test search facade
  const realSearchFacade = {
    search: async (query: string, source: 'usda' | 'spoonacular' = 'usda') => {
      try {
        const results = await searchFacade.searchFoods(query, source)
        return { results }
      } catch (error) {
        console.error('Search facade error', { error })
        return { results: [], error: 'Search temporarily unavailable' }
      }
    }
  }

  // Fixed recent foods facade - avoid calling problematic method during render
  const realRecentFoodsFacade = {
    getRecent: async (userId: string) => {
      try {
        // Return mock data instead of calling the problematic method
        console.log('Recent foods requested for user:', userId)
        return []
      } catch (error) {
        console.error('Recent foods error', { error })
        return []
      }
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
        <StatusBar style={theme.isDark ? 'light' : 'dark'} />

        <TabView
          tabs={tabs}
          activeTab={activeScreen}
          onTabChange={(tab) => setActiveScreen(tab)}
          style={[styles.tabView, { backgroundColor: theme.colors.background.secondary }]}
        />

        <View style={{ flex: 1 }}>
          {activeScreen === 'test' ? (
            <SimpleDashboard />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: theme.colors.text.primary }}>
                Other Tab - Theme: {theme.isDark ? 'dark' : 'light'}
              </Text>
            </View>
          )}
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
})