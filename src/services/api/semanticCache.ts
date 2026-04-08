import { createHash } from 'crypto'
import envPaths from 'env-paths'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { logForDebugging } from '../../utils/debug.js'
import {
    cosineSimilarity,
    generateEmbedding as generateOllamaEmbedding,
    isEmbeddingAvailable as isOllamaEmbeddingAvailable,
} from './ollamaEmbedding.js'

/**
 * Semantic Response Cache
 *
 * Persistent, embedding-based cache that finds similar previous queries
 * and returns cached responses when similarity exceeds a threshold.
 *
 * Two-tier embedding strategy:
 * 1. Ollama (nomic-embed-text) — high-quality neural embeddings when available
 * 2. Local fallback — n-gram feature hashing, zero dependencies, always works
 *
 * The local fallback uses a different similarity threshold (0.85 vs 0.92)
 * since lexical embeddings are less precise than neural ones.
 *
 * Architecture:
 * - Stores cache entries as individual JSON files on disk (~/.openclaude/cache/semantic-cache/)
 * - Each entry contains: embedding vector, response text, metadata, embedding source
 * - On lookup: generates embedding for current query, compares via cosine similarity
 * - LRU eviction on disk when max reached
 *
 * Storage budget: Max 200 entries (configurable), ~1-2KB per entry = ~400KB total
 * Performance: <1ms local embedding, <50ms Ollama embedding, <5ms lookup (200 entries)
 */

const paths = envPaths('claude-cli')
const CACHE_DIR_NAME = 'semantic-cache'

const DEFAULT_SIMILARITY_THRESHOLD = 0.92
const DEFAULT_LOCAL_SIMILARITY_THRESHOLD = 0.95
const DEFAULT_MAX_ENTRIES = 200
const DEFAULT_ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

type EmbeddingSource = 'ollama' | 'local'

let _config = {
  similarityThreshold: DEFAULT_SIMILARITY_THRESHOLD,
  localSimilarityThreshold: DEFAULT_LOCAL_SIMILARITY_THRESHOLD,
  maxEntries: DEFAULT_MAX_ENTRIES,
  entryTtlMs: DEFAULT_ENTRY_TTL_MS,
  enabled: true,
}

export interface SemanticCacheConfig {
  similarityThreshold?: number
  localSimilarityThreshold?: number
  maxEntries?: number
  entryTtlMs?: number
  enabled?: boolean
}

export function configureSemanticCache(config: SemanticCacheConfig): void {
  _config = { ..._config, ...config }
}

interface CacheEntry {
  /** SHA-256 of the query text — used as filename */
  id: string
  /** The cache key text that was embedded */
  queryText: string
  /** Embedding vector as plain number array (JSON-serializable) */
  embedding: number[]
  /** Which embedding strategy generated this vector */
  embeddingSource: EmbeddingSource
  /** The cached response text */
  responseText: string
  /** Model that generated the response */
  model: string
  /** Estimated token count of the cached response */
  estimatedTokens: number
  /** Timestamp of creation */
  createdAt: number
  /** Timestamp of last access */
  lastAccessedAt: number
  /** Number of times this entry was hit */
  hitCount: number
}

// In-memory index: loaded once per session, kept in sync with disk
let _index: CacheEntry[] | null = null
let _cacheDir: string | null = null

function getCacheDir(): string {
  if (!_cacheDir) {
    _cacheDir = join(paths.cache, CACHE_DIR_NAME)
    if (!existsSync(_cacheDir)) {
      mkdirSync(_cacheDir, { recursive: true })
    }
  }
  return _cacheDir
}

function entryPath(id: string): string {
  return join(getCacheDir(), `${id}.json`)
}

/**
 * Build the query text used for embedding from the request parameters.
 * Uses the last user message + model name for focused similarity matching.
 */
