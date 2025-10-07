import React from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'

import { Text } from '@ui/atoms/Text'
import { Card } from '@ui/atoms/Card'
import { useTheme } from '@ui/theme/ThemeProvider'

export const SimpleDashboard: React.FC = () => {
  const theme = useTheme()

  // Mock data for demo
  const todayData = {
    calories: { current: 1200, target: 2000 },
    protein: { current: 85, target: 150 },
    carbs: { current: 120, target: 250 },
    fat: { current: 45, target: 67 },
  }

  const getProgress = (current: number, target: number) => {
    return Math.round((current / target) * 100)
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return theme.colors.success
    if (percentage >= 70) return theme.colors.warning
    return theme.colors.primary
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background.primary }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Today's Progress
        </Text>
        <Text style={[styles.date, { color: theme.colors.textSecondary }]}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Macro Cards */}
      <View style={styles.macroGrid}>
        {Object.entries(todayData).map(([macro, data]) => {
          const progress = getProgress(data.current, data.target)
          const color = getProgressColor(progress)

          return (
            <Card key={macro} style={[styles.macroCard, { backgroundColor: theme.colors.background.secondary }]}>
              <View style={styles.macroHeader}>
                <Text style={[styles.macroLabel, { color: theme.colors.textSecondary }]}>
                  {macro.charAt(0).toUpperCase() + macro.slice(1)}
                </Text>
                <Text style={[styles.progressPercent, { color }]}>
                  {progress}%
                </Text>
              </View>

              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      backgroundColor: theme.colors.gray[200],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: color,
                        width: `${Math.min(progress, 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.macroValues}>
                <Text style={[styles.currentValue, { color: theme.colors.text }]}>
                  {data.current}
                  {macro === 'calories' ? '' : 'g'}
                </Text>
                <Text style={[styles.targetValue, { color: theme.colors.textSecondary }]}>
                  / {data.target}
                  {macro === 'calories' ? ' cal' : 'g'}
                </Text>
              </View>
            </Card>
          )
        })}
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <Card style={[styles.statCard, { backgroundColor: theme.colors.background.secondary }]}>
          <Text style={[styles.statValue, { color: theme.colors.success }]}>
            {todayData.calories.target - todayData.calories.current}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Calories Remaining
          </Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: theme.colors.background.secondary }]}>
          <Text style={[styles.statValue, { color: theme.colors.primary }]}>
            {Math.round(todayData.protein.current / todayData.protein.target * 100)}%
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            Protein Goal
          </Text>
        </Card>
      </View>

      {/* Welcome Message */}
      <Card style={[styles.welcomeCard, { backgroundColor: theme.colors.background.secondary }]}>
        <Text style={[styles.welcomeTitle, { color: theme.colors.text }]}>
          Welcome to MacroMuse! 🎯
        </Text>
        <Text style={[styles.welcomeText, { color: theme.colors.textSecondary }]}>
          Start by searching for foods to track your nutrition. Try the search tab or scan a barcode to get started!
        </Text>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  date: {
    fontSize: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  macroCard: {
    width: '48%',
    padding: 16,
    marginBottom: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  macroValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  targetValue: {
    fontSize: 14,
    marginLeft: 4,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  welcomeCard: {
    padding: 20,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    lineHeight: 20,
  },
})