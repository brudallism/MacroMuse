// app/ui/index.ts - Centralized exports for Foundation.md compliant UI components
// Pure presentational components, extracted from legacy MacroMuse codebase

// Theme system
export { tokens, theme, getThemeColors } from './theme/tokens'
export type { Theme, ThemeContextValue } from './theme/tokens'

// Atomic components
export { Button } from './atoms/Button'
export type { ButtonProps } from './atoms/Button'

export { Input } from './atoms/Input'
export type { InputProps } from './atoms/Input'

export { Card } from './atoms/Card'
export type { CardProps } from './atoms/Card'

// Molecular components
export { MacroRing } from './molecules/MacroRing'
export type { MacroRingProps, MacroData } from './molecules/MacroRing'

export { MealCard } from './molecules/MealCard'
export type { MealCardProps, MealData } from './molecules/MealCard'

// Screen layouts
export { Dashboard } from './screens/Dashboard'
export type { DashboardProps, DashboardData } from './screens/Dashboard'

// Re-export existing components that were already created
export { Text } from './atoms/Text'
export { MacroRing as ExistingMacroRing } from './molecules/MacroRing'

// Component organization by layer (Foundation.md compliance)
export const atoms = {
  Button,
  Input,
  Card,
}

export const molecules = {
  MacroRing,
  MealCard,
}

export const screens = {
  Dashboard,
}

export const theme = {
  tokens,
}