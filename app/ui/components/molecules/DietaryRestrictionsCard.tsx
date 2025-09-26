// ui/components/molecules/DietaryRestrictionsCard.tsx - Foundation compliant dietary preferences UI
// Uses earth-toned design system and follows Foundation architecture

import React from 'react'
import { View, ViewStyle } from 'react-native'

import { useTheme } from '@ui/theme/ThemeProvider'
import { Text } from '@ui/atoms/Text'

import { Card } from '@ui/atoms/Card'

// Inline types to avoid domain imports (Foundation requirement)
type DietType = 'vegan' | 'vegetarian' | 'pescatarian' | 'ketogenic' | 'paleo' | 'primal' | 'low-fodmap' | 'whole30' | 'none'
type AllergenType = 'dairy' | 'eggs' | 'fish' | 'shellfish' | 'tree_nuts' | 'peanuts' | 'wheat' | 'soy' | 'sesame' | 'gluten' | 'grain' | 'seafood'
type PreferenceType = 'organic_preferred' | 'local_preferred' | 'minimal_processing' | 'low_sodium' | 'low_sugar'

interface DietaryRestrictionsCardProps {
  diets: DietType[]
  allergies: AllergenType[]
  exclusions: string[]
  preferences: PreferenceType[]
  strictFodmap?: boolean
  onEdit?: () => void
  style?: ViewStyle
}

/**
 * Display dietary restrictions in earth-toned card format
 * Foundation compliant - uses inline types and existing Card component
 */
export function DietaryRestrictionsCard({
  diets,
  allergies,
  exclusions,
  preferences,
  strictFodmap = false,
  onEdit,
  style
}: DietaryRestrictionsCardProps) {
  const theme = useTheme()

  // Early return if no restrictions
  const hasRestrictions = diets.length > 0 || allergies.length > 0 || exclusions.length > 0 || preferences.length > 0

  if (!hasRestrictions) {
    return (
      <Card
        variant="outlined"
        interactive={!!onEdit}
        onPress={onEdit}
        style={[{ minHeight: 80 }, style]}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <Text variant="body" color="secondary">
            No dietary restrictions set
          </Text>
          {onEdit && (
            <Text variant="caption" color="tertiary" style={{ marginTop: theme.spacing[1] }}>
              Tap to add preferences
            </Text>
          )}
        </View>
      </Card>
    )
  }

  return (
    <Card
      variant="nutrition"
      interactive={!!onEdit}
      onPress={onEdit}
      style={style}
    >
      <View style={{ gap: theme.spacing[3] }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="body" weight="semibold">
            Dietary Preferences
          </Text>
          {onEdit && (
            <Text variant="caption" color="primary">
              Edit
            </Text>
          )}
        </View>

        {/* Diet Types */}
        {diets.length > 0 && (
          <RestrictionSection
            title="Diet"
            items={diets.filter(d => d !== 'none').map(formatDietName)}
            color={theme.colors.nutrition.protein} // Deep Forest Green
          />
        )}

        {/* Allergies */}
        {allergies.length > 0 && (
          <RestrictionSection
            title="Allergies"
            items={allergies.map(formatAllergenName)}
            color={theme.colors.error} // Use error color for allergies (more important)
          />
        )}

        {/* Custom Exclusions */}
        {exclusions.length > 0 && (
          <RestrictionSection
            title="Excluded"
            items={exclusions.slice(0, 5)} // Limit display to first 5
            color={theme.colors.nutrition.carbs} // Terracotta Clay
            showMore={exclusions.length > 5}
            moreCount={exclusions.length - 5}
          />
        )}

        {/* Preferences */}
        {preferences.length > 0 && (
          <RestrictionSection
            title="Preferences"
            items={preferences.map(formatPreferenceName)}
            color={theme.colors.nutrition.fat} // Golden Ochre
          />
        )}

        {/* Strict FODMAP indicator */}
        {strictFodmap && (
          <View style={{
            backgroundColor: theme.colors.nutrition.fiber + '20', // Bark Brown with opacity
            padding: theme.spacing[2],
            borderRadius: theme.borderRadius.md,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.nutrition.fiber,
          }}>
            <Text variant="caption" weight="medium" color="secondary">
              Strict FODMAP filtering enabled
            </Text>
          </View>
        )}
      </View>
    </Card>
  )
}

interface RestrictionSectionProps {
  title: string
  items: string[]
  color: string
  showMore?: boolean
  moreCount?: number
}

function RestrictionSection({ title, items, color, showMore, moreCount }: RestrictionSectionProps) {
  const theme = useTheme()

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing[2] }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: color,
            marginRight: theme.spacing[2],
          }}
        />
        <Text variant="caption" weight="medium" color="secondary" style={{ textTransform: 'uppercase' }}>
          {title}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing[1] }}>
        {items.map((item, index) => (
          <View
            key={index}
            style={{
              backgroundColor: color + '15', // Color with low opacity
              paddingHorizontal: theme.spacing[2],
              paddingVertical: theme.spacing[1],
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: color + '30',
            }}
          >
            <Text variant="caption" weight="medium" style={{ color: color }}>
              {item}
            </Text>
          </View>
        ))}

        {showMore && moreCount && moreCount > 0 && (
          <View
            style={{
              backgroundColor: theme.colors.border.secondary,
              paddingHorizontal: theme.spacing[2],
              paddingVertical: theme.spacing[1],
              borderRadius: theme.borderRadius.sm,
              borderWidth: 1,
              borderColor: theme.colors.border.primary,
            }}
          >
            <Text variant="caption" color="secondary">
              +{moreCount} more
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// Formatting helpers
function formatDietName(diet: DietType): string {
  const dietNames: Record<DietType, string> = {
    'vegan': 'Vegan',
    'vegetarian': 'Vegetarian',
    'pescatarian': 'Pescatarian',
    'ketogenic': 'Ketogenic',
    'paleo': 'Paleo',
    'primal': 'Primal',
    'low-fodmap': 'Low FODMAP',
    'whole30': 'Whole30',
    'none': 'No Restrictions'
  }
  return dietNames[diet] || diet
}

function formatAllergenName(allergen: AllergenType): string {
  const allergenNames: Record<AllergenType, string> = {
    'dairy': 'Dairy',
    'eggs': 'Eggs',
    'fish': 'Fish',
    'shellfish': 'Shellfish',
    'tree_nuts': 'Tree Nuts',
    'peanuts': 'Peanuts',
    'wheat': 'Wheat',
    'soy': 'Soy',
    'sesame': 'Sesame',
    'gluten': 'Gluten',
    'grain': 'Grains',
    'seafood': 'Seafood'
  }
  return allergenNames[allergen] || allergen
}

function formatPreferenceName(preference: PreferenceType): string {
  const preferenceNames: Record<PreferenceType, string> = {
    'organic_preferred': 'Organic Preferred',
    'local_preferred': 'Local Preferred',
    'minimal_processing': 'Minimal Processing',
    'low_sodium': 'Low Sodium',
    'low_sugar': 'Low Sugar'
  }
  return preferenceNames[preference] || preference
}