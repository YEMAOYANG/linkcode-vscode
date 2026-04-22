/**
 * LRU Cache for inline completion results.
 * Uses a Map to maintain insertion order for LRU eviction.
 * Each entry has a TTL; expired entries are treated as cache misses.
 */

import { MAX_CACHE_SIZE, CACHE_TTL_MS } from '../shared/constants'

interface CacheEntry {
  completion: string
  timestamp: number
}

export class CompletionCache {
  private readonly cache = new Map<string, CacheEntry>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(maxSize: number = MAX_CACHE_SIZE, ttlMs: number = CACHE_TTL_MS) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  /**
   * Build a cache key from document URI and line prefix.
   */
  static buildKey(documentUri: string, linePrefix: string): string {
    return `${documentUri}:${linePrefix}`
  }

  /**
   * Get a cached completion if it exists and hasn't expired.
   * Promotes the entry to most-recently-used on hit.
   */
  get(key: string): string | undefined {
    const entry = this.cache.get(key)
    if (!entry) {
      return undefined
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    // Promote to most-recently-used (re-insert at end)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.completion
  }

  /**
   * Store a completion in the cache. Evicts the least-recently-used
   * entry if the cache is at capacity.
   */
  set(key: string, completion: string): void {
    // If key already exists, delete first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, { completion, timestamp: Date.now() })
  }

  /**
   * Remove all entries from the cache.
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size
  }
}
