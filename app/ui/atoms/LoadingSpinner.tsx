import React from 'react'
import { View, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native'
import { useTheme } from '@ui/theme/ThemeProvider'

export interface LoadingSpinnerProps {
  size?: 'small' | 'large'
  color?: string
  style?: ViewStyle
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'small',
  color,
  style
}) => {
  const theme = useTheme()

  const spinnerColor = color || theme.colors.primary[500]

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={spinnerColor} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})