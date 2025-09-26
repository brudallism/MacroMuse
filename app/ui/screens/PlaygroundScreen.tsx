// ui/screens/PlaygroundScreen.tsx - Simplified for core functionality focus
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from '@ui/atoms/Text'
import { useTheme } from '@ui/theme/ThemeProvider'

export function PlaygroundScreen(): JSX.Element {
  const theme = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      <View style={styles.content}>
        <Text variant="title" style={styles.title}>
          Components Playground
        </Text>
        <Text variant="body" color="secondary" style={styles.subtitle}>
          This screen will be used for UI component testing during production polish phase.
        </Text>
        <Text variant="body" color="secondary" style={styles.note}>
          Components will be added systematically after core functionality is complete.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  note: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
})