export function buildCacheQueryText(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
): string {
  // Extract last user message content
  const userMessages = messages.filter(m => m.role === 'user')
  const lastUser = userMessages[userMessages.length - 1]
  if (!lastUser) return ''

  let text: string
  if (typeof lastUser.content === 'string') {
    text = lastUser.content
  } else if (Array.isArray(lastUser.content)) {
    text = (lastUser.content as Array<{ type?: string; text?: string }>)
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('\n')
  } else {
    text = JSON.stringify(lastUser.content).slice(0, 500)
  }

  // Truncate to keep embedding focused (nomic-embed-text handles up to 8192 tokens)
  return text.slice(0, 2000)
}

/**
 * Generate an embedding using Ollama neural embeddings.
 * Returns null if Ollama is not available — semantic cache is Ollama-only.
 */
async function generateEmbedding(text: string): Promise<{
  embedding: Float64Array
  source: EmbeddingSource
} | null> {
  if (!(await isOllamaEmbeddingAvailable())) {
    return null
  }
  const ollamaEmb = await generateOllamaEmbedding(text)
  if (!ollamaEmb) return null
  return { embedding: ollamaEmb, source: 'ollama' }
}

/**
 * Get the similarity threshold based on embedding source.
 * Local embeddings need a lower threshold since they're lexical, not neural.
 */
function getThresholdForSource(source: EmbeddingSource): number {
  return source === 'ollama'
    ? _config.similarityThreshold
    : _config.localSimilarityThreshold
}

/**
 * Load the in-memory index from disk (lazy, once per session).
 */
function loadIndex(): CacheEntry[] {
  if (_index !== null) return _index

  const dir = getCacheDir()
  _index = []

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    const now = Date.now()

    for (const file of files) {
      try {
        const filePath = join(dir, file)
        const raw = readFileSync(filePath, 'utf-8')
        const entry = JSON.parse(raw) as CacheEntry

        // Evict expired entries
        if (now - entry.createdAt > _config.entryTtlMs) {
          try { unlinkSync(filePath) } catch { /* ignore */ }
          continue
        }

        _index.push(entry)
      } catch {
        // Corrupted entry — skip
      }
    }

    logForDebugging(
      `[semantic-cache] Loaded ${_index.length} entries from disk`,
    )
  } catch {
    _index = []
  }

  return _index
}

/**
 * Write a cache entry to disk.
 */
function persistEntry(entry: CacheEntry): void {
  try {
    const path = entryPath(entry.id)
    writeFileSync(path, JSON.stringify(entry), 'utf-8')
  } catch (e) {
    logForDebugging(`[semantic-cache] Failed to persist entry: ${e}`)
  }
}

/**
 * Evict oldest entries when over capacity.
 */
function evictIfNeeded(): void {
  const index = loadIndex()
  if (index.length <= _config.maxEntries) return

  // Sort by last access time (ascending = oldest first)
  index.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

  const toRemove = index.length - _config.maxEntries
  const evicted = index.splice(0, toRemove)

  for (const entry of evicted) {
    try { unlinkSync(entryPath(entry.id)) } catch { /* ignore */ }
  }

  logForDebugging(
    `[semantic-cache] Evicted ${toRemove} entries (capacity: ${_config.maxEntries})`,
  )
}

/**
 * Look up a semantically similar cached response.
 *
 * Returns the cached response text + metadata if a match is found
 * above the similarity threshold, or null otherwise.
 */
