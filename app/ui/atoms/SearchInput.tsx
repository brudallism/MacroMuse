import React from 'react'
import { View, TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native'
import { Icon } from './Icon'
import { useTheme } from '@ui/theme/ThemeProvider'

export interface SearchInputProps extends Omit<TextInputProps, 'style'> {
  style?: ViewStyle
  showSearchIcon?: boolean
}

export const SearchInput: React.FC<SearchInputProps> = ({
  style,
  showSearchIcon = true,
  placeholder = 'Search...',
  ...props
}) => {
  const theme = useTheme()

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.background.tertiary,
          borderColor: theme.colors.gray[300],
          borderRadius: theme.borderRadius.md,
        },
        style,
      ]}
    >
      {showSearchIcon && (
        <Icon
          name="search"
          size={20}
          color={theme.colors.gray[500]}
          style={styles.searchIcon}
        />
      )}
      <TextInput
        style={[
          styles.input,
          {
            color: theme.colors.text.primary,
            paddingLeft: showSearchIcon ? theme.spacing.xs : theme.spacing.md,
          },
        ]}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.gray[500]}
        {...props}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
})