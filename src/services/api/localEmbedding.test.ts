import { describe, expect, test } from 'bun:test'
import { generateLocalEmbedding, getLocalEmbeddingDim } from './localEmbedding.js'
import { cosineSimilarity } from './ollamaEmbedding.js'

describe('generateLocalEmbedding', () => {
  test('returns vector of correct dimension', () => {
    const emb = generateLocalEmbedding('Hello world')
    expect(emb.length).toBe(getLocalEmbeddingDim())
  })

  test('returns unit vector (L2 norm ≈ 1)', () => {
    const emb = generateLocalEmbedding('Test string for normalization')
    let norm = 0
    for (let i = 0; i < emb.length; i++) {
      norm += emb[i]! * emb[i]!
    }
    expect(Math.sqrt(norm)).toBeCloseTo(1.0, 5)
  })

  test('identical text produces identical embeddings', () => {
    const a = generateLocalEmbedding('How do I sort an array in JavaScript?')
    const b = generateLocalEmbedding('How do I sort an array in JavaScript?')
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10)
  })

  test('similar text produces high similarity', () => {
    const a = generateLocalEmbedding('How to sort an array in JavaScript')
    const b = generateLocalEmbedding('sort array javascript')
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0.5)
  })

  test('rephrasings have reasonable similarity', () => {
    const a = generateLocalEmbedding('How do I sort an array in JavaScript?')
    const b = generateLocalEmbedding('JavaScript array sorting methods')
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0.4) // lexical overlap still present
  })

  test('unrelated text produces low similarity', () => {
    const a = generateLocalEmbedding('How to sort an array in JavaScript')
    const b = generateLocalEmbedding('The weather in Paris is warm today')
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeLessThan(0.3)
  })

  test('handles empty string', () => {
    const emb = generateLocalEmbedding('')
    expect(emb.length).toBe(getLocalEmbeddingDim())
    // All zeros for empty input
    let sum = 0
    for (let i = 0; i < emb.length; i++) sum += Math.abs(emb[i]!)
    expect(sum).toBe(0)
  })

  test('handles unicode text', () => {
    const emb = generateLocalEmbedding('como ordenar um array em JavaScript?')
    expect(emb.length).toBe(getLocalEmbeddingDim())
    let norm = 0
    for (let i = 0; i < emb.length; i++) norm += emb[i]! * emb[i]!
    expect(Math.sqrt(norm)).toBeCloseTo(1.0, 5)
  })

  test('case insensitive: same text different case are identical', () => {
    const a = generateLocalEmbedding('Sort Array JavaScript')
    const b = generateLocalEmbedding('sort array javascript')
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10)
  })

  test('punctuation stripped: same text with/without punctuation are identical', () => {
    const a = generateLocalEmbedding('How do I sort an array?')
    const b = generateLocalEmbedding('How do I sort an array')
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.95)
  })
})
