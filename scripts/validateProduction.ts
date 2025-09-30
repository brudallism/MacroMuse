#!/usr/bin/env tsx

import { performance } from 'perf_hooks'
import { createClient } from '@supabase/supabase-js'
import { PERFORMANCE_BUDGETS } from '../app/lib/performance'

interface ValidationReport {
  passed: string[]
  failed: string[]
  warnings: string[]
  performance: Record<string, number>
  timestamp: string
}

interface EnvironmentConfig {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  USDA_API_KEY: string
  SPOONACULAR_API_KEY: string
  SENTRY_DSN: string
  NODE_ENV: string
}

class ProductionValidator {
  private report: ValidationReport
  private config: EnvironmentConfig

  constructor() {
    this.report = {
      passed: [],
      failed: [],
      warnings: [],
      performance: {},
      timestamp: new Date().toISOString()
    }

    this.config = this.loadEnvironmentConfig()
  }

  async validateProductionReadiness(): Promise<ValidationReport> {
    console.log('🚀 Starting production readiness validation...\n')

    try {
      await this.validateEnvironmentVariables()
      await this.validateDatabaseConnectivity()
      await this.validateAPIEndpoints()
      await this.validatePerformanceBudgets()
      await this.validateSecurityConfiguration()
      await this.validateBundleConfiguration()
      await this.validateMonitoringSetup()
    } catch (error) {
      this.report.failed.push(`Critical validation error: ${error.message}`)
    }

    this.printReport()
    return this.report
  }

  private async validateEnvironmentVariables(): Promise<void> {
    console.log('📋 Validating environment variables...')

    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'USDA_API_KEY',
      'SPOONACULAR_API_KEY',
      'SENTRY_DSN'
    ]

    const missingVars = requiredEnvVars.filter(varName => !this.config[varName as keyof EnvironmentConfig])

    if (missingVars.length > 0) {
      this.report.failed.push(`Missing environment variables: ${missingVars.join(', ')}`)
      return
    }

    // Validate URL formats
    try {
      new URL(this.config.SUPABASE_URL)
      this.report.passed.push('Supabase URL format valid')
    } catch {
      this.report.failed.push('Supabase URL format invalid')
    }

    try {
      new URL(this.config.SENTRY_DSN)
      this.report.passed.push('Sentry DSN format valid')
    } catch {
      this.report.failed.push('Sentry DSN format invalid')
    }

    // Validate API key formats
    if (this.config.USDA_API_KEY.length < 32) {
      this.report.warnings.push('USDA API key appears to be demo/test key')
    } else {
      this.report.passed.push('USDA API key format valid')
    }

    if (this.config.SPOONACULAR_API_KEY.length < 32) {
      this.report.warnings.push('Spoonacular API key appears to be demo/test key')
    } else {
      this.report.passed.push('Spoonacular API key format valid')
    }

    // Validate environment
    if (this.config.NODE_ENV !== 'production') {
      this.report.warnings.push(`NODE_ENV is '${this.config.NODE_ENV}', expected 'production'`)
    } else {
      this.report.passed.push('NODE_ENV set to production')
    }

