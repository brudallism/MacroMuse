// infra/database/connectionPool.ts - Optimized Supabase client with connection management
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@lib/logger'
import { performanceMonitor } from '@lib/performance'
import { QueryAnalyzer } from './queryAnalyzer'

interface DatabaseConfig {
  url: string
  anonKey: string
  maxConnections?: number
  connectionTimeout?: number
  queryTimeout?: number
  enableQueryAnalysis?: boolean
}

interface QueryOptions {
  timeout?: number
  priority?: 'low' | 'normal' | 'high'
  skipAnalysis?: boolean
}

class OptimizedSupabaseClient {
  private client: SupabaseClient
  private queryAnalyzer?: QueryAnalyzer
  private connectionCount = 0
  private maxConnections: number
  private queryQueue: Array<{ query: () => Promise<any>; resolve: (value: any) => void; reject: (error: any) => void }> = []
  private isProcessingQueue = false

  constructor(config: DatabaseConfig) {
    this.maxConnections = config.maxConnections || 20

    this.client = createClient(config.url, config.anonKey, {
      db: {
        schema: 'public',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storage: undefined, // Use default storage
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-client-info': 'macromuse-mobile',
          'x-client-version': '2.0.0'
        },
        fetch: this.optimizedFetch.bind(this)
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })

    if (config.enableQueryAnalysis) {
      this.queryAnalyzer = new QueryAnalyzer(this.client)
    }

    logger.info('Optimized Supabase client initialized', {
      maxConnections: this.maxConnections,
      queryAnalysisEnabled: !!this.queryAnalyzer
    })
  }

  private async optimizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    return performanceMonitor.trackOperation('databaseQuery', async () => {
      // Add connection management headers
      const optimizedOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'Connection': 'keep-alive',
          'Keep-Alive': 'timeout=30, max=100'
        }
      }

