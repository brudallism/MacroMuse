// app/ui/theme/tokens.ts - Foundation.md compliant design tokens from legacy extraction
// NO inline hex values, token-based system with light/dark support


export const tokens = {
  colors: {
    // Primary Brand Colors - Deep Forest Green
    primary: {
      50: '#F3F5F2',
      100: '#E6EBE2',
      200: '#CCD7C5',
      300: '#B3C3A8',
      400: '#99AF8B',
      500: '#213529', // Main brand color - Deep Forest
      600: '#1C2E23',
      700: '#17261D',
      800: '#121F17',
      900: '#0D1711',
    },

    // Secondary Color - Terracotta Clay
    secondary: {
      50: '#FDF6F4',
      100: '#FCEDE9',
      200: '#F8DBD3',
      300: '#F4C9BD',
      400: '#F0B7A7',
      500: '#B95D40', // Terracotta Clay
      600: '#A45539',
      700: '#8F4C32',
      800: '#7A442B',
      900: '#653B24',
    },

    // Supporting Colors
    supporting: {
      barkBrown: '#5C4033',     // Headers, sub-headers, icon outlines
      sageGreen: '#9CAF88',     // Calm accents, charts, hover borders
      goldenOchre: '#E1A948',   // Energy accent, nutrient highlights
      creamLinen: '#F3EFE9',    // Card backgrounds, floating elements
      warmBeige: '#E8DCCF',     // App background base
    },

    // Text Colors
    text: {
      primary: '#1A1410',       // Deep Brown - primary text
      secondary: '#5C4033',     // Bark Brown - secondary text
      tertiary: '#9CAF88',      // Sage Green - subtle text
      inverse: '#F3EFE9',       // Cream Linen - text on dark backgrounds
    },

    // Background Colors with light/dark theme support
    background: {
      light: {
        primary: '#E8DCCF',     // Warm Beige - main app background
        secondary: '#F3EFE9',   // Cream Linen - card backgrounds
        tertiary: '#FFFFFF',    // Pure white for input fields
      },
      dark: {
        primary: '#1A1410',     // Dark brown for dark mode
        secondary: '#2A1F16',   // Darker brown for cards
        tertiary: '#1C2E23',    // Dark forest green for inputs
      },
    },

    // Macro Ring Colors
    macros: {
      protein: '#213529',       // Deep Forest - Protein
      fiber: '#5C4033',         // Bark Brown - Fiber
      calories: '#9CAF88',      // Sage Green - Calories
      carbs: '#B95D40',         // Terracotta Clay - Carbs
      fats: '#E1A948',          // Golden Ochre - Fats
    },

    // Semantic Colors
    success: {
      50: '#F1F5F0',
      500: '#9CAF88',           // Sage Green for success
      600: '#8A9C78',
    },

    warning: {
      50: '#FDF9F0',
      500: '#E1A948',           // Golden Ochre for warnings
      600: '#CB9741',
    },

    error: {
      50: '#FDF5F3',
      500: '#B95D40',           // Terracotta for errors
      600: '#A75539',
    },

    // Neutral Grays (warmer tones)
    gray: {
      50: '#F9F8F6',
      100: '#F3F1EE',
      200: '#E7E3DD',
      300: '#DBD5CC',
      400: '#B8B0A5',
      500: '#958B7E',
      600: '#766D62',
      700: '#5C544B',
      800: '#423C35',
      900: '#28241F',
    },

    // Meal Type Colors
    mealTypes: {
      breakfast: '#E1A948',     // Golden Ochre - morning energy
      lunch: '#9CAF88',         // Sage Green - midday calm
      dinner: '#B95D40',        // Terracotta - evening warmth
      snack: '#5C4033',         // Bark Brown - grounding snacks
    },

    // Interactive States
    interactive: {
      hover: 'rgba(33, 53, 41, 0.1)',      // Deep Forest Green 10% opacity
      pressed: 'rgba(33, 53, 41, 0.2)',     // Deep Forest Green 20% opacity
      focused: 'rgba(33, 53, 41, 0.3)',     // Deep Forest Green 30% opacity
      disabled: 0.5,                        // 50% opacity for disabled states
    },
  },

  // Typography tokens
  typography: {
    heading: {
      h1: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 40,
      },
      h2: {
        fontSize: 28,
        fontWeight: '600',
        lineHeight: 36,
      },
      h3: {
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 32,
      },
    },
    body: {
      large: {
        fontSize: 18,
        fontWeight: '400',
        lineHeight: 24,
      },
      base: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 20,
      },
      small: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
      },
      caption: {
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
      },
    },
    label: {
      large: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 20,
      },
      base: {
        fontSize: 14,
        fontWeight: '500',
        lineHeight: 18,
      },
      small: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
      },
    },
  },

  // Spacing tokens
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
  },

  // Border radius tokens
  borderRadius: {
    none: 0,
    sm: 4,
    base: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 50,
  },

  // Shadow tokens
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    base: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
} as const

// Theme interface for TypeScript safety
export interface Theme {
  colors: typeof tokens.colors
  typography: typeof tokens.typography
  spacing: typeof tokens.spacing
  borderRadius: typeof tokens.borderRadius
  shadows: typeof tokens.shadows
}

// Theme context type
export interface ThemeContextValue extends Theme {
  isDark: boolean
  toggleTheme: () => void
}

// Helper function to get theme-aware colors
export const getThemeColors = (isDark: boolean) => {
  const baseColors = { ...tokens.colors }
  // Replace background with theme-aware version
  return {
    ...baseColors,
    background: isDark ? baseColors.background.dark : baseColors.background.light,
    // Provide flat color access for easier usage
    text: isDark ? baseColors.text.inverse : baseColors.text.primary,
    textSecondary: isDark ? baseColors.gray[300] : baseColors.text.secondary,
    primary: baseColors.primary[500],
    secondary: baseColors.secondary[500],
    success: baseColors.success[500],
    warning: baseColors.warning[500],
    error: baseColors.error[500],
  }
}

// Export default theme object
export const theme: Theme = tokens