import React, { useEffect } from 'react'
import { View } from 'react-native'

import { ThemeProvider } from '@ui/theme/ThemeProvider'
import { AppNavigator } from '@ui/navigation/AppNavigator'

import { initializeApp } from '@infra/initialization'

import { FEATURES } from '@lib/featureFlags'
import { logger } from '@lib/logger'
import { initializeStoreEventSystem } from '@lib/storeEventWiring'


export default function App(): React.JSX.Element {
  useEffect(() => {
    // CRITICAL: Initialize repositories and services BEFORE anything else
    initializeApp()

    // Initialize store event system on app startup
    initializeStoreEventSystem()
    logger.info('MacroMuse app started', {
      features: {
        analytics: FEATURES.ADVANCED_ANALYTICS.enabled,
        barcode: FEATURES.BARCODE_SCANNING.enabled,
        ai: FEATURES.AI_SUGGESTIONS.enabled
      }
    })
  }, [])

  return (
    <ThemeProvider>
      <View style={{ flex: 1 }}>
        <AppNavigator />
      </View>
    </ThemeProvider>
  )
}

