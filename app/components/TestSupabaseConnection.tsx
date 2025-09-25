import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'

import { testSupabaseConnection, testAuthenticatedOperations } from '../lib/supabase-test'
import { supabase } from '../lib/supabase'

export const TestSupabaseConnection: React.FC = () => {
  const [testResults, setTestResults] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<unknown>(null)

  const runBasicTest = async (): Promise<void> => {
    setIsLoading(true)
    setTestResults('Running basic connection test...\n')

    try {
      const success = await testSupabaseConnection()
      setTestResults(
        (prev) => prev + '\n' + (success ? '✅ Basic test passed!' : '❌ Basic test failed!')
      )
    } catch (err) {
      setTestResults((prev) => prev + '\n❌ Test error: ' + String(err))
    }

    setIsLoading(false)
  }

  const signInAnonymously = async (): Promise<void> => {
    setIsLoading(true)
    setTestResults((prev) => prev + '\n🔐 Attempting anonymous sign-in...\n')

    try {
      const { data, error } = await supabase.auth.signInAnonymously()

      if (error) {
        setTestResults((prev) => prev + '\n❌ Anonymous sign-in failed: ' + error.message)
      } else {
        setUser(data.user)
        setTestResults((prev) => prev + '\n✅ Anonymous sign-in successful!')
        setTestResults((prev) => prev + '\n👤 User ID: ' + String(data.user?.id))
      }
    } catch (err) {
      setTestResults((prev) => prev + '\n❌ Sign-in error: ' + String(err))
    }

    setIsLoading(false)
  }

  const runAuthenticatedTest = async (): Promise<void> => {
    if (!user) {
      setTestResults((prev) => prev + '\n⚠️ Please sign in first')
      return
    }

    setIsLoading(true)
    setTestResults((prev) => prev + '\n🧪 Running authenticated operations test...\n')

    try {
      const success = await testAuthenticatedOperations()
      setTestResults(
        (prev) =>
          prev +
          '\n' +
          (success ? '✅ Authenticated test passed!' : '❌ Authenticated test failed!')
      )
    } catch (err) {
      setTestResults((prev) => prev + '\n❌ Authenticated test error: ' + String(err))
    }

    setIsLoading(false)
  }

  const signOut = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setTestResults((prev) => prev + '\n🚪 Signed out successfully')
    } catch (err) {
      setTestResults((prev) => prev + '\n❌ Sign out error: ' + String(err))
    }
    setIsLoading(false)
  }

  const clearResults = (): void => {
    setTestResults('')
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Supabase Connection Test</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runBasicTest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>Test Basic Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={signInAnonymously}
          disabled={isLoading || !!user}
        >
          <Text style={styles.buttonText}>{user ? '✅ Signed In' : 'Sign In Anonymously'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.tertiaryButton]}
          onPress={runAuthenticatedTest}
          disabled={isLoading || !user}
        >
          <Text style={styles.buttonText}>Test Authenticated Ops</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={signOut}
          disabled={isLoading || !user}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearResults}>
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsText}>
          {testResults || 'Click "Test Basic Connection" to start...'}
        </Text>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Testing...</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#34C759',
  },
  tertiaryButton: {
    backgroundColor: '#FF9500',
  },
  warningButton: {
    backgroundColor: '#FF3B30',
  },
  clearButton: {
    backgroundColor: '#8E8E93',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 8,
    padding: 15,
  },
  resultsText: {
    color: '#00FF00',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
})
