// lib/offlineManager.ts - Offline mode with sync queue processing
import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { logger } from './logger'
import { eventBus } from './eventBus'
import { performanceMonitor } from './performance'

interface SyncOperation {
  id: string
  type: 'LOG_MEAL' | 'UPDATE_RECIPE' | 'CREATE_MEAL_PLAN' | 'UPDATE_PROFILE' | 'DELETE_ENTRY'
  data: any
  timestamp: number
  retryCount: number
  priority: 'low' | 'normal' | 'high'
  userId: string
  maxRetries?: number
}

interface OfflineState {
  isOnline: boolean
  syncQueue: SyncOperation[]
  lastSyncAttempt: number | null
  isSyncing: boolean
}

interface SyncResult {
  success: boolean
  processed: number
  failed: number
  errors: Array<{ operationId: string; error: string }>
}

export class OfflineManager {
  private state: OfflineState = {
    isOnline: true,
    syncQueue: [],
    lastSyncAttempt: null,
    isSyncing: false
  }

  private readonly STORAGE_KEY = 'offline_sync_queue'
  private readonly MAX_QUEUE_SIZE = 1000
  private readonly SYNC_INTERVAL = 30000 // 30 seconds
  private readonly MAX_RETRIES = 3

  private syncTimer: NodeJS.Timeout | null = null
  private netInfoUnsubscribe: (() => void) | null = null

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      // Load persisted queue
      await this.loadQueueFromStorage()

      // Setup network listener
      this.setupNetworkListener()

      // Start sync timer
      this.startSyncTimer()

      logger.info('Offline manager initialized', {
        queueSize: this.state.syncQueue.length,
        isOnline: this.state.isOnline
      })
    } catch (error) {
      logger.error('Failed to initialize offline manager', { error })
    }
  }

  private setupNetworkListener(): void {
    this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !this.state.isOnline
      this.state.isOnline = state.isConnected ?? false

      logger.info('Network state changed', {
        isOnline: this.state.isOnline,
        connectionType: state.type,
        isInternetReachable: state.isInternetReachable
      })

      // Trigger sync when coming back online
      if (wasOffline && this.state.isOnline && this.state.syncQueue.length > 0) {
        logger.info('Coming back online, triggering sync')
        this.processSyncQueue()
      }

      // Emit network status event
      eventBus.emit('network_status_changed', {
        isOnline: this.state.isOnline,
        queuedOperations: this.state.syncQueue.length
      })
    })
  }

  private startSyncTimer(): void {
    this.syncTimer = setInterval(() => {
      if (this.state.isOnline && this.state.syncQueue.length > 0 && !this.state.isSyncing) {
        this.processSyncQueue()
      }
    }, this.SYNC_INTERVAL)
  }

  async queueOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const syncOperation: SyncOperation = {
      ...operation,
      id: generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: operation.maxRetries || this.MAX_RETRIES
    }

    // Check queue size limit
    if (this.state.syncQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low priority operations
      this.state.syncQueue = this.state.syncQueue
        .filter(op => op.priority !== 'low')
        .slice(-(this.MAX_QUEUE_SIZE - 1))

      logger.warn('Sync queue full, removed old low priority operations')
    }

    // Add operation to queue (sort by priority)
    this.state.syncQueue.push(syncOperation)
    this.sortQueueByPriority()

    // Persist queue
    await this.saveQueueToStorage()

    logger.info('Operation queued for sync', {
      operationId: syncOperation.id,
      type: syncOperation.type,
      priority: syncOperation.priority,
      queueSize: this.state.syncQueue.length
    })

    // Try immediate sync if online
    if (this.state.isOnline && !this.state.isSyncing) {
      this.processSyncQueue()
    }

    return syncOperation.id
  }

  private sortQueueByPriority(): void {
    const priorityOrder = { high: 3, normal: 2, low: 1 }

    this.state.syncQueue.sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
      if (priorityDiff !== 0) return priorityDiff

      // Then by timestamp (older first)
      return a.timestamp - b.timestamp
    })
  }

  async processSyncQueue(): Promise<SyncResult> {
    if (!this.state.isOnline || this.state.isSyncing || this.state.syncQueue.length === 0) {
      return { success: true, processed: 0, failed: 0, errors: [] }
    }

    this.state.isSyncing = true
    this.state.lastSyncAttempt = Date.now()

    return await performanceMonitor.trackOperation('offlineSync', async () => {
      const result: SyncResult = {
        success: true,
        processed: 0,
        failed: 0,
        errors: []
      }

      const operationsToProcess = [...this.state.syncQueue]

      logger.info('Starting sync queue processing', {
        operationsCount: operationsToProcess.length
      })

      for (const operation of operationsToProcess) {
        try {
          await this.executeOperation(operation)

          // Remove successful operation from queue
          this.removeOperationFromQueue(operation.id)
          result.processed++

          logger.debug('Operation synced successfully', {
            operationId: operation.id,
            type: operation.type
          })

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)

          // Increment retry count
          const operationIndex = this.state.syncQueue.findIndex(op => op.id === operation.id)
          if (operationIndex >= 0) {
            this.state.syncQueue[operationIndex].retryCount++

            // Remove if max retries exceeded
            if (this.state.syncQueue[operationIndex].retryCount >= operation.maxRetries!) {
              this.removeOperationFromQueue(operation.id)

              logger.error('Operation failed permanently after max retries', {
                operationId: operation.id,
                type: operation.type,
                retryCount: operation.retryCount,
                error: errorMessage
              })
            }
          }

          result.failed++
          result.errors.push({
            operationId: operation.id,
            error: errorMessage
          })

          logger.warn('Operation sync failed', {
            operationId: operation.id,
            type: operation.type,
            retryCount: operation.retryCount,
            error: errorMessage
          })
        }
      }

      // Persist updated queue
      await this.saveQueueToStorage()

      this.state.isSyncing = false

      // Emit sync completion event
      eventBus.emit('sync_completed', {
        processed: result.processed,
        failed: result.failed,
        remaining: this.state.syncQueue.length
      })

      logger.info('Sync queue processing completed', {
        processed: result.processed,
        failed: result.failed,
        remaining: this.state.syncQueue.length
      })

      return result
    })
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    // This would integrate with your actual services
    // For now, we'll define the interface that services should implement

    switch (operation.type) {
      case 'LOG_MEAL':
        await this.syncLogMeal(operation.data)
        break

      case 'UPDATE_RECIPE':
        await this.syncUpdateRecipe(operation.data)
        break

      case 'CREATE_MEAL_PLAN':
        await this.syncCreateMealPlan(operation.data)
        break

      case 'UPDATE_PROFILE':
        await this.syncUpdateProfile(operation.data)
        break

      case 'DELETE_ENTRY':
        await this.syncDeleteEntry(operation.data)
        break

      default:
        throw new Error(`Unknown operation type: ${operation.type}`)
    }
  }

  // Service integration methods (these would call your actual services)
  private async syncLogMeal(data: any): Promise<void> {
    // This would call your LedgerService
    logger.debug('Syncing meal log', { entryId: data.id })
    // await ledgerService.add(data)
  }

  private async syncUpdateRecipe(data: any): Promise<void> {
    // This would call your RecipeService
    logger.debug('Syncing recipe update', { recipeId: data.id })
    // await recipeService.update(data.id, data)
  }

  private async syncCreateMealPlan(data: any): Promise<void> {
    // This would call your PlanService
    logger.debug('Syncing meal plan creation', { planId: data.id })
    // await planService.create(data)
  }

  private async syncUpdateProfile(data: any): Promise<void> {
    // This would call your ProfileService
    logger.debug('Syncing profile update', { userId: data.userId })
    // await profileService.update(data)
  }

  private async syncDeleteEntry(data: any): Promise<void> {
    // This would call appropriate service based on entry type
    logger.debug('Syncing entry deletion', { entryId: data.id, type: data.type })
    // await getServiceForType(data.type).delete(data.id)
  }

  private removeOperationFromQueue(operationId: string): void {
    this.state.syncQueue = this.state.syncQueue.filter(op => op.id !== operationId)
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsedQueue = JSON.parse(stored) as SyncOperation[]

        // Filter out expired operations (older than 7 days)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
        this.state.syncQueue = parsedQueue.filter(op => op.timestamp > sevenDaysAgo)

        logger.info('Loaded sync queue from storage', {
          totalStored: parsedQueue.length,
          validOperations: this.state.syncQueue.length
        })
      }
    } catch (error) {
      logger.error('Failed to load sync queue from storage', { error })
      this.state.syncQueue = []
    }
  }

  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state.syncQueue))
    } catch (error) {
      logger.error('Failed to save sync queue to storage', { error })
    }
  }

  // Public API methods
  getOfflineState(): Readonly<OfflineState> {
    return { ...this.state }
  }

  isOnline(): boolean {
    return this.state.isOnline
  }

  getQueueSize(): number {
    return this.state.syncQueue.length
  }

  async forcSync(): Promise<SyncResult> {
    if (!this.state.isOnline) {
      throw new Error('Cannot sync while offline')
    }

    return await this.processSyncQueue()
  }

  async clearQueue(): Promise<void> {
    this.state.syncQueue = []
    await this.saveQueueToStorage()

    logger.info('Sync queue cleared')
  }

  async removeOperation(operationId: string): Promise<boolean> {
    const initialSize = this.state.syncQueue.length
    this.removeOperationFromQueue(operationId)

    if (this.state.syncQueue.length < initialSize) {
      await this.saveQueueToStorage()
      return true
    }

    return false
  }

  // Cleanup
  async cleanup(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }

    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe()
      this.netInfoUnsubscribe = null
    }

    // Final sync attempt
    if (this.state.isOnline && this.state.syncQueue.length > 0) {
      await this.processSyncQueue()
    }

    logger.info('Offline manager cleanup completed')
  }
}

// Utility functions
const generateOperationId = (): string => {
  return `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

// Offline-aware facade wrapper
export const createOfflineAwareFacade = <T extends Record<string, Function>>(
  service: T,
  offlineManager: OfflineManager
): T => {
  const proxy = new Proxy(service, {
    get(target, prop) {
      const original = target[prop as keyof T]

      if (typeof original === 'function') {
        return async (...args: any[]) => {
          try {
            // Try to execute immediately if online
            if (offlineManager.isOnline()) {
              return await original.apply(target, args)
            } else {
              // Queue for later sync if offline
              const operationType = mapMethodToOperationType(prop as string)
              if (operationType) {
                await offlineManager.queueOperation({
                  type: operationType,
                  data: args[0], // Assuming first arg is the data
                  priority: 'normal',
                  userId: getCurrentUserId() || 'anonymous'
                })

                // Return optimistic result
                return { queued: true, operationId: 'pending' }
              } else {
                throw new Error('Operation not available offline')
              }
            }
          } catch (error) {
            logger.error('Facade operation failed', {
              method: prop as string,
              error: error instanceof Error ? error.message : String(error)
            })
            throw error
          }
        }
      }

      return original
    }
  })

  return proxy
}

// Helper to map facade methods to operation types
const mapMethodToOperationType = (methodName: string): SyncOperation['type'] | null => {
  const mapping: Record<string, SyncOperation['type']> = {
    'logFood': 'LOG_MEAL',
    'logMeal': 'LOG_MEAL',
    'updateRecipe': 'UPDATE_RECIPE',
    'createRecipe': 'UPDATE_RECIPE',
    'createMealPlan': 'CREATE_MEAL_PLAN',
    'updateProfile': 'UPDATE_PROFILE',
    'deleteEntry': 'DELETE_ENTRY'
  }

  return mapping[methodName] || null
}

const getCurrentUserId = (): string | null => {
  // This would integrate with your auth system
  try {
    return 'current-user-id' // Placeholder
  } catch {
    return null
  }
}

// Singleton instance
let offlineManagerInstance: OfflineManager | null = null

export const getOfflineManager = (): OfflineManager => {
  if (!offlineManagerInstance) {
    offlineManagerInstance = new OfflineManager()
  }
  return offlineManagerInstance
}

export default OfflineManager