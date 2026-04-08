import { logForDebugging } from '../../utils/debug.js'
import { getOllamaApiBaseUrl } from '../../utils/providerDiscovery.js'

/**
 * Ollama Embedding Service
 *
 * Generates embeddings locally via Ollama's /api/embeddings endpoint.
 * Uses nomic-embed-text by default — a 137M-parameter model (~274MB on disk)
 * that runs comfortably on M1 with 16GB RAM.
 *
 * Embedding dimensions: 768 (nomic-embed-text)
 * Latency: ~20-50ms per embedding on M1
 */

const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text'
const EMBEDDING_TIMEOUT_MS = 10_000

let _embeddingModel: string = DEFAULT_EMBEDDING_MODEL
let _available: boolean | null = null

export function setEmbeddingModel(model: string): void {
  _embeddingModel = model
  _available = null // reset availability check
}

export function getEmbeddingModel(): string {
  return _embeddingModel
}

/**
 * Check if the embedding model is pulled and Ollama is running.
 * Caches result for the session.
 */
export async function isEmbeddingAvailable(
  baseUrl?: string,
): Promise<boolean> {
  if (_available !== null) return _available

  try {
    const url = getOllamaApiBaseUrl(baseUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const resp = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      _available = false
      return false
    }

    const data = (await resp.json()) as {
      models?: Array<{ name?: string }>
    }
    const names = (data.models ?? []).map(m => m.name ?? '')
    // Match both "nomic-embed-text" and "nomic-embed-text:latest"
    _available = names.some(
      n => n === _embeddingModel || n.startsWith(`${_embeddingModel}:`),
    )

    if (!_available) {
      logForDebugging(
        `[semantic-cache] Embedding model "${_embeddingModel}" not found in Ollama. ` +
          `Available: ${names.join(', ')}. Run: ollama pull ${_embeddingModel}`,
      )
    }
    return _available
  } catch {
    _available = false
    return false
  }
}

/**
 * Reset the cached availability flag (e.g., after pulling the model).
 */
export function resetEmbeddingAvailability(): void {
  _available = null
}

/**
 * Generate an embedding vector for the given text.
 * Returns null if Ollama is unavailable or the request fails.
 */
export async function generateEmbedding(
  text: string,
  baseUrl?: string,
): Promise<Float64Array | null> {
  if (!(await isEmbeddingAvailable(baseUrl))) return null

  try {
    const url = getOllamaApiBaseUrl(baseUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS)

    const resp = await fetch(`${url}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: _embeddingModel,
        prompt: text,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) {
      logForDebugging(
        `[semantic-cache] Embedding request failed: ${resp.status}`,
      )
      return null
    }

    const data = (await resp.json()) as { embedding?: number[] }
    if (!data.embedding || !Array.isArray(data.embedding)) {
      return null
    }

    return new Float64Array(data.embedding)
  } catch (e) {
    logForDebugging(`[semantic-cache] Embedding error: ${e}`)
    return null
  }
}

/**
 * Cosine similarity between two vectors. Returns 0-1 (1 = identical).
 */
export function cosineSimilarity(a: Float64Array, b: Float64Array): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

/**
 * Auto-pull the embedding model if Ollama is running but the model isn't available.
 * Fire-and-forget — doesn't block the main flow.
 */
export async function ensureEmbeddingModel(baseUrl?: string): Promise<void> {
  try {
    const url = getOllamaApiBaseUrl(baseUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    const resp = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) return

    const data = (await resp.json()) as {
      models?: Array<{ name?: string }>
    }
    const names = (data.models ?? []).map(m => m.name ?? '')
    const hasModel = names.some(
      n => n === _embeddingModel || n.startsWith(`${_embeddingModel}:`),
    )

    if (hasModel) {
      _available = true
      return
    }

    // Pull the model (non-blocking for the caller)
    logForDebugging(
      `[semantic-cache] Pulling embedding model "${_embeddingModel}"...`,
    )
    const pullResp = await fetch(`${url}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: _embeddingModel, stream: false }),
    })

    if (pullResp.ok) {
      logForDebugging(
        `[semantic-cache] Model "${_embeddingModel}" pulled successfully.`,
      )
      _available = true
    }
  } catch {
    // Ollama not running — silently skip
  }
}
