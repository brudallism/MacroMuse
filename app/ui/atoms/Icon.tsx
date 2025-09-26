import React from 'react'
import { Text, StyleSheet } from 'react-native'

export interface IconProps {
  name: string
  size?: number
  color?: string
  style?: any
}

// Simple icon component using text symbols for now
// In a real app, you'd use react-native-vector-icons or similar
export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = '#1A1410', // theme.colors.text.primary fallback
  style
}) => {
  const getIconSymbol = (iconName: string): string => {
    const icons: Record<string, string> = {
      'search': '🔍',
      'heart-filled': '❤️',
      'heart-outline': '🤍',
      'clock': '🕐',
      'plus-circle': '➕',
      'edit': '✏️',
      'delete': '🗑️',
      'chevron-up': '⬆️',
      'chevron-down': '⬇️',
      'camera': '📷',
      'barcode': '📊',
      'star': '⭐',
      'star-outline': '☆',
      'check': '✅',
      'close': '❌',
      'menu': '☰',
      'settings': '⚙️',
      'user': '👤',
      'home': '🏠',
      'food': '🍽️',
      'analytics': '📈',
    }

    return icons[iconName] || '•'
  }

  return (
    <Text
      style={[
        styles.icon,
        {
          fontSize: size,
          color,
        },
        style,
      ]}
    >
      {getIconSymbol(name)}
    </Text>
  )
}

const styles = StyleSheet.create({
  icon: {
    textAlign: 'center',
  },
})