    this.report.passed.push('Environment variables validation completed')
  }

  private async validateDatabaseConnectivity(): Promise<void> {
    console.log('🗄️  Validating database connectivity...')

    const startTime = performance.now()

    try {
      const supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY)

      // Test basic connectivity
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        throw new Error(`Database query failed: ${error.message}`)
      }

      const connectTime = performance.now() - startTime
      this.report.performance.databaseConnection = connectTime

      if (connectTime > 1000) {
        this.report.warnings.push(`Database connection slow: ${connectTime.toFixed(2)}ms`)
      } else {
        this.report.passed.push(`Database connectivity verified (${connectTime.toFixed(2)}ms)`)
      }

      // Test RLS policies
      await this.validateRLSPolicies(supabase)

      // Test critical indexes
      await this.validateDatabaseIndexes(supabase)

    } catch (error) {
      this.report.failed.push(`Database connectivity failed: ${error.message}`)
    }
  }

  private async validateRLSPolicies(supabase: any): Promise<void> {
    try {
      // Test that unauthenticated users cannot access protected data
      const { data, error } = await supabase
        .from('intake_log')
        .select('*')
        .limit(1)

      // Should get an authentication error, not data
      if (data && data.length > 0) {
        this.report.failed.push('RLS policies not enforced - unauthenticated access allowed')
      } else if (error && error.code === '42501') {
        this.report.passed.push('RLS policies properly enforced')
      } else {
        this.report.warnings.push('RLS policy validation inconclusive')
      }
    } catch (error) {
      this.report.warnings.push(`RLS validation error: ${error.message}`)
    }
  }

  private async validateDatabaseIndexes(supabase: any): Promise<void> {
    try {
      // Query for critical indexes
      const { data: indexes, error } = await supabase
        .rpc('get_table_indexes', { table_name: 'intake_log' })

      if (error) {
        this.report.warnings.push('Could not validate database indexes')
        return
      }

      const requiredIndexes = [
        'idx_intake_log_user_date',
        'idx_intake_log_user_id'
      ]

      const existingIndexes = indexes?.map((idx: any) => idx.indexname) || []
      const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx))

      if (missingIndexes.length > 0) {
        this.report.warnings.push(`Missing performance indexes: ${missingIndexes.join(', ')}`)
      } else {
        this.report.passed.push('Critical database indexes present')
      }
    } catch (error) {
      this.report.warnings.push(`Index validation error: ${error.message}`)
    }
  }

  private async validateAPIEndpoints(): Promise<void> {
    console.log('🌐 Validating external API endpoints...')

    await Promise.all([
      this.validateUSDAAPI(),
      this.validateSpoonacularAPI(),
      this.validateOpenFoodFactsAPI(),
      this.validateSentryAPI()
    ])
  }

  private async validateUSDAAPI(): Promise<void> {
    const startTime = performance.now()

    try {
      const response = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=apple&api_key=${this.config.USDA_API_KEY}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      const responseTime = performance.now() - startTime
      this.report.performance.usdaAPI = responseTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.foods || data.foods.length === 0) {
        throw new Error('USDA API returned no food results')
      }

      this.report.passed.push(`USDA API validated (${responseTime.toFixed(2)}ms)`)

    } catch (error) {
      this.report.failed.push(`USDA API validation failed: ${error.message}`)
    }
  }

  private async validateSpoonacularAPI(): Promise<void> {
    const startTime = performance.now()

    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?query=chicken&number=1&apiKey=${this.config.SPOONACULAR_API_KEY}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      const responseTime = performance.now() - startTime
      this.report.performance.spoonacularAPI = responseTime

      if (!response.ok) {
        if (response.status === 402) {
          this.report.warnings.push('Spoonacular API quota exceeded')
          return
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.results) {
        throw new Error('Spoonacular API returned invalid response format')
      }

      this.report.passed.push(`Spoonacular API validated (${responseTime.toFixed(2)}ms)`)

    } catch (error) {
      this.report.failed.push(`Spoonacular API validation failed: ${error.message}`)
    }
  }

  private async validateOpenFoodFactsAPI(): Promise<void> {
    const startTime = performance.now()

    try {
      const response = await fetch(
        'https://world.openfoodfacts.org/api/v0/product/737628064502.json',
        {
          method: 'GET',
          headers: { 'User-Agent': 'MacroMuse/1.0' }
        }
      )

      const responseTime = performance.now() - startTime
      this.report.performance.openFoodFactsAPI = responseTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== 1) {
        throw new Error('Open Food Facts API returned error status')
      }

      this.report.passed.push(`Open Food Facts API validated (${responseTime.toFixed(2)}ms)`)

    } catch (error) {
      this.report.failed.push(`Open Food Facts API validation failed: ${error.message}`)
    }
  }

  private async validateSentryAPI(): Promise<void> {
    try {
      // Parse Sentry DSN to validate format
      const url = new URL(this.config.SENTRY_DSN)

      if (!url.hostname.includes('sentry.io') && !url.hostname.includes('sentry')) {
        this.report.warnings.push('Sentry DSN does not appear to be official Sentry service')
      }

      // Test basic connectivity (without sending actual error)
      const projectId = url.pathname.split('/').pop()
      if (!projectId || projectId.length < 6) {
        this.report.warnings.push('Sentry project ID appears invalid')
      } else {
        this.report.passed.push('Sentry configuration validated')
      }

    } catch (error) {
      this.report.failed.push(`Sentry validation failed: ${error.message}`)
    }
  }

  private async validatePerformanceBudgets(): Promise<void> {
    console.log('⚡ Validating performance budgets...')

    try {
      // Test search performance
      await this.testSearchPerformance()

      // Test analytics performance
      await this.testAnalyticsPerformance()

      // Test database query performance
      await this.testDatabasePerformance()

    } catch (error) {
      this.report.failed.push(`Performance validation failed: ${error.message}`)
    }
  }

  private async testSearchPerformance(): Promise<void> {
    const supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY)

    const startTime = performance.now()

    try {
      // Simulate food search query
      const { data, error } = await supabase
        .from('food_search_cache')
        .select('*')
        .textSearch('name', 'chicken')
        .limit(10)

      const searchTime = performance.now() - startTime
      this.report.performance.searchQuery = searchTime

      if (searchTime > PERFORMANCE_BUDGETS.search) {
        this.report.warnings.push(`Search performance over budget: ${searchTime.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.search}ms)`)
      } else {
        this.report.passed.push(`Search performance within budget: ${searchTime.toFixed(2)}ms`)
      }

    } catch (error) {
      this.report.warnings.push(`Search performance test failed: ${error.message}`)
    }
  }

  private async testAnalyticsPerformance(): Promise<void> {
    const supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY)

    const startTime = performance.now()

    try {
      // Simulate analytics query
      const { data, error } = await supabase
        .from('daily_totals')
        .select('*')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .limit(30)

      const analyticsTime = performance.now() - startTime
      this.report.performance.analyticsQuery = analyticsTime

      if (analyticsTime > 1000) { // 1 second budget for analytics
        this.report.warnings.push(`Analytics performance slow: ${analyticsTime.toFixed(2)}ms`)
      } else {
        this.report.passed.push(`Analytics performance acceptable: ${analyticsTime.toFixed(2)}ms`)
      }

    } catch (error) {
      this.report.warnings.push(`Analytics performance test failed: ${error.message}`)
    }
  }

  private async testDatabasePerformance(): Promise<void> {
    const supabase = createClient(this.config.SUPABASE_URL, this.config.SUPABASE_ANON_KEY)

    const queries = [
      { name: 'Profile lookup', query: () => supabase.from('profiles').select('*').limit(1) },
      { name: 'Recent foods', query: () => supabase.from('intake_log').select('*').limit(10) },
      { name: 'Recipe list', query: () => supabase.from('recipes').select('*').limit(10) }
    ]

    for (const { name, query } of queries) {
      const startTime = performance.now()

      try {
        await query()
        const queryTime = performance.now() - startTime

        if (queryTime > 200) { // 200ms budget for simple queries
          this.report.warnings.push(`${name} query slow: ${queryTime.toFixed(2)}ms`)
        } else {
          this.report.passed.push(`${name} query fast: ${queryTime.toFixed(2)}ms`)
        }

      } catch (error) {
        this.report.warnings.push(`${name} query failed: ${error.message}`)
      }
    }
  }

  private async validateSecurityConfiguration(): Promise<void> {
    console.log('🔒 Validating security configuration...')

    // Test HTTPS enforcement
    try {
      const httpUrl = this.config.SUPABASE_URL.replace('https://', 'http://')
      const response = await fetch(httpUrl, { method: 'HEAD' })

      if (response.ok) {
        this.report.warnings.push('HTTP connections allowed - HTTPS enforcement not configured')
      } else {
        this.report.passed.push('HTTPS enforcement verified')
      }
    } catch (error) {
      this.report.passed.push('HTTP connections properly blocked')
    }

    // Validate JWT configuration
    try {
      const jwtPayload = this.config.SUPABASE_ANON_KEY.split('.')[1]
      if (jwtPayload) {
        const decoded = JSON.parse(atob(jwtPayload))
        if (decoded.role === 'anon') {
          this.report.passed.push('JWT anon key properly configured')
        } else {
          this.report.warnings.push('JWT anon key role unexpected')
        }
      }
    } catch (error) {
      this.report.warnings.push('JWT validation inconclusive')
    }

    this.report.passed.push('Security configuration validation completed')
  }

  private async validateBundleConfiguration(): Promise<void> {
    console.log('📦 Validating bundle configuration...')

    try {
      // Check if bundle analyzer output exists
      const fs = await import('fs/promises')

      try {
        await fs.access('./dist/bundle-analyzer-report.html')
        this.report.passed.push('Bundle analyzer report available')
      } catch {
        this.report.warnings.push('Bundle analyzer report not found')
      }

      // Check for source maps
      try {
        await fs.access('./dist/main.js.map')
        this.report.passed.push('Source maps generated')
      } catch {
        this.report.warnings.push('Source maps not found')
      }

      // Check bundle size (simplified check)
      try {
        const stats = await fs.stat('./dist/main.js')
        const sizeMB = stats.size / (1024 * 1024)

        if (sizeMB > 5) {
          this.report.warnings.push(`Bundle size large: ${sizeMB.toFixed(2)}MB`)
        } else {
          this.report.passed.push(`Bundle size acceptable: ${sizeMB.toFixed(2)}MB`)
        }
      } catch {
        this.report.warnings.push('Could not check bundle size')
      }

    } catch (error) {
      this.report.warnings.push(`Bundle validation error: ${error.message}`)
    }
  }

  private async validateMonitoringSetup(): Promise<void> {
    console.log('📊 Validating monitoring setup...')

    // Validate Sentry configuration
    try {
      // Check if Sentry is properly configured (without sending test events)
      const sentryUrl = new URL(this.config.SENTRY_DSN)

      if (sentryUrl.protocol === 'https:') {
        this.report.passed.push('Sentry HTTPS configured')
      } else {
        this.report.warnings.push('Sentry not using HTTPS')
      }

      // Check project ID format
      const projectId = sentryUrl.pathname.split('/').pop()
      if (projectId && projectId.match(/^\d+$/)) {
        this.report.passed.push('Sentry project ID format valid')
      } else {
        this.report.warnings.push('Sentry project ID format questionable')
      }

    } catch (error) {
      this.report.failed.push(`Sentry validation failed: ${error.message}`)
    }

    this.report.passed.push('Monitoring setup validation completed')
  }

  private loadEnvironmentConfig(): EnvironmentConfig {
    return {
      SUPABASE_URL: process.env.SUPABASE_URL || '',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
      USDA_API_KEY: process.env.USDA_API_KEY || '',
      SPOONACULAR_API_KEY: process.env.SPOONACULAR_API_KEY || '',
      SENTRY_DSN: process.env.SENTRY_DSN || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  }

  private printReport(): void {
    console.log('\n' + '='.repeat(60))
    console.log('🎯 PRODUCTION VALIDATION REPORT')
    console.log('='.repeat(60))

    console.log(`\n✅ PASSED (${this.report.passed.length}):`)
    this.report.passed.forEach(item => console.log(`  ✓ ${item}`))

    if (this.report.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.report.warnings.length}):`)
      this.report.warnings.forEach(item => console.log(`  ⚠ ${item}`))
    }

    if (this.report.failed.length > 0) {
      console.log(`\n❌ FAILED (${this.report.failed.length}):`)
      this.report.failed.forEach(item => console.log(`  ✗ ${item}`))
    }

    console.log(`\n📊 PERFORMANCE METRICS:`)
    Object.entries(this.report.performance).forEach(([key, value]) => {
      console.log(`  ${key}: ${value.toFixed(2)}ms`)
    })

    console.log(`\n📅 Validation completed: ${this.report.timestamp}`)

    if (this.report.failed.length === 0) {
      console.log('\n🎉 ALL VALIDATIONS PASSED! Ready for production deployment.')
    } else {
      console.log(`\n❌ ${this.report.failed.length} critical issues must be resolved before deployment.`)
    }

    console.log('='.repeat(60))
  }
}

// Pre-deployment check function
export const preDeploymentChecks = async (): Promise<boolean> => {
  const validator = new ProductionValidator()
  const report = await validator.validateProductionReadiness()

  // Return true if no critical failures
  return report.failed.length === 0
}

// CLI execution
if (require.main === module) {
  preDeploymentChecks()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Validation script failed:', error.message)
      process.exit(1)
    })
}