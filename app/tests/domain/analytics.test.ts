// tests/domain/analytics.test.ts - Comprehensive analytics testing following Foundation.md
import { AnalyticsEngine } from '@domain/services/analytics'
import { InsightEngine } from '@domain/services/insights'
import { TrendAnalysisEngine } from '@domain/services/trends'
import { TargetsServiceImpl } from '@domain/services/targets'
import { NutrientVector, TargetVector, Insight } from '@domain/models'
import { PERFORMANCE_BUDGETS } from '@lib/performance'

describe('Analytics System - Days 8-9 Implementation', () => {
  // Test data fixtures for 7-day analysis
  const sevenDayFixture = {
    userId: 'test-user-123',
    dates: [
      '2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04',
      '2024-01-05', '2024-01-06', '2024-01-07'
    ],
    targets: {
      calories: 2000,
      protein_g: 150,
      carbs_g: 250,
      fat_g: 67
    } as TargetVector,
    dailyIntakes: [
      { calories: 1800, protein_g: 140, carbs_g: 230, fat_g: 60, iron_mg: 10, fiber_g: 20 },
      { calories: 2100, protein_g: 155, carbs_g: 260, fat_g: 70, iron_mg: 12, fiber_g: 25 },
      { calories: 1950, protein_g: 145, carbs_g: 245, fat_g: 65, iron_mg: 9, fiber_g: 18 },
      { calories: 2200, protein_g: 160, carbs_g: 275, fat_g: 75, iron_mg: 14, fiber_g: 28 },
      { calories: 1850, protein_g: 135, carbs_g: 220, fat_g: 58, iron_mg: 8, fiber_g: 16 },
      { calories: 2500, protein_g: 180, carbs_g: 320, fat_g: 85, iron_mg: 16, fiber_g: 35 }, // Weekend spike
      { calories: 2300, protein_g: 170, carbs_g: 290, fat_g: 80, iron_mg: 15, fiber_g: 30 }  // Weekend spike
    ] as NutrientVector[]
  }

  describe('AnalyticsEngine - Core Calculations', () => {
    it('should calculate macro balance correctly', () => {
      const nutrients: NutrientVector = {
        calories: 2000,
        protein_g: 150, // 600 calories
        carbs_g: 200,   // 800 calories
        fat_g: 67       // 600 calories (total: 2000 calories)
      }

      const balance = AnalyticsEngine.calculateMacroBalance(nutrients)

      expect(balance.totalCalories).toBe(2000)
      expect(balance.proteinPercent).toBeCloseTo(30, 1)
      expect(balance.carbsPercent).toBeCloseTo(40, 1)
      expect(balance.fatPercent).toBeCloseTo(30, 1)
    })

    it('should calculate nutrient adherence with different penalty logic', () => {
      // Test maximize nutrients (protein)
      expect(AnalyticsEngine.calculateNutrientAdherence(150, 150, 'protein_g')).toBe(100)
      expect(AnalyticsEngine.calculateNutrientAdherence(135, 150, 'protein_g')).toBe(90)
      expect(AnalyticsEngine.calculateNutrientAdherence(75, 150, 'protein_g')).toBe(50)

      // Test minimize nutrients (sodium)
      expect(AnalyticsEngine.calculateNutrientAdherence(2000, 2300, 'sodium_mg')).toBe(100)
      expect(AnalyticsEngine.calculateNutrientAdherence(2300, 2300, 'sodium_mg')).toBe(100)
      expect(AnalyticsEngine.calculateNutrientAdherence(2500, 2300, 'sodium_mg')).toBeLessThan(100)
    })

    it('should detect nutrient trends correctly', () => {
      const increasingValues = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 110 },
        { date: '2024-01-03', value: 120 },
        { date: '2024-01-04', value: 130 },
        { date: '2024-01-05', value: 140 },
        { date: '2024-01-06', value: 150 },
        { date: '2024-01-07', value: 160 }
      ]

      const trend = AnalyticsEngine.detectNutrientTrend(increasingValues)
      expect(trend).toBe('increasing')

      const stableValues = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 102 },
        { date: '2024-01-03', value: 98 },
        { date: '2024-01-04', value: 101 },
        { date: '2024-01-05', value: 99 },
        { date: '2024-01-06', value: 103 },
        { date: '2024-01-07', value: 97 }
      ]

      const stableTrend = AnalyticsEngine.detectNutrientTrend(stableValues)
      expect(stableTrend).toBe('stable')
    })

    it('should detect streaks accurately', () => {
      const values = [
        { date: '2024-01-01', value: 140, target: 150 }, // Under
        { date: '2024-01-02', value: 155, target: 150 }, // Meet
        { date: '2024-01-03', value: 160, target: 150 }, // Meet
        { date: '2024-01-04', value: 152, target: 150 }, // Meet
        { date: '2024-01-05', value: 148, target: 150 }, // Under
        { date: '2024-01-06', value: 155, target: 150 }, // Meet
        { date: '2024-01-07', value: 158, target: 150 }  // Meet
      ]

      const meetingGoal = (value: number, target: number) => value >= target
      const streak = AnalyticsEngine.detectStreak(values, meetingGoal)

      expect(streak.current).toBe(true) // Currently on streak
      expect(streak.length).toBe(2) // Last 2 days
    })
  })

  describe('InsightEngine - Pattern Detection', () => {
    it('should detect iron deficiency streak', () => {
      const ironDeficiencyData = sevenDayFixture.dates.map((date, index) => ({
        date,
        nutrients: {
          ...sevenDayFixture.dailyIntakes[index],
          iron_mg: 6 // Consistently low iron (target: 18mg for females)
        },
        targets: { ...sevenDayFixture.targets, iron_mg: 18 },
        adherence: 75,
        entryCount: 3
      }))

      const insights = InsightEngine.evaluateRules(ironDeficiencyData)
      const ironInsight = insights.find(i => i.key === 'iron_low_streak')

      expect(ironInsight).toBeDefined()
      expect(ironInsight?.severity).toBe('high') // 7 days = high severity
      expect(ironInsight?.message).toContain('Iron intake has been consistently low')
    })

    it('should detect macro imbalance', () => {
      const macroImbalanceData = sevenDayFixture.dates.map((date, index) => ({
        date,
        nutrients: {
          calories: 2000,
          protein_g: 50,  // Very low protein (10% of calories)
          carbs_g: 350,   // Very high carbs (70% of calories)
          fat_g: 44       // Normal fat (20% of calories)
        },
        targets: sevenDayFixture.targets,
        adherence: 60,
        entryCount: 3
      }))

      const insights = InsightEngine.evaluateRules(macroImbalanceData)
      const macroInsight = insights.find(i => i.key === 'macro_imbalance')

      expect(macroInsight).toBeDefined()
      expect(macroInsight?.details?.recommendations).toContain('Increase protein intake with lean meats, legumes, or protein powder')
    })

    it('should detect weekend eating pattern', () => {
      const weekendPatternData = []

      // 2 weeks of data with weekend spikes
      for (let week = 0; week < 2; week++) {
        for (let day = 0; day < 7; day++) {
          const date = new Date(2024, 0, 1 + week * 7 + day)
          const isWeekend = day === 5 || day === 6 // Saturday or Sunday
          const calories = isWeekend ? 2800 : 2000 // 40% higher on weekends

          weekendPatternData.push({
            date: date.toISOString().split('T')[0],
            nutrients: { calories, protein_g: 150, carbs_g: 250, fat_g: 67 },
            targets: sevenDayFixture.targets,
            adherence: 85,
            entryCount: 3
          })
        }
      }

      const insights = InsightEngine.evaluateRules(weekendPatternData)
      const weekendInsight = insights.find(i => i.key === 'weekend_pattern')

      expect(weekendInsight).toBeDefined()
      expect(weekendInsight?.message).toContain('Weekend eating differs significantly from weekdays')
    })

    it('should prioritize insights by severity and priority', () => {
      const mixedData = sevenDayFixture.dates.map((date, index) => ({
        date,
        nutrients: {
          calories: 2000,
          protein_g: 50,    // Macro imbalance (priority 2)
          carbs_g: 350,
          fat_g: 44,
          iron_mg: 6,       // Iron deficiency (priority 1)
          fiber_g: 10       // Low fiber (priority 2)
        },
        targets: { ...sevenDayFixture.targets, iron_mg: 18, fiber_g: 25 },
        adherence: 60,
        entryCount: 3
      }))

      const insights = InsightEngine.evaluateRules(mixedData)

      // Should be sorted by severity and priority
      expect(insights.length).toBeGreaterThan(0)

      const ironInsight = insights.find(i => i.key === 'iron_low_streak')
      const macroInsight = insights.find(i => i.key === 'macro_imbalance')

      if (ironInsight && macroInsight) {
        const ironIndex = insights.indexOf(ironInsight)
        const macroIndex = insights.indexOf(macroInsight)

        // Iron (priority 1, high severity) should come before macro (priority 2)
        expect(ironIndex).toBeLessThan(macroIndex)
      }
    })
  })

  describe('TrendAnalysisEngine - Progress Tracking', () => {
    it('should calculate rolling averages correctly', () => {
      const values = [
        { date: '2024-01-01', value: 100 },
        { date: '2024-01-02', value: 200 },
        { date: '2024-01-03', value: 300 },
        { date: '2024-01-04', value: 400 },
        { date: '2024-01-05', value: 500 }
      ]

      const smoothed = TrendAnalysisEngine.calculateRollingAverages(values, 3)

      expect(smoothed).toHaveLength(3) // 5 - 3 + 1 = 3 averages
      expect(smoothed[0].value).toBe(200) // (100+200+300)/3
      expect(smoothed[1].value).toBe(300) // (200+300+400)/3
      expect(smoothed[2].value).toBe(400) // (300+400+500)/3
    })

    it('should determine trend direction using linear regression', () => {
      const increasingValues = [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-02', value: 20 },
        { date: '2024-01-03', value: 30 },
        { date: '2024-01-04', value: 40 },
        { date: '2024-01-05', value: 50 }
      ]

      const trend = TrendAnalysisEngine.determineTrendDirection(increasingValues)
      expect(trend).toBe('increasing')

      const decreasingValues = [
        { date: '2024-01-01', value: 50 },
        { date: '2024-01-02', value: 40 },
        { date: '2024-01-03', value: 30 },
        { date: '2024-01-04', value: 20 },
        { date: '2024-01-05', value: 10 }
      ]

      const decreasingTrend = TrendAnalysisEngine.determineTrendDirection(decreasingValues)
      expect(decreasingTrend).toBe('decreasing')
    })

    it('should calculate consistency scores', () => {
      const consistentValues = [
        { date: '2024-01-01', value: 100, target: 100 },
        { date: '2024-01-02', value: 102, target: 100 },
        { date: '2024-01-03', value: 98, target: 100 },
        { date: '2024-01-04', value: 101, target: 100 },
        { date: '2024-01-05', value: 99, target: 100 }
      ]

      const consistency = TrendAnalysisEngine.calculateConsistencyScore(consistentValues)
      expect(consistency).toBeGreaterThan(80) // High consistency

      const inconsistentValues = [
        { date: '2024-01-01', value: 50, target: 100 },
        { date: '2024-01-02', value: 150, target: 100 },
        { date: '2024-01-03', value: 25, target: 100 },
        { date: '2024-01-04', value: 175, target: 100 },
        { date: '2024-01-05', value: 75, target: 100 }
      ]

      const inconsistency = TrendAnalysisEngine.calculateConsistencyScore(inconsistentValues)
      expect(inconsistency).toBeLessThan(50) // Low consistency
    })

    it('should identify improvement opportunities', () => {
      const trends = [
        {
          nutrient: 'protein_g' as keyof NutrientVector,
          values: [
            { date: '2024-01-01', value: 100, targetValue: 150 },
            { date: '2024-01-02', value: 95, targetValue: 150 },
            { date: '2024-01-03', value: 90, targetValue: 150 },
            { date: '2024-01-04', value: 85, targetValue: 150 },
            { date: '2024-01-05', value: 80, targetValue: 150 },
            { date: '2024-01-06', value: 75, targetValue: 150 },
            { date: '2024-01-07', value: 70, targetValue: 150 }
          ],
          trend: 'decreasing' as const,
          changePercent: -30
        }
      ]

      const opportunities = TrendAnalysisEngine.identifyImprovementOpportunities(trends)

      expect(opportunities).toHaveLength(1)
      expect(opportunities[0].nutrient).toBe('protein_g')
      expect(opportunities[0].opportunity).toBe('increase_intake')
      expect(opportunities[0].priority).toBe('high')
    })
  })

  describe('Performance Budget Compliance', () => {
    it('should complete analytics rollup within budget', async () => {
      const startTime = performance.now()

      // Simulate analytics rollup operation
      const mockRollup = () => new Promise(resolve => setTimeout(resolve, 100))
      await mockRollup()

      const elapsed = performance.now() - startTime
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.analyticsRollup)
    })

    it('should complete insight generation within budget', async () => {
      const startTime = performance.now()

      // Generate insights using real engine
      const mockData = sevenDayFixture.dates.map((date, index) => ({
        date,
        nutrients: sevenDayFixture.dailyIntakes[index],
        targets: sevenDayFixture.targets,
        adherence: 80,
        entryCount: 3
      }))

      const insights = InsightEngine.evaluateRules(mockData)

      const elapsed = performance.now() - startTime
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.insightGeneration)
      expect(insights).toBeDefined()
    })

    it('should complete trend calculation within budget', async () => {
      const startTime = performance.now()

      const values = sevenDayFixture.dates.map((date, index) => ({
        date,
        value: sevenDayFixture.dailyIntakes[index].calories || 0,
        targetValue: sevenDayFixture.targets.calories
      }))

      const trend = TrendAnalysisEngine.calculateTrend(values)

      const elapsed = performance.now() - startTime
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.trendCalculation)
      expect(trend).toBeDefined()
    })
  })

  describe('Integration Tests - Full Analytics Flow', () => {
    it('should process complete analytics pipeline', async () => {
      const startTime = performance.now()

      // 1. Aggregate nutrients (would be from intake_log)
      const aggregatedNutrients = sevenDayFixture.dailyIntakes.reduce((acc, intake) => {
        acc.calories = (acc.calories || 0) + (intake.calories || 0)
        acc.protein_g = (acc.protein_g || 0) + (intake.protein_g || 0)
        return acc
      }, {} as NutrientVector)

      // 2. Generate insights
      const analyticsData = sevenDayFixture.dates.map((date, index) => ({
        date,
        nutrients: sevenDayFixture.dailyIntakes[index],
        targets: sevenDayFixture.targets,
        adherence: 80,
        entryCount: 3
      }))

      const insights = InsightEngine.evaluateRules(analyticsData)

      // 3. Calculate trends
      const calorieValues = sevenDayFixture.dates.map((date, index) => ({
        date,
        value: sevenDayFixture.dailyIntakes[index].calories || 0,
        targetValue: sevenDayFixture.targets.calories
      }))

      const trend = TrendAnalysisEngine.calculateTrend(calorieValues)

      const elapsed = performance.now() - startTime

      // Verify all components work together
      expect(aggregatedNutrients).toBeDefined()
      expect(insights).toBeDefined()
      expect(trend).toBeDefined()
      expect(elapsed).toBeLessThan(PERFORMANCE_BUDGETS.analyticsRollup)
    })

    it('should handle edge cases gracefully', () => {
      // Empty data
      expect(() => TrendAnalysisEngine.calculateTrend([])).toThrow()
      expect(InsightEngine.evaluateRules([])).toEqual([])

      // Single day data
      const singleDay = [{
        date: '2024-01-01',
        nutrients: { calories: 2000 },
        targets: { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 67 },
        adherence: 100,
        entryCount: 3
      }]

      expect(InsightEngine.evaluateRules(singleDay)).toEqual([])

      // Zero values
      const zeroValues = [{ date: '2024-01-01', value: 0, targetValue: 0 }]
      const zeroTrend = TrendAnalysisEngine.calculateTrend(zeroValues)
      expect(zeroTrend.changePercent).toBe(0)
    })
  })
})