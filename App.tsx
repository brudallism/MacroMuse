import React, { useEffect } from 'react'
import { View, Text } from 'react-native'

import { FEATURES } from '@lib/featureFlags'
import { logger } from '@lib/logger'
import { initializeStoreEventSystem } from '@lib/storeEventWiring'
import { ThemeProvider } from '@ui/theme/ThemeProvider'
import { AppNavigator } from '@ui/navigation/AppNavigator'

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize store event system on app startup
    initializeStoreEventSystem()
    logger.info('MacroMuse app started - testing feature flags', {
      features: {
        analytics: FEATURES.ADVANCED_ANALYTICS.enabled,
        barcode: FEATURES.BARCODE_SCANNING.enabled,
        ai: FEATURES.AI_SUGGESTIONS.enabled
      }
    })
    console.log('MacroMuse app started - minimal version')
  }, [])

  return (
    <ThemeProvider>
      <View style={{ flex: 1 }}>
        <AppNavigator />
      </View>
    </ThemeProvider>
  )
}

