import React, { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { FEATURES } from '@lib/featureFlags'
import { logger } from '@lib/logger'
import { initializeStoreEventSystem } from '@lib/storeEventWiring'

import { TestSupabaseConnection } from './app/components/TestSupabaseConnection'

export default function App(): React.JSX.Element {
  useEffect(() => {
    // Initialize store event system on app startup
    initializeStoreEventSystem()
    logger.info('MacroMuse app started')
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>MacroMuse</Text>
        <Text style={styles.subtitle}>Nutrition Tracker with Complete Database</Text>
        <Text style={styles.feature}>
          Advanced Analytics: {FEATURES.ADVANCED_ANALYTICS.enabled ? '✅' : '❌'}
        </Text>
        <Text style={styles.feature}>
          Barcode Scanner: {FEATURES.BARCODE.enabled ? '✅' : '❌'}
        </Text>
        <Text style={styles.feature}>
          AI Assistant: {FEATURES.AI_ASSISTANT.enabled ? '✅' : '❌'}
        </Text>
      </View>

      <TestSupabaseConnection />
      <StatusBar style="auto" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  feature: {
    fontSize: 14,
    color: '#555',
    marginBottom: 3,
  },
})
