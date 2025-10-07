// infra/database/queryAnalyzer.ts - Database query optimization and analysis
import { createClient } from '@supabase/supabase-js'

import { logger } from '@lib/logger'
import { performanceMonitor, PERFORMANCE_BUDGETS } from '@lib/performance'

interface QueryPlan {
  plan: string[]
  actualTime: number
  actualRows: number
  planningTime: number
  executionTime: number
  buffers?: {
    shared_hit: number
    shared_read: number
    shared_dirtied: number
    shared_written: number
  }
}

interface QueryMetrics {
  query: string
  duration: number
  plan: QueryPlan
  timestamp: number
  isSlowQuery: boolean
}

export class QueryAnalyzer {
  private slowQueryThreshold = PERFORMANCE_BUDGETS.databaseQuery
  private queryHistory: QueryMetrics[] = []

  constructor(private supabase: ReturnType<typeof createClient>) {}

  async analyzeQuery(query: string, params: any[] = []): Promise<QueryPlan> {
    const startTime = performance.now()

    try {
      // Execute EXPLAIN ANALYZE for query analysis
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`

      const { data, error } = await this.supabase
        .rpc('execute_explain_query', {
          query_text: explainQuery,
          query_params: params
        })

      if (error) {
        logger.error('Query analysis failed', { error, query: query.substring(0, 100) })
        throw error
      }

      const elapsed = performance.now() - startTime
      const plan = this.parseQueryPlan(data)

      const metrics: QueryMetrics = {
        query: query.substring(0, 200),
        duration: elapsed,
        plan,
        timestamp: Date.now(),
        isSlowQuery: elapsed > this.slowQueryThreshold
      }

      this.queryHistory.push(metrics)

      // Log slow queries with analysis
      if (metrics.isSlowQuery) {
        logger.warn('Slow query detected', {
          query: metrics.query,
          duration: elapsed,
          planningTime: plan.planningTime,
          executionTime: plan.executionTime,
          actualRows: plan.actualRows,
          bufferHits: plan.buffers?.shared_hit,
          bufferReads: plan.buffers?.shared_read
        })

        // Emit performance event
        await performanceMonitor.trackOperation('databaseQuery', async () => {
          return { analyzed: true, slowQuery: true }
        })
      }

      return plan
    } catch (error) {
      logger.error('Query analysis error', { error, query: query.substring(0, 100) })
      throw error
    }
  }

  private parseQueryPlan(planData: any): QueryPlan {
    const plan = planData[0]?.Plan || planData[0] || {}

    return {
      plan: this.extractPlanSteps(plan),
      actualTime: plan['Actual Total Time'] || 0,
      actualRows: plan['Actual Rows'] || 0,
      planningTime: planData[0]?.['Planning Time'] || 0,
      executionTime: planData[0]?.['Execution Time'] || 0,
      buffers: plan.Buffers ? {
        shared_hit: plan.Buffers['Shared Hit Blocks'] || 0,
        shared_read: plan.Buffers['Shared Read Blocks'] || 0,
        shared_dirtied: plan.Buffers['Shared Dirtied Blocks'] || 0,
        shared_written: plan.Buffers['Shared Written Blocks'] || 0
      } : undefined
    }
  }

  private extractPlanSteps(plan: any, steps: string[] = []): string[] {
    if (plan['Node Type']) {
      steps.push(plan['Node Type'])
    }

    if (plan.Plans) {
      plan.Plans.forEach((subPlan: any) => {
        this.extractPlanSteps(subPlan, steps)
      })
    }

    return steps
  }

  async optimizeCommonQueries(): Promise<void> {
    logger.info('Starting common query optimization analysis')

    // Analyze critical nutrient queries
    await this.analyzeNutrientQueries()

    // Analyze recipe queries
    await this.analyzeRecipeQueries()

    // Analyze meal planning queries
    await this.analyzeMealPlanningQueries()

    // Analyze analytics queries
    await this.analyzeAnalyticsQueries()

    this.generateOptimizationReport()
  }

  private async analyzeNutrientQueries(): Promise<void> {
    const commonNutrientQueries = [
      // Daily totals aggregation
      {
        query: `
          SELECT
            SUM(calories) as total_calories,
            SUM(protein_g) as total_protein,
            SUM(carbs_g) as total_carbs,
            SUM(fat_g) as total_fat,
            SUM(fiber_g) as total_fiber
          FROM intake_log
          WHERE user_id = $1
            AND date_logged >= $2
            AND date_logged <= $3
        `,
        params: ['test-user-id', '2024-01-01', '2024-01-01']
      },

      // Recent entries lookup
      {
        query: `
          SELECT il.*, f.name as food_name
          FROM intake_log il
          LEFT JOIN foods f ON il.food_id = f.id
          WHERE il.user_id = $1
          ORDER BY il.logged_at DESC
          LIMIT 20
        `,
        params: ['test-user-id']
      },

      // Weekly nutrient trends
      {
        query: `
          SELECT
            date_trunc('day', date_logged) as day,
            AVG(calories) as avg_calories,
            AVG(protein_g) as avg_protein
          FROM intake_log
          WHERE user_id = $1
            AND date_logged >= $2
          GROUP BY date_trunc('day', date_logged)
          ORDER BY day DESC
        `,
        params: ['test-user-id', '2024-01-01']
      }
    ]

    for (const { query, params } of commonNutrientQueries) {
      await this.analyzeQuery(query, params)
    }
  }

  private async analyzeRecipeQueries(): Promise<void> {
    const recipeQueries = [
      // Recipe with ingredients
      {
        query: `
          SELECT
            r.*,
            json_agg(
              json_build_object(
                'ingredient_id', ri.ingredient_id,
                'quantity', ri.quantity,
                'unit', ri.unit,
                'name', f.name
              )
            ) as ingredients
          FROM recipe r
          LEFT JOIN recipe_ingredient ri ON r.id = ri.recipe_id
          LEFT JOIN foods f ON ri.ingredient_id = f.id
          WHERE r.user_id = $1
          GROUP BY r.id
          ORDER BY r.created_at DESC
        `,
        params: ['test-user-id']
      },

      // Recipe nutrition calculation
      {
        query: `
          SELECT
            r.id,
            SUM(f.calories * ri.quantity) as total_calories,
            SUM(f.protein_g * ri.quantity) as total_protein
          FROM recipe r
          JOIN recipe_ingredient ri ON r.id = ri.recipe_id
          JOIN foods f ON ri.ingredient_id = f.id
          WHERE r.id = $1
          GROUP BY r.id
        `,
        params: ['test-recipe-id']
      }
    ]

    for (const { query, params } of recipeQueries) {
      await this.analyzeQuery(query, params)
    }
  }

  private async analyzeMealPlanningQueries(): Promise<void> {
    const planningQueries = [
      // Weekly meal plan
      {
        query: `
          SELECT
            mp.*,
            json_agg(
              json_build_object(
                'day', mpi.day_of_week,
                'meal_type', mpi.meal_type,
                'recipe_id', mpi.recipe_id,
                'food_id', mpi.food_id,
                'quantity', mpi.quantity
              )
            ) as plan_items
          FROM meal_plan mp
          LEFT JOIN meal_plan_item mpi ON mp.id = mpi.meal_plan_id
          WHERE mp.user_id = $1
            AND mp.week_start = $2
          GROUP BY mp.id
        `,
        params: ['test-user-id', '2024-01-01']
      },

      // Shopping list generation
      {
        query: `
          SELECT
            f.name,
            SUM(mpi.quantity) as total_quantity,
            f.unit
          FROM meal_plan_item mpi
          JOIN foods f ON mpi.food_id = f.id
          WHERE mpi.meal_plan_id = $1
          GROUP BY f.id, f.name, f.unit
          ORDER BY f.name
        `,
        params: ['test-plan-id']
      }
    ]

    for (const { query, params } of planningQueries) {
      await this.analyzeQuery(query, params)
    }
  }

  private async analyzeAnalyticsQueries(): Promise<void> {
    const analyticsQueries = [
      // Daily rollup query
      {
        query: `
          SELECT
            user_id,
            date_logged,
            SUM(calories) as daily_calories,
            SUM(protein_g) as daily_protein,
            SUM(carbs_g) as daily_carbs,
            SUM(fat_g) as daily_fat,
            COUNT(*) as meal_count
          FROM intake_log
          WHERE date_logged = $1
          GROUP BY user_id, date_logged
        `,
        params: ['2024-01-01']
      },

      // Nutrient trends analysis
      {
        query: `
          SELECT
            date_trunc('week', date) as week,
            AVG(calories) as avg_weekly_calories,
            STDDEV(calories) as calories_variance
          FROM nutrient_daily
          WHERE user_id = $1
            AND date >= $2
          GROUP BY date_trunc('week', date)
          ORDER BY week DESC
        `,
        params: ['test-user-id', '2024-01-01']
      }
    ]

    for (const { query, params } of analyticsQueries) {
      await this.analyzeQuery(query, params)
    }
  }

  private generateOptimizationReport(): void {
    const slowQueries = this.queryHistory.filter(q => q.isSlowQuery)
    const totalQueries = this.queryHistory.length
    const avgDuration = this.queryHistory.reduce((sum, q) => sum + q.duration, 0) / totalQueries

    const report = {
      totalQueries,
      slowQueries: slowQueries.length,
      slowQueryRate: (slowQueries.length / totalQueries) * 100,
      avgDuration,
      recommendations: this.generateRecommendations(slowQueries)
    }

    logger.info('Database optimization report', report)
  }

  private generateRecommendations(slowQueries: QueryMetrics[]): string[] {
    const recommendations: string[] = []

    // Analyze patterns in slow queries
    const sequentialScans = slowQueries.filter(q =>
      q.plan.plan.includes('Seq Scan')
    )

    const sortOperations = slowQueries.filter(q =>
      q.plan.plan.includes('Sort')
    )

    const nestedLoops = slowQueries.filter(q =>
      q.plan.plan.includes('Nested Loop')
    )

    if (sequentialScans.length > 0) {
      recommendations.push('Consider adding indexes to eliminate sequential scans')
    }

    if (sortOperations.length > 0) {
      recommendations.push('Consider adding indexes to support ORDER BY clauses')
    }

    if (nestedLoops.length > 0) {
      recommendations.push('Consider optimizing JOIN conditions or adding appropriate indexes')
    }

    // Check buffer usage patterns
    const highBufferReads = slowQueries.filter(q =>
      q.plan.buffers && q.plan.buffers.shared_read > 1000
    )

    if (highBufferReads.length > 0) {
      recommendations.push('High disk I/O detected - consider query optimization or caching')
    }

    return recommendations
  }

  getQueryStats(): {
    totalQueries: number
    slowQueries: number
    avgDuration: number
    recentSlowQueries: QueryMetrics[]
  } {
    const slowQueries = this.queryHistory.filter(q => q.isSlowQuery)
    const avgDuration = this.queryHistory.length > 0
      ? this.queryHistory.reduce((sum, q) => sum + q.duration, 0) / this.queryHistory.length
      : 0

    return {
      totalQueries: this.queryHistory.length,
      slowQueries: slowQueries.length,
      avgDuration,
      recentSlowQueries: slowQueries.slice(-10)
    }
  }

  clearQueryHistory(): void {
    this.queryHistory = []
  }
}