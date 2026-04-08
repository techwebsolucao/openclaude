
/**
 * Local Embedding — zero dependencies, runs 100% on CPU.
 *
 * Generates a fixed-dimension embedding vector from text using:
 * 1. Text normalization (lowercase, strip punctuation, collapse whitespace)
 * 2. Word + character n-gram extraction (unigrams, bigrams, trigrams)
 * 3. Feature hashing into a fixed 256-dimensional vector
 * 4. L2 normalization (unit vector for cosine similarity)
 *
 * This is NOT a neural embedding — it captures lexical/structural similarity,
 * not deep semantic meaning. But for catching rephrasings of the same question
 * ("how to sort array js" vs "sort an array in javascript") it works well
 * with a threshold of ~0.85.
 *
 * Performance: <1ms per embedding, zero RAM overhead, no model needed.
 */

const EMBEDDING_DIM = 256

/**
 * Normalize text for embedding: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')  // strip punctuation (Unicode-aware)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract word tokens from normalized text.
 */
function tokenize(text: string): string[] {
  return text.split(' ').filter(w => w.length > 0)
}

/**
 * Deterministic hash of a string to an index in [0, dim).
 * Uses FNV-1a for speed — no crypto overhead.
 */
function hashToIndex(s: string, dim: number): number {
  let h = 0x811c9dc5 | 0 // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) // FNV prime
  }
  return ((h >>> 0) % dim)
}

/**
 * Deterministic sign from a string (+1 or -1).
 * Uses a different seed to avoid correlation with hashToIndex.
 */
function hashToSign(s: string): number {
  let h = 0x6c62272e | 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x5f356495)
  }
  return (h >>> 0) % 2 === 0 ? 1 : -1
}

/**
 * Extract all n-gram features from text.
 * Returns word unigrams, bigrams, trigrams + character trigrams.
 */
function extractFeatures(text: string): string[] {
  const normalized = normalize(text)
  const words = tokenize(normalized)
  const features: string[] = []

  // Word unigrams (weight: 1x)
  for (const w of words) {
    features.push(`w:${w}`)
  }

  // Word bigrams (weight: 1x — captures phrase structure)
  for (let i = 0; i < words.length - 1; i++) {
    features.push(`b:${words[i]}|${words[i + 1]}`)
  }

  // Word trigrams (weight: 1x)
  for (let i = 0; i < words.length - 2; i++) {
    features.push(`t:${words[i]}|${words[i + 1]}|${words[i + 2]}`)
  }

  // Character trigrams from original normalized text (catches typos/morphology)
  for (let i = 0; i < normalized.length - 2; i++) {
    features.push(`c:${normalized.slice(i, i + 3)}`)
  }

  return features
}

/**
 * Generate a local embedding vector for the given text.
 * Always succeeds — no external dependencies.
 *
 * Uses feature hashing (random projection) to map n-gram features
 * into a fixed-dimension vector, then L2-normalizes.
 */
export function generateLocalEmbedding(text: string): Float64Array {
  const features = extractFeatures(text)
  const vec = new Float64Array(EMBEDDING_DIM)

  // Feature hashing: each feature votes +1 or -1 at its hashed bucket
  for (const f of features) {
    const idx = hashToIndex(f, EMBEDDING_DIM)
    const sign = hashToSign(f)
    vec[idx] += sign
  }

  // L2 normalization (unit vector for cosine similarity)
  let norm = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i]! * vec[i]!
  }
  norm = Math.sqrt(norm)
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vec[i] /= norm
    }
  }

  return vec
}

/**
 * Check if local embedding is available — always true (no deps).
 */
export function isLocalEmbeddingAvailable(): boolean {
  return true
}

/**
 * Get the embedding dimension.
 */
export function getLocalEmbeddingDim(): number {
  return EMBEDDING_DIM
}
