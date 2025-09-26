// screens/Dashboard.tsx - Main dashboard with macro rings and real data
import React, { useState, useEffect } from 'react'
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native'

import { Text } from '../atoms/Text'
import { MacroRing } from '../molecules/MacroRing'
import { DashboardFacade, DashboardData, MacroRingData } from '../../facades/DashboardFacade'
import { tokens, getThemeColors } from '../theme/tokens'

interface DashboardProps {
  dashboardFacade: DashboardFacade
  userId: string
}

export function Dashboard({ dashboardFacade, userId }: DashboardProps): JSX.Element {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    targets: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    totals: { pctOfTarget: {} },
    isLoading: true,
    error: null,
  })
  const [refreshing, setRefreshing] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const loadDashboard = async () => {
    try {
      const data = await dashboardFacade.getDashboardData(userId, today)
      setDashboardData(data)
    } catch (error) {
      setDashboardData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load dashboard'
      }))
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await loadDashboard()
    setRefreshing(false)
  }

  useEffect(() => {
    loadDashboard()
  }, [userId])

  // Transform data for macro rings
  const macroRingsData: MacroRingData[] = dashboardFacade.getMacroRingsData(dashboardData)

  if (dashboardData.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="secondary">Loading dashboard...</Text>
      </View>
    )
  }

  if (dashboardData.error) {
    return (
      <View style={styles.centerContainer}>
        <Text variant="body" color="error">{dashboardData.error}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading2">Today's Progress</Text>
        <Text variant="caption" color="secondary">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Macro Rings Grid */}
      <View style={styles.macroGrid}>
        {macroRingsData.map((ringData) => (
          <View key={ringData.label} style={styles.ringContainer}>
            <MacroRing
              label={ringData.label}
              current={ringData.current}
              target={ringData.target}
              percentage={ringData.percentage}
              color={ringData.color}
            />
          </View>
        ))}
      </View>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text variant="heading3" color="success">
            {Math.max(0, dashboardData.targets.calories - (dashboardData.totals.calories || 0))}
          </Text>
          <Text variant="caption" color="secondary">Calories Remaining</Text>
        </View>

        <View style={styles.statCard}>
          <Text variant="heading3" color="primary">
            {Math.max(0, dashboardData.targets.protein_g - (dashboardData.totals.protein_g || 0))}g
          </Text>
          <Text variant="caption" color="secondary">Protein Remaining</Text>
        </View>
      </View>

      {/* Daily Summary */}
      <View style={styles.summaryCard}>
        <Text variant="heading3" style={styles.summaryTitle}>Daily Summary</Text>

        <View style={styles.summaryRow}>
          <Text variant="body" color="secondary">Calories:</Text>
          <Text variant="body" weight="medium">
            {Math.round(dashboardData.totals.calories || 0)} / {dashboardData.targets.calories}
            <Text variant="body" color="tertiary"> ({dashboardData.totals.pctOfTarget.calories || 0}%)</Text>
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text variant="body" color="secondary">Protein:</Text>
          <Text variant="body" weight="medium">
            {Math.round(dashboardData.totals.protein_g || 0)}g / {dashboardData.targets.protein_g}g
            <Text variant="body" color="tertiary"> ({dashboardData.totals.pctOfTarget.protein_g || 0}%)</Text>
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text variant="body" color="secondary">Carbs:</Text>
          <Text variant="body" weight="medium">
            {Math.round(dashboardData.totals.carbs_g || 0)}g / {dashboardData.targets.carbs_g}g
            <Text variant="body" color="tertiary"> ({dashboardData.totals.pctOfTarget.carbs_g || 0}%)</Text>
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text variant="body" color="secondary">Fat:</Text>
          <Text variant="body" weight="medium">
            {Math.round(dashboardData.totals.fat_g || 0)}g / {dashboardData.targets.fat_g}g
            <Text variant="body" color="tertiary"> ({dashboardData.totals.pctOfTarget.fat_g || 0}%)</Text>
          </Text>
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
  },
  header: {
    marginBottom: tokens.spacing.xl,
    alignItems: 'center',
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xl,
  },
  ringContainer: {
    width: '48%',
    alignItems: 'center',
    marginBottom: tokens.spacing.lg,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.background.tertiary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginHorizontal: theme.spacing.xs,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  summaryCard: {
    backgroundColor: theme.colors.background.tertiary,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.sm,
  },
  summaryTitle: {
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
})