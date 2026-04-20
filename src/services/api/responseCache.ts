import { createHash } from 'crypto'

/**
 * In-memory LRU response cache for token economy mode.
 *
 * When token economy is enabled, caches provider responses keyed by a hash of:
 * - system prompt text
 * - last N user/assistant messages (configurable depth)
 * - model name
 *
 * This avoids redundant API calls when context hasn't meaningfully changed,
 * e.g. repeated tool-use loops with identical surrounding context.
 *
 * Cache is entirely in-memory and session-scoped. No persistence.
 */

const DEFAULT_MAX_ENTRIES = 50
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes
// How many of the trailing messages to include in the cache key
const CACHE_KEY_MESSAGE_DEPTH = 6

interface CacheEntry<T> {
  value: T
  createdAt: number
  hitCount: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxEntries: number
  private ttlMs: number

  constructor(maxEntries = DEFAULT_MAX_ENTRIES, ttlMs = DEFAULT_TTL_MS) {
    this.maxEntries = maxEntries
    this.ttlMs = ttlMs
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // TTL check
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    entry.hitCount++
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: string, value: T): void {
    // Delete if exists to reset position
    this.cache.delete(key)

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) {
        this.cache.delete(oldest)
      }
    }

    this.cache.set(key, {
      value,
      createdAt: Date.now(),
      hitCount: 0,
    })
  }

  get size(): number {
    return this.cache.size
  }

  get stats(): { size: number; totalHits: number } {
    let totalHits = 0
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount
    }
    return { size: this.cache.size, totalHits }
  }

  clear(): void {
    this.cache.clear()
  }
}

// Singleton cache instance
const responseCache = new LRUCache<CachedResponse>()

export interface CachedResponse {
  // The serialized assistant message content (text blocks only — tool_use not cacheable)
  textContent: string
  model: string
  // Rough token count of the cached response for metrics
  estimatedTokens: number
}

/**
 * Generate a cache key from the request parameters.
 * Uses a SHA-256 hash of the system prompt + last N messages + model.
 */
export function generateCacheKey(
  systemPrompt: string,
  messages: Array<{ role: string; content: unknown }>,
  model: string,
): string {
  const recentMessages = messages.slice(-CACHE_KEY_MESSAGE_DEPTH)
  const keyMaterial = JSON.stringify({
    s: systemPrompt.slice(0, 500), // First 500 chars of system prompt for key
    m: recentMessages.map(m => ({
      r: m.role,
      c:
        typeof m.content === 'string'
          ? m.content.slice(0, 200)
          : JSON.stringify(m.content).slice(0, 200),
    })),
    model,
  })
  return createHash('sha256').update(keyMaterial).digest('hex')
}

/**
 * Check if there's a cached response for the given request.
 * Only active when token economy mode is enabled.
 */
export function getCachedResponse(
  _systemPrompt: string,
  _messages: Array<{ role: string; content: unknown }>,
  _model: string,
): CachedResponse | undefined {
  return undefined
}

/**
 * Store a response in the cache.
 * Only stores when token economy mode is enabled.
 * Only caches pure text responses (not tool_use, since those have side effects).
 */
export function cacheResponse(
  _systemPrompt: string,
  _messages: Array<{ role: string; content: unknown }>,
  _model: string,
  _textContent: string,
  _estimatedTokens: number,
): void {}

/**
 * Get cache statistics for display in /token-economy status.
 */
export function getResponseCacheStats(): {
  size: number
  totalHits: number
} {
  return responseCache.stats
}

/**
 * Clear the response cache.
 */
export function clearResponseCache(): void {
  responseCache.clear()
}
