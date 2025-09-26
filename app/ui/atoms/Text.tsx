// atoms/Text.tsx - Styled text component with theme typography
import React from 'react'
import { Text as RNText, TextStyle, StyleSheet } from 'react-native'

import { useTheme } from '../theme/ThemeProvider'

interface TextProps {
  children: React.ReactNode
  variant?: 'heading1' | 'heading2' | 'heading3' | 'body' | 'caption' | 'label'
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'success' | 'warning' | 'error'
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  align?: 'left' | 'center' | 'right'
  style?: TextStyle
  testID?: string
}

export function Text({
  children,
  variant = 'body',
  color = 'primary',
  weight,
  align = 'left',
  style,
  testID,
}: TextProps): JSX.Element {
  const theme = useTheme()

  const getColorValue = () => {
    switch (color) {
      case 'primary': return theme.colors.text
      case 'secondary': return theme.colors.textSecondary
      case 'tertiary': return theme.colors.gray[500]
      case 'inverse': return theme.colors.background.primary
      case 'success': return theme.colors.success
      case 'warning': return theme.colors.warning
      case 'error': return theme.colors.error
      default: return theme.colors.text
    }
  }

  const getWeightValue = () => {
    switch (weight) {
      case 'light': return '300'
      case 'normal': return '400'
      case 'medium': return '500'
      case 'semibold': return '600'
      case 'bold': return '700'
      default: return '400'
    }
  }

  const textStyle = [
    styles.base,
    styles[variant],
    { color: getColorValue() },
    weight && { fontWeight: getWeightValue() },
    align !== 'left' && { textAlign: align },
    style,
  ]

  return (
    <RNText style={textStyle} testID={testID}>
      {children}
    </RNText>
  )
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'System',
  },

  // Variants - using our actual theme structure
  heading1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  heading2: {
    fontSize: 28,
    fontWeight: '600',
    lineHeight: 36,
  },
  heading3: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
})