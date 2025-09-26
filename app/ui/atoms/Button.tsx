// app/ui/atoms/Button.tsx - Pure presentational button component
// Extracted from legacy Button.tsx, zero business logic, theme tokens only

import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'

import { tokens } from '../theme/tokens'

export interface ButtonProps {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  icon?: string
  testID?: string
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  testID,
}: ButtonProps): JSX.Element {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    loading && styles.loading,
  ]

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
  ]

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <Text style={textStyle}>
        {loading ? 'Loading...' : title}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...tokens.shadows.sm,
  },

  // Variants - Earth-toned theme from legacy extraction
  primary: {
    backgroundColor: tokens.colors.primary[500], // Deep Forest Green
    borderWidth: 1,
    borderColor: tokens.colors.primary[500],
  },
  secondary: {
    backgroundColor: tokens.colors.secondary[500], // Terracotta Clay
    borderWidth: 1,
    borderColor: tokens.colors.secondary[500],
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: tokens.colors.primary[500], // Deep Forest Green border
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  danger: {
    backgroundColor: tokens.colors.error[500], // Terracotta-based error
    borderWidth: 1,
    borderColor: tokens.colors.error[500],
  },

  // Sizes
  small: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    minHeight: 32,
  },
  medium: {
    paddingHorizontal: tokens.spacing.base,
    paddingVertical: tokens.spacing.sm,
    minHeight: 40,
  },
  large: {
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    minHeight: 48,
  },

  // States
  disabled: {
    opacity: tokens.colors.interactive.disabled,
  },
  loading: {
    opacity: 0.7,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },

  // Text styles
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },

  // Variant text styles
  primaryText: {
    color: tokens.colors.text.inverse, // Cream Linen on dark buttons
  },
  secondaryText: {
    color: tokens.colors.text.inverse, // Cream Linen on terracotta
  },
  outlineText: {
    color: tokens.colors.primary[500], // Deep Forest Green
  },
  ghostText: {
    color: tokens.colors.primary[500], // Deep Forest Green
  },
  dangerText: {
    color: tokens.colors.text.inverse, // Cream Linen on error
  },

  // Size text styles
  smallText: {
    fontSize: tokens.typography.body.caption.fontSize,
  },
  mediumText: {
    fontSize: tokens.typography.body.small.fontSize,
  },
  largeText: {
    fontSize: tokens.typography.body.base.fontSize,
  },

  disabledText: {
    color: tokens.colors.gray[400],
  },

  icon: {
    marginRight: tokens.spacing.sm,
    fontSize: tokens.typography.body.base.fontSize,
  },
})