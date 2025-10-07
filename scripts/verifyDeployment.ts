#!/usr/bin/env tsx

import { performance } from 'perf_hooks'

import { createClient } from '@supabase/supabase-js'

interface DeploymentVerification {
  timestamp: string
  version: string
  environment: string
  checks: {
    name: string
    status: 'pass' | 'fail' | 'warn'
    message: string
    duration?: number
  }[]
  summary: {
    passed: number
    failed: number
    warnings: number
    totalChecks: number
    overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  }
}

class DeploymentVerifier {
  private verification: DeploymentVerification

  constructor() {
    this.verification = {
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      checks: [],
      summary: {
        passed: 0,
        failed: 0,
        warnings: 0,
        totalChecks: 0,
        overallStatus: 'healthy'
      }
    }
  }

  async verifyDeployment(): Promise<DeploymentVerification> {
    console.log('🔍 Verifying production deployment health...\n')

    await Promise.all([
      this.checkDatabaseHealth(),
      this.checkAPIEndpoints(),
      this.checkPerformanceBaseline(),
      this.checkMonitoringServices(),
      this.checkSecurityHeaders(),
      this.checkContentDelivery()
    ])

    this.calculateSummary()
    this.printResults()

    return this.verification
  }

  private async checkDatabaseHealth(): Promise<void> {
    const startTime = performance.now()

    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      )

