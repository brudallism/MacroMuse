import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

import { FEATURES } from '@lib/featureFlags'
import { logger } from '@lib/logger'
import { initializeStoreEventSystem } from '@lib/storeEventWiring'

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize store event system on app startup
    initializeStoreEventSystem()
    logger.info('MacroMuse app started')
  }, [])

  return (
    <View style={styles.container}>
      <Text>MacroMuse - Nutrition Tracker</Text>
      <Text>Foundation Architecture Ready</Text>
      <Text>Advanced Analytics: {FEATURES.ADVANCED_ANALYTICS.enabled ? 'ON' : 'OFF'}</Text>
      <Text>Barcode Scanner: {FEATURES.BARCODE.enabled ? 'ON' : 'OFF'}</Text>
      <Text>AI Assistant: {FEATURES.AI_ASSISTANT.enabled ? 'ON' : 'OFF'}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