      // Add timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      try {
        const response = await fetch(url, {
          ...optimizedOptions,
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          logger.warn('Database query timeout', { url })
          throw new Error('Database query timeout')
        }

        throw error
      }
    })
  }

  async executeQuery<T>(
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queryTask = {
        query: async () => {
          try {
            this.connectionCount++

            const result = await queryFn()

            this.connectionCount--
            return result
          } catch (error) {
            this.connectionCount--
            throw error
          }
        },
        resolve,
        reject
      }

      // Check connection limits
      if (this.connectionCount >= this.maxConnections) {
        this.queryQueue.push(queryTask)
        this.processQueue()
      } else {
        this.executeQueryTask(queryTask)
      }
    })
  }

  private async executeQueryTask(task: { query: () => Promise<any>; resolve: (value: any) => void; reject: (error: any) => void }): Promise<void> {
    try {
      const result = await task.query()
      task.resolve(result)
    } catch (error) {
      logger.error('Database query failed', { error })
      task.reject(error)
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.queryQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true

    while (this.queryQueue.length > 0 && this.connectionCount < this.maxConnections) {
      const task = this.queryQueue.shift()
      if (task) {
        this.executeQueryTask(task)
      }
    }

    this.isProcessingQueue = false
  }

  // Optimized query methods
  async select<T>(
    table: string,
    columns: string = '*',
    filters?: Record<string, any>,
    options?: QueryOptions
  ): Promise<T[]> {
    return this.executeQuery(async () => {
      let query = this.client.from(table).select(columns)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            query = query.in(key, value)
          } else if (typeof value === 'object' && value !== null) {
            // Handle range queries, etc.
            if (value.gte !== undefined) query = query.gte(key, value.gte)
            if (value.lte !== undefined) query = query.lte(key, value.lte)
            if (value.gt !== undefined) query = query.gt(key, value.gt)
            if (value.lt !== undefined) query = query.lt(key, value.lt)
          } else {
            query = query.eq(key, value)
          }
        })
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      return data || []
    }, options)
  }

  async insert<T>(
    table: string,
    data: Partial<T> | Partial<T>[],
    options?: QueryOptions
  ): Promise<T[]> {
    return this.executeQuery(async () => {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data)
        .select()

      if (error) {
        throw error
      }

      return result || []
    }, options)
  }

  async update<T>(
    table: string,
    data: Partial<T>,
    filters: Record<string, any>,
    options?: QueryOptions
  ): Promise<T[]> {
    return this.executeQuery(async () => {
      let query = this.client.from(table).update(data)

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      const { data: result, error } = await query.select()

      if (error) {
        throw error
      }

      return result || []
    }, options)
  }

  async delete(
    table: string,
    filters: Record<string, any>,
    options?: QueryOptions
  ): Promise<void> {
    return this.executeQuery(async () => {
      let query = this.client.from(table).delete()

      Object.entries(filters).forEach(([key, value]) => {
        query = query.eq(key, value)
      })

      const { error } = await query

      if (error) {
        throw error
      }
    }, options)
  }

  async executeRPC<T>(
    functionName: string,
    params?: Record<string, any>,
    options?: QueryOptions
  ): Promise<T> {
    return this.executeQuery(async () => {
      const { data, error } = await this.client.rpc(functionName, params)

      if (error) {
        throw error
      }

      return data
    }, options)
  }

  // Optimized batch operations
  async batchInsert<T>(
    table: string,
    data: Partial<T>[],
    batchSize: number = 100,
    options?: QueryOptions
  ): Promise<T[]> {
    const results: T[] = []

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)

      const batchResult = await this.insert(table, batch, options)
      results.push(...batchResult)

      // Small delay between batches to prevent overwhelming the server
      if (i + batchSize < data.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    return results
  }

  // Query analysis methods
  async analyzeQuery(sql: string, params: any[] = []): Promise<void> {
    if (this.queryAnalyzer) {
      await this.queryAnalyzer.analyzeQuery(sql, params)
    }
  }

  async runQueryOptimization(): Promise<void> {
    if (this.queryAnalyzer) {
      await this.queryAnalyzer.optimizeCommonQueries()
    }
  }

  getQueryStats() {
    return this.queryAnalyzer?.getQueryStats() || {
      totalQueries: 0,
      slowQueries: 0,
      avgDuration: 0,
      recentSlowQueries: []
    }
  }

  // Connection management
  getConnectionInfo() {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      queuedQueries: this.queryQueue.length
    }
  }

  // Cleanup
  async cleanup(): Promise<void> {
    // Wait for queue to empty
    while (this.queryQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Clear query history if analyzer exists
    this.queryAnalyzer?.clearQueryHistory()

    logger.info('Database client cleanup completed')
  }
}

// Factory function for creating optimized Supabase client
export const createOptimizedSupabaseClient = (
  url?: string,
  anonKey?: string,
  options: Partial<DatabaseConfig> = {}
): OptimizedSupabaseClient => {
  const config: DatabaseConfig = {
    url: url || process.env.EXPO_PUBLIC_SUPABASE_URL!,
    anonKey: anonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    maxConnections: 20,
    connectionTimeout: 10000,
    queryTimeout: 30000,
    enableQueryAnalysis: process.env.NODE_ENV === 'development',
    ...options
  }

  return new OptimizedSupabaseClient(config)
}

// Singleton instance for app use
let optimizedClient: OptimizedSupabaseClient | null = null

export const getOptimizedSupabaseClient = (): OptimizedSupabaseClient => {
  if (!optimizedClient) {
    optimizedClient = createOptimizedSupabaseClient()
  }
  return optimizedClient
}

// Health check utilities
export const performDatabaseHealthCheck = async (): Promise<{
  healthy: boolean
  latency: number
  connectionCount: number
  queryStats: any
}> => {
  const client = getOptimizedSupabaseClient()
  const startTime = performance.now()

  try {
    // Simple health check query
    await client.executeRPC('health_check')

    const latency = performance.now() - startTime
    const connectionInfo = client.getConnectionInfo()
    const queryStats = client.getQueryStats()

    return {
      healthy: true,
      latency,
      connectionCount: connectionInfo.activeConnections,
      queryStats
    }
  } catch (error) {
    logger.error('Database health check failed', { error })

    return {
      healthy: false,
      latency: performance.now() - startTime,
      connectionCount: 0,
      queryStats: { totalQueries: 0, slowQueries: 0, avgDuration: 0, recentSlowQueries: [] }
    }
  }
}