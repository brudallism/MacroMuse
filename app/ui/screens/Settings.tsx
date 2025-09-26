// screens/Settings.tsx - Profile and goal management with real-time updates
import React, { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'

import { Text } from '../atoms/Text'
import { Button } from '../atoms/Button'
import { useTheme } from '../theme/ThemeProvider'
import { tokens, getThemeColors } from '../theme/tokens'

interface UserProfile {
  id: string
  email: string
  sex: string
  age_years: number
  height_cm: number
  weight_kg: number
  activity_level: 'sedentary' | 'lightly_active' | 'moderately_active' | 'active' | 'very_active'
  current_goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition'
}

interface TargetPreview {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface SettingsState {
  profile: UserProfile | null
  isLoading: boolean
  error: string | null
  hasChanges: boolean
}

interface SettingsFacade {
  getProfile: (userId: string) => Promise<UserProfile>
  previewTargets: (userId: string, params: any, goal: string) => Promise<TargetPreview | null>
  setBaseGoal: (userId: string, goal: string) => Promise<{ success: boolean; error?: string }>
  updateProfile: (userId: string, updates: Partial<UserProfile>) => Promise<{ success: boolean; profile?: UserProfile; error?: string }>
}

interface SettingsProps {
  settingsFacade: SettingsFacade
  userId: string
  onProfileChange?: (profile: UserProfile) => void
  onDataUpdate?: () => void
}

export function Settings({ settingsFacade, userId, onProfileChange, onDataUpdate }: SettingsProps): JSX.Element {
  const theme = useTheme()
  const [settingsState, setSettingsState] = useState<SettingsState>({
    profile: null,
    isLoading: true,
    error: null,
    hasChanges: false,
  })

  const [previewTargets, setPreviewTargets] = useState<{
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
  } | null>(null)

  const loadProfile = async () => {
    try {
      const profile = await settingsFacade.getProfile(userId)
      setSettingsState({
        profile,
        isLoading: false,
        error: null,
        hasChanges: false,
      })
      onProfileChange?.(profile)
    } catch (error) {
      setSettingsState({
        profile: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
        hasChanges: false,
      })
    }
  }

  const handleGoalChange = async (goal: 'weight_loss' | 'maintenance' | 'muscle_gain' | 'body_recomposition') => {
    if (!settingsState.profile) return

    // Show preview of new targets
    const preview = await settingsFacade.previewTargets(userId, {}, goal)
    if (preview) {
      setPreviewTargets(preview)
    }

    Alert.alert(
      'Change Goal',
      `Change your goal to ${goal.replace('_', ' ')}?\n\nNew targets:\n• Calories: ${preview?.calories || 'N/A'}\n• Protein: ${preview?.protein_g || 'N/A'}g\n• Carbs: ${preview?.carbs_g || 'N/A'}g\n• Fat: ${preview?.fat_g || 'N/A'}g`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const result = await settingsFacade.setBaseGoal(userId, goal)
            if (result.success) {
              // Update local state
              const updatedProfile = settingsState.profile ? { ...settingsState.profile, current_goal: goal } : null
              setSettingsState(prev => ({
                ...prev,
                profile: updatedProfile
              }))
              if (updatedProfile) {
                onProfileChange?.(updatedProfile)
              }
              onDataUpdate?.()
            } else {
              Alert.alert('Error', result.error || 'Failed to update goal')
            }
          },
        },
      ]
    )
  }

  const handleWeightUpdate = async (newWeight: number) => {
    if (!settingsState.profile) return

    const result = await settingsFacade.updateProfile(userId, { weight_kg: newWeight })
    if (result.success && result.profile) {
      setSettingsState(prev => ({
        ...prev,
        profile: result.profile!,
      }))
      onProfileChange?.(result.profile)
      onDataUpdate?.()
    } else {
      Alert.alert('Error', result.error || 'Failed to update weight')
    }
  }

  const handleActivityLevelChange = async (activityLevel: UserProfile['activity_level']) => {
    if (!settingsState.profile) return

    const result = await settingsFacade.updateProfile(userId, { activity_level: activityLevel })
    if (result.success && result.profile) {
      setSettingsState(prev => ({
        ...prev,
        profile: result.profile!,
      }))
      onProfileChange?.(result.profile)
      onDataUpdate?.()
    } else {
      Alert.alert('Error', result.error || 'Failed to update activity level')
    }
  }

  useEffect(() => {
    loadProfile()
  }, [userId])

  if (settingsState.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="secondary">Loading profile...</Text>
      </View>
    )
  }

  if (settingsState.error || !settingsState.profile) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="error">{settingsState.error || 'Profile not found'}</Text>
        <Button title="Retry" onPress={loadProfile} style={styles.retryButton} />
      </View>
    )
  }

  const { profile } = settingsState

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading2">Settings</Text>
        <Text variant="caption" color="secondary">Manage your profile and goals</Text>
      </View>

      {/* Profile Information */}
      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Email:</Text>
            <Text variant="body" weight="medium">{profile.email}</Text>
          </View>

          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Sex:</Text>
            <Text variant="body" weight="medium">{profile.sex}</Text>
          </View>

          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Age:</Text>
            <Text variant="body" weight="medium">{profile.age_years} years</Text>
          </View>

          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Height:</Text>
            <Text variant="body" weight="medium">{profile.height_cm} cm</Text>
          </View>

          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Weight:</Text>
            <Text variant="body" weight="medium">{profile.weight_kg} kg</Text>
          </View>

          <View style={styles.profileRow}>
            <Text variant="body" color="secondary">Activity Level:</Text>
            <Text variant="body" weight="medium">
              {profile.activity_level.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>

      {/* Current Goal */}
      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>Current Goal</Text>

        <View style={styles.goalCard}>
          <Text variant="body" weight="medium" style={styles.currentGoal}>
            {profile.current_goal.replace('_', ' ').toUpperCase()}
          </Text>

          {previewTargets && (
            <View style={styles.targetsPreview}>
              <Text variant="caption" color="secondary" style={styles.previewTitle}>
                Current Targets:
              </Text>
              <Text variant="caption" color="tertiary">
                Calories: {previewTargets.calories} • Protein: {previewTargets.protein_g}g •
                Carbs: {previewTargets.carbs_g}g • Fat: {previewTargets.fat_g}g
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Goal Options */}
      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>Change Goal</Text>

        <View style={styles.goalButtons}>
          <Button
            title="Weight Loss"
            onPress={() => handleGoalChange('weight_loss')}
            variant={profile.current_goal === 'weight_loss' ? 'primary' : 'outline'}
            style={styles.goalButton}
          />

          <Button
            title="Maintenance"
            onPress={() => handleGoalChange('maintenance')}
            variant={profile.current_goal === 'maintenance' ? 'primary' : 'outline'}
            style={styles.goalButton}
          />

          <Button
            title="Muscle Gain"
            onPress={() => handleGoalChange('muscle_gain')}
            variant={profile.current_goal === 'muscle_gain' ? 'primary' : 'outline'}
            style={styles.goalButton}
          />

          <Button
            title="Body Recomposition"
            onPress={() => handleGoalChange('body_recomposition')}
            variant={profile.current_goal === 'body_recomposition' ? 'primary' : 'outline'}
            style={styles.goalButton}
          />
        </View>
      </View>

      {/* Activity Level Options */}
      <View style={styles.section}>
        <Text variant="heading3" style={styles.sectionTitle}>Activity Level</Text>

        <View style={styles.activityButtons}>
          {(['sedentary', 'lightly_active', 'moderately_active', 'active', 'very_active'] as const).map((level) => (
            <Button
              key={level}
              title={level.replace('_', ' ')}
              onPress={() => handleActivityLevelChange(level)}
              variant={profile.activity_level === level ? 'primary' : 'outline'}
              size="sm"
              style={styles.activityButton}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  )
}

const staticColors = getThemeColors(false)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.background.primary,
  },
  contentContainer: {
    padding: tokens.spacing.md,
    paddingBottom: tokens.spacing['3xl'],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: staticColors.background.primary,
    padding: tokens.spacing.lg,
  },
  retryButton: {
    marginTop: tokens.spacing.md,
  },
  header: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
  },
  section: {
    marginBottom: tokens.spacing.xl,
  },
  sectionTitle: {
    marginBottom: tokens.spacing.md,
  },
  profileCard: {
    backgroundColor: staticColors.background.tertiary,
    padding: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    ...tokens.shadows.sm,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  goalCard: {
    backgroundColor: staticColors.background.tertiary,
    padding: tokens.spacing.lg,
    borderRadius: tokens.borderRadius.lg,
    alignItems: 'center',
    ...tokens.shadows.sm,
  },
  currentGoal: {
    color: tokens.colors.primary[600],
    marginBottom: tokens.spacing.sm,
  },
  targetsPreview: {
    alignItems: 'center',
  },
  previewTitle: {
    marginBottom: tokens.spacing.xs,
  },
  goalButtons: {
    gap: tokens.spacing.sm,
  },
  goalButton: {
    marginBottom: tokens.spacing.sm,
  },
  activityButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  activityButton: {
    flexBasis: '48%',
  },
})