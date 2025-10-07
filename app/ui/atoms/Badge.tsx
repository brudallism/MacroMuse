import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'

import { useTheme } from '@ui/theme/ThemeProvider'

import { Text } from './Text'

export interface BadgeProps {
  text: string
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  color?: string // Allow custom color override
  size?: 'small' | 'base' | 'large'
  style?: ViewStyle
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'primary',
  color,
  size = 'base',
  style
}) => {
  const theme = useTheme()

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary,
          textColor: theme.colors.text.inverse
        }
      case 'secondary':
        return {
          backgroundColor: theme.colors.secondary,
          textColor: theme.colors.text.inverse
        }
      case 'success':
        return {
          backgroundColor: theme.colors.success,
          textColor: theme.colors.text.inverse
        }
      case 'warning':
        return {
          backgroundColor: theme.colors.warning,
          textColor: theme.colors.text.primary
        }
      case 'error':
        return {
          backgroundColor: theme.colors.error,
          textColor: theme.colors.text.inverse
        }
      default:
        return {
          backgroundColor: theme.colors.gray[200],
          textColor: theme.colors.text.primary
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingHorizontal: theme.spacing.xs,
          paddingVertical: theme.spacing.xs / 2,
          fontSize: theme.typography.body.caption.fontSize,
        }
      case 'large':
        return {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.body.base.fontSize,
        }
      default:
        return {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          fontSize: theme.typography.body.small.fontSize,
        }
    }
  }

  const { backgroundColor, textColor } = getVariantColors()
  const sizeStyles = getSizeStyles()

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color || backgroundColor,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
          borderRadius: theme.borderRadius.base,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: textColor,
            fontSize: sizeStyles.fontSize,
            fontWeight: '500'
          }
        ]}
      >
        {text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
})