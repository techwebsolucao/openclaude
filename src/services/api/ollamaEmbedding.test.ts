import { describe, expect, test } from 'bun:test'
import {
    cosineSimilarity,
} from './ollamaEmbedding.js'

describe('cosineSimilarity', () => {
  test('identical vectors return 1', () => {
    const a = new Float64Array([1, 2, 3])
    const b = new Float64Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10)
  })

  test('orthogonal vectors return 0', () => {
    const a = new Float64Array([1, 0, 0])
    const b = new Float64Array([0, 1, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10)
  })

  test('opposite vectors return -1', () => {
    const a = new Float64Array([1, 0, 0])
    const b = new Float64Array([-1, 0, 0])
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10)
  })

  test('empty vectors return 0', () => {
    const a = new Float64Array([])
    const b = new Float64Array([])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  test('mismatched lengths return 0', () => {
    const a = new Float64Array([1, 2])
    const b = new Float64Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })

  test('similar vectors yield high similarity', () => {
    const a = new Float64Array([1, 2, 3, 4, 5])
    const b = new Float64Array([1.1, 2.05, 2.95, 4.1, 4.9])
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99)
  })

  test('dissimilar vectors yield low similarity', () => {
    const a = new Float64Array([1, 0, 0, 0, 0])
    const b = new Float64Array([0, 0, 0, 0, 1])
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10)
  })

  test('zero vector returns 0', () => {
    const a = new Float64Array([0, 0, 0])
    const b = new Float64Array([1, 2, 3])
    expect(cosineSimilarity(a, b)).toBe(0)
  })
})