export async function getSemanticCachedResponse(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
): Promise<{
  responseText: string
  model: string
  estimatedTokens: number
  similarity: number
} | null> {
  if (!_config.enabled) return null

  const queryText = buildCacheQueryText(messages, model)
  if (!queryText) return null

  const result = await generateEmbedding(queryText)
  if (!result) return null // Ollama not available
  const { embedding: queryEmbedding, source } = result

  const index = loadIndex()
  if (index.length === 0) return null

  const threshold = getThresholdForSource(source)
  let bestMatch: CacheEntry | null = null
  let bestSimilarity = 0

  for (const entry of index) {
    // Only match same model family
    if (entry.model !== model) continue
    // Only compare entries with same embedding source (dimensions/space differ)
    if (entry.embeddingSource !== source) continue

    const entrySim = cosineSimilarity(
      queryEmbedding,
      new Float64Array(entry.embedding),
    )

    if (entrySim > bestSimilarity) {
      bestSimilarity = entrySim
      bestMatch = entry
    }
  }

  if (!bestMatch || bestSimilarity < threshold) {
    logForDebugging(
      `[semantic-cache] MISS (best similarity: ${bestSimilarity.toFixed(4)}, ` +
        `threshold: ${threshold}, source: ${source})`,
    )
    return null
  }

  // Update access metadata
  bestMatch.lastAccessedAt = Date.now()
  bestMatch.hitCount++
  persistEntry(bestMatch)

  logForDebugging(
    `[semantic-cache] HIT — similarity ${bestSimilarity.toFixed(4)}, ` +
      `saved ~${bestMatch.estimatedTokens} tokens (hits: ${bestMatch.hitCount})`,
  )

  return {
    responseText: bestMatch.responseText,
    model: bestMatch.model,
    estimatedTokens: bestMatch.estimatedTokens,
    similarity: bestSimilarity,
  }
}

/**
 * Store a response in the semantic cache.
 * Generates an embedding for the query and persists to disk.
 */
export async function cacheSemanticResponse(
  messages: Array<{ role: string; content: unknown }>,
  model: string,
  responseText: string,
  estimatedTokens: number,
): Promise<void> {
  if (!_config.enabled) return

  const queryText = buildCacheQueryText(messages, model)
  if (!queryText) return

  const result = await generateEmbedding(queryText)
  if (!result) return // Ollama not available
  const { embedding, source } = result

  const id = createHash('sha256').update(queryText).digest('hex').slice(0, 16)

  const entry: CacheEntry = {
    id,
    queryText: queryText.slice(0, 500), // Store truncated for debugging
    embedding: Array.from(embedding),
    embeddingSource: source,
    responseText,
    model,
    estimatedTokens,
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
  }

  const index = loadIndex()

  // Check if near-duplicate already exists (same source only)
  for (const existing of index) {
    if (existing.model !== model) continue
    if (existing.embeddingSource !== source) continue
    const sim = cosineSimilarity(embedding, new Float64Array(existing.embedding))
    if (sim > 0.98) {
      // Update existing entry with fresh response
      existing.responseText = responseText
      existing.estimatedTokens = estimatedTokens
      existing.lastAccessedAt = Date.now()
      persistEntry(existing)
      logForDebugging(
        `[semantic-cache] Updated existing entry (similarity: ${sim.toFixed(4)})`,
      )
      return
    }
  }

  index.push(entry)
  persistEntry(entry)
  evictIfNeeded()

  logForDebugging(
    `[semantic-cache] Stored new entry (${index.length}/${_config.maxEntries})`,
  )
}

/**
 * Get cache statistics.
 */
export function getSemanticCacheStats(): {
  entries: number
  maxEntries: number
  totalHits: number
  diskSizeBytes: number
} {
  const index = loadIndex()
  let totalHits = 0
  let diskSizeBytes = 0

  for (const entry of index) {
    totalHits += entry.hitCount
    try {
      const stat = statSync(entryPath(entry.id))
      diskSizeBytes += stat.size
    } catch { /* ignore */ }
  }

  return {
    entries: index.length,
    maxEntries: _config.maxEntries,
    totalHits,
    diskSizeBytes,
  }
}

/**
 * Clear all semantic cache entries.
 */
export function clearSemanticCache(): void {
  const index = loadIndex()
  for (const entry of index) {
    try { unlinkSync(entryPath(entry.id)) } catch { /* ignore */ }
  }
  _index = []
  logForDebugging('[semantic-cache] Cleared all entries')
}
