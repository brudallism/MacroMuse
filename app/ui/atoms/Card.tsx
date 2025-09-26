// app/ui/atoms/Card.tsx - Pure presentational card component
// Foundation.md compliant, extracted from legacy commonStyles

import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'

import { tokens } from '../theme/tokens'

export interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined' | 'elevated' | 'flat'
  padding?: 'none' | 'small' | 'medium' | 'large'
  style?: ViewStyle
  testID?: string
}

export function Card({
  children,
  variant = 'default',
  padding = 'medium',
  style,
  testID,
}: CardProps): JSX.Element {
  const cardStyle = [
    styles.card,
    styles[variant],
    styles[`${padding}Padding`],
    style,
  ]

  return (
    <View style={cardStyle} testID={testID}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  // Base card styling extracted from legacy
  card: {
    backgroundColor: tokens.colors.supporting.creamLinen, // Cream Linen from legacy
    borderRadius: tokens.borderRadius.md,
    marginBottom: tokens.spacing.sm,
  },

  // Variants
  default: {
    ...tokens.shadows.sm, // Subtle shadow from legacy
  },
  outlined: {
    borderWidth: 1,
    borderColor: tokens.colors.gray[200],
    // No shadow for outlined variant
  },
  elevated: {
    ...tokens.shadows.lg, // More prominent shadow
  },
  flat: {
    backgroundColor: 'transparent',
    // No shadow or background
  },

  // Padding variants
  nonePadding: {
    padding: 0,
  },
  smallPadding: {
    padding: tokens.spacing.sm,
  },
  mediumPadding: {
    padding: tokens.spacing.base, // From legacy extraction
  },
  largePadding: {
    padding: tokens.spacing.lg,
  },
})