      // Test basic connectivity and response time
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1)

      const duration = performance.now() - startTime

      if (error && error.code !== 'PGRST116') {
        this.addCheck('Database Connectivity', 'fail', `Connection failed: ${error.message}`, duration)
        return
      }

      if (duration > 500) {
        this.addCheck('Database Response Time', 'warn', `Slow response: ${duration.toFixed(2)}ms`, duration)
      } else {
        this.addCheck('Database Response Time', 'pass', `Fast response: ${duration.toFixed(2)}ms`, duration)
      }

      // Test RLS enforcement
      const rlsTest = await this.testRLSEnforcement(supabase)
      this.addCheck('Row Level Security', rlsTest.status, rlsTest.message)

      // Test critical tables exist
      const tablesTest = await this.testCriticalTables(supabase)
      this.addCheck('Database Schema', tablesTest.status, tablesTest.message)

    } catch (error) {
      this.addCheck('Database Health', 'fail', `Database check failed: ${error.message}`)
    }
  }

  private async testRLSEnforcement(supabase: any): Promise<{ status: 'pass' | 'fail' | 'warn', message: string }> {
    try {
      const { data, error } = await supabase
        .from('intake_log')
        .select('*')
        .limit(1)

      if (data && data.length > 0) {
        return { status: 'fail', message: 'RLS not enforced - anonymous access allowed' }
      }

      if (error && (error.code === '42501' || error.message.includes('permission'))) {
        return { status: 'pass', message: 'RLS properly enforced' }
      }

      return { status: 'warn', message: 'RLS status unclear' }
    } catch (error) {
      return { status: 'warn', message: `RLS test inconclusive: ${error.message}` }
    }
  }

  private async testCriticalTables(supabase: any): Promise<{ status: 'pass' | 'fail' | 'warn', message: string }> {
    const criticalTables = [
      'profiles', 'intake_log', 'daily_totals', 'recipes', 'meal_plans'
    ]

    try {
      const tableChecks = await Promise.all(
        criticalTables.map(async (table) => {
          try {
            const { error } = await supabase.from(table).select('*').limit(0)
            return { table, exists: !error }
          } catch {
            return { table, exists: false }
          }
        })
      )

      const missingTables = tableChecks.filter(check => !check.exists).map(check => check.table)

      if (missingTables.length > 0) {
        return { status: 'fail', message: `Missing tables: ${missingTables.join(', ')}` }
      }

      return { status: 'pass', message: 'All critical tables present' }
    } catch (error) {
      return { status: 'warn', message: `Table check failed: ${error.message}` }
    }
  }

  private async checkAPIEndpoints(): Promise<void> {
    const endpoints = [
      {
        name: 'USDA API',
        url: `https://api.nal.usda.gov/fdc/v1/foods/search?query=test&pageSize=1&api_key=${process.env.USDA_API_KEY}`,
        expectedStatus: 200
      },
      {
        name: 'Spoonacular API',
        url: `https://api.spoonacular.com/recipes/complexSearch?query=test&number=1&apiKey=${process.env.SPOONACULAR_API_KEY}`,
        expectedStatus: 200
      },
      {
        name: 'Open Food Facts API',
        url: 'https://world.openfoodfacts.org/api/v0/product/737628064502.json',
        expectedStatus: 200
      }
    ]

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const startTime = performance.now()

        try {
          const response = await fetch(endpoint.url, {
            headers: {
              'User-Agent': 'MacroMuse/1.0 Deployment-Verification'
            }
          })

          const duration = performance.now() - startTime

          if (response.status === endpoint.expectedStatus) {
            this.addCheck(
              `${endpoint.name} Availability`,
              'pass',
              `Responding normally (${duration.toFixed(2)}ms)`,
              duration
            )
          } else if (response.status === 402 && endpoint.name === 'Spoonacular API') {
            this.addCheck(
              `${endpoint.name} Availability`,
              'warn',
              'API quota exceeded (expected for free tier)',
              duration
            )
          } else {
            this.addCheck(
              `${endpoint.name} Availability`,
              'fail',
              `HTTP ${response.status}: ${response.statusText}`,
              duration
            )
          }
        } catch (error) {
          this.addCheck(`${endpoint.name} Availability`, 'fail', `Request failed: ${error.message}`)
        }
      })
    )
  }

  private async checkPerformanceBaseline(): Promise<void> {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    )

    // Test query performance baseline
    const queries = [
      {
        name: 'Profile Query',
        operation: () => supabase.from('profiles').select('*').limit(1),
        budget: 200
      },
      {
        name: 'Food Search Query',
        operation: () => supabase.from('food_search_cache').select('*').limit(10),
        budget: 300
      },
      {
        name: 'Analytics Query',
        operation: () => supabase.from('daily_totals').select('*').limit(30),
        budget: 500
      }
    ]

    for (const query of queries) {
      const startTime = performance.now()

      try {
        await query.operation()
        const duration = performance.now() - startTime

        if (duration <= query.budget) {
          this.addCheck(
            `${query.name} Performance`,
            'pass',
            `Within budget: ${duration.toFixed(2)}ms (budget: ${query.budget}ms)`,
            duration
          )
        } else {
          this.addCheck(
            `${query.name} Performance`,
            'warn',
            `Over budget: ${duration.toFixed(2)}ms (budget: ${query.budget}ms)`,
            duration
          )
        }
      } catch (error) {
        this.addCheck(`${query.name} Performance`, 'fail', `Query failed: ${error.message}`)
      }
    }
  }

  private async checkMonitoringServices(): Promise<void> {
    // Check Sentry connectivity
    try {
      const sentryDsn = process.env.SENTRY_DSN
      if (!sentryDsn) {
        this.addCheck('Sentry Configuration', 'fail', 'Sentry DSN not configured')
        return
      }

      const sentryUrl = new URL(sentryDsn)
      if (sentryUrl.protocol === 'https:') {
        this.addCheck('Sentry Configuration', 'pass', 'Sentry DSN properly configured')
      } else {
        this.addCheck('Sentry Configuration', 'warn', 'Sentry DSN not using HTTPS')
      }
    } catch (error) {
      this.addCheck('Sentry Configuration', 'fail', `Sentry validation failed: ${error.message}`)
    }

    // Check environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'USDA_API_KEY', 'SENTRY_DSN']
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar])

    if (missingEnvVars.length === 0) {
      this.addCheck('Environment Configuration', 'pass', 'All required environment variables present')
    } else {
      this.addCheck('Environment Configuration', 'fail', `Missing: ${missingEnvVars.join(', ')}`)
    }
  }

  private async checkSecurityHeaders(): Promise<void> {
    try {
      const response = await fetch(process.env.SUPABASE_URL!, { method: 'HEAD' })

      const securityChecks = [
        {
          header: 'strict-transport-security',
          name: 'HSTS',
          required: true
        },
        {
          header: 'x-content-type-options',
          name: 'Content Type Options',
          required: true
        },
        {
          header: 'x-frame-options',
          name: 'Frame Options',
          required: false
        }
      ]

      securityChecks.forEach(check => {
        const headerValue = response.headers.get(check.header)

        if (headerValue) {
          this.addCheck(`Security Header: ${check.name}`, 'pass', `Present: ${headerValue}`)
        } else if (check.required) {
          this.addCheck(`Security Header: ${check.name}`, 'warn', 'Missing but recommended')
        } else {
          this.addCheck(`Security Header: ${check.name}`, 'warn', 'Missing (optional)')
        }
      })
    } catch (error) {
      this.addCheck('Security Headers', 'warn', `Could not check headers: ${error.message}`)
    }
  }

  private async checkContentDelivery(): Promise<void> {
    // Test CDN/static asset delivery if applicable
    try {
      const startTime = performance.now()

      // Test a basic connectivity check to the Supabase edge
      const response = await fetch(process.env.SUPABASE_URL! + '/rest/v1/', {
        method: 'HEAD'
      })

      const duration = performance.now() - startTime

      if (response.ok) {
        if (duration < 200) {
          this.addCheck('Edge Network', 'pass', `Fast edge response: ${duration.toFixed(2)}ms`)
        } else {
          this.addCheck('Edge Network', 'warn', `Slow edge response: ${duration.toFixed(2)}ms`)
        }
      } else {
        this.addCheck('Edge Network', 'fail', `Edge network error: ${response.status}`)
      }
    } catch (error) {
      this.addCheck('Edge Network', 'warn', `Edge check failed: ${error.message}`)
    }
  }

  private addCheck(name: string, status: 'pass' | 'fail' | 'warn', message: string, duration?: number): void {
    this.verification.checks.push({
      name,
      status,
      message,
      duration
    })
  }

  private calculateSummary(): void {
    this.verification.checks.forEach(check => {
      switch (check.status) {
        case 'pass':
          this.verification.summary.passed++
          break
        case 'fail':
          this.verification.summary.failed++
          break
        case 'warn':
          this.verification.summary.warnings++
          break
      }
    })

    this.verification.summary.totalChecks = this.verification.checks.length

    // Determine overall status
    if (this.verification.summary.failed > 0) {
      this.verification.summary.overallStatus = 'unhealthy'
    } else if (this.verification.summary.warnings > 2) {
      this.verification.summary.overallStatus = 'degraded'
    } else {
      this.verification.summary.overallStatus = 'healthy'
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(60))
    console.log('🚀 DEPLOYMENT VERIFICATION REPORT')
    console.log('='.repeat(60))

    console.log(`\n📋 Deployment Info:`)
    console.log(`  Version: ${this.verification.version}`)
    console.log(`  Environment: ${this.verification.environment}`)
    console.log(`  Timestamp: ${this.verification.timestamp}`)

    const statusEmoji = {
      pass: '✅',
      fail: '❌',
      warn: '⚠️'
    }

    console.log(`\n📊 Health Checks:`)
    this.verification.checks.forEach(check => {
      const emoji = statusEmoji[check.status]
      const duration = check.duration ? ` (${check.duration.toFixed(2)}ms)` : ''
      console.log(`  ${emoji} ${check.name}: ${check.message}${duration}`)
    })

    console.log(`\n📈 Summary:`)
    console.log(`  Passed: ${this.verification.summary.passed}`)
    console.log(`  Failed: ${this.verification.summary.failed}`)
    console.log(`  Warnings: ${this.verification.summary.warnings}`)
    console.log(`  Total: ${this.verification.summary.totalChecks}`)

    const overallEmoji = {
      healthy: '🟢',
      degraded: '🟡',
      unhealthy: '🔴'
    }

    console.log(`\n${overallEmoji[this.verification.summary.overallStatus]} Overall Status: ${this.verification.summary.overallStatus.toUpperCase()}`)

    if (this.verification.summary.overallStatus === 'healthy') {
      console.log('\n🎉 Deployment is healthy and ready for users!')
    } else if (this.verification.summary.overallStatus === 'degraded') {
      console.log('\n⚠️ Deployment has some issues but is functional.')
    } else {
      console.log('\n❌ Deployment has critical issues that need attention.')
    }

    console.log('='.repeat(60))
  }
}

// CLI execution
if (require.main === module) {
  const verifier = new DeploymentVerifier()

  verifier
    .verifyDeployment()
    .then(result => {
      const exitCode = result.summary.overallStatus === 'unhealthy' ? 1 : 0
      process.exit(exitCode)
    })
    .catch(error => {
      console.error('❌ Deployment verification failed:', error.message)
      process.exit(1)
    })
}

export { DeploymentVerifier }