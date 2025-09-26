// app/ui/atoms/Input.tsx - Pure presentational input component
// Foundation.md compliant, zero business logic, theme tokens only

import React from 'react'
import { TextInput, View, Text, StyleSheet, TextInputProps } from 'react-native'

import { useTheme } from '../theme/ThemeProvider'

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string
  error?: string
  hint?: string
  variant?: 'default' | 'search' | 'numeric'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  fullWidth?: boolean
}

export function Input({
  label,
  error,
  hint,
  variant = 'default',
  size = 'medium',
  disabled = false,
  fullWidth = false,
  ...textInputProps
}: InputProps): JSX.Element {
  const theme = useTheme()
  const hasError = !!error
  const hasValue = !!textInputProps.value || !!textInputProps.defaultValue

  const containerStyle = [
    styles.container,
    fullWidth && styles.fullWidth,
  ]

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.colors.background.tertiary,
      borderColor: theme.colors.gray[200],
      color: theme.colors.text,
    },
    styles[size],
    styles[variant],
    hasError && { borderColor: theme.colors.error, borderWidth: 2 },
    disabled && { backgroundColor: theme.colors.gray[50], opacity: 0.5 },
    hasValue && { borderColor: theme.colors.primary, borderWidth: 2 },
  ]

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[
          styles.label,
          { color: theme.colors.textSecondary },
          hasError && { color: theme.colors.error }
        ]}>
          {label}
        </Text>
      )}

      <TextInput
        style={inputStyle}
        placeholderTextColor={theme.colors.gray[400]}
        editable={!disabled}
        {...textInputProps}
      />

      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text style={[styles.hintText, { color: theme.colors.textSecondary }]}>
          {hint}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  fullWidth: {
    width: '100%',
  },

  // Label styles
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },

  // Input base styles
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  // Sizes
  small: {
    paddingVertical: 4,
    minHeight: 32,
  },
  medium: {
    paddingVertical: 8,
    minHeight: 40,
  },
  large: {
    paddingVertical: 12,
    minHeight: 48,
  },

  // Variants
  default: {
    // Base styling already applied
  },
  search: {
    borderRadius: 50,
    paddingHorizontal: 20,
  },
  numeric: {
    textAlign: 'center',
    fontWeight: '600',
  },

  // Helper text styles
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    marginTop: 4,
  },
})