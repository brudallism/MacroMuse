// In-memory cache implementation with TTL support
import { CacheRepository } from '../../domain/repositories'

interface CacheEntry<T> {
  value: T
  expires: number
}

export class InMemoryCacheRepository<T> implements CacheRepository<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private cleanupInterval: NodeJS.Timeout

  constructor(private defaultTTL: number = 3600000) { // 1 hour default
    // Cleanup expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000)
  }

  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() > entry.expires) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.defaultTTL)
    this.cache.set(key, { value, expires })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  async clear(): Promise<void> {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.clear()
  }
}