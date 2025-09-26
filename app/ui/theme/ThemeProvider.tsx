import React, { createContext, useContext, useState, ReactNode } from 'react'
import { tokens, getThemeColors, Theme } from './tokens'

// Theme interface for TypeScript safety
export interface ThemeContextValue extends Theme {
  isDark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback for cases where ThemeProvider is not yet implemented
    return {
      colors: getThemeColors(false),
      typography: tokens.typography,
      spacing: tokens.spacing,
      borderRadius: tokens.borderRadius,
      shadows: tokens.shadows,
      isDark: false,
      toggleTheme: () => {}
    }
  }
  return context
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false)

  const toggleTheme = () => {
    setIsDark(!isDark)
  }

  const value: ThemeContextValue = {
    colors: getThemeColors(isDark),
    typography: tokens.typography,
    spacing: tokens.spacing,
    borderRadius: tokens.borderRadius,
    shadows: tokens.shadows,
    isDark,
    toggleTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}