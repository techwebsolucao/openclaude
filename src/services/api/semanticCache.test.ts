import { describe, expect, test } from 'bun:test'
import { buildCacheQueryText, wordJaccard } from './semanticCache.js'

describe('buildCacheQueryText', () => {
  test('extracts last user message string', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'How do I sort an array in JavaScript?' },
    ]
    const result = buildCacheQueryText(messages, 'llama3.2')
    expect(result).toBe('How do I sort an array in JavaScript?')
  })

  test('extracts text from content blocks', () => {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Explain closures' },
          { type: 'image', source: { type: 'base64', data: 'abc' } },
        ],
      },
    ]
    const result = buildCacheQueryText(messages, 'gpt-4o')
    expect(result).toBe('Explain closures')
  })

  test('returns empty for no user messages', () => {
    const messages = [
      { role: 'assistant', content: 'Hello' },
    ]
    expect(buildCacheQueryText(messages, 'model')).toBe('')
  })

  test('truncates long content', () => {
    const longText = 'a'.repeat(5000)
    const messages = [{ role: 'user', content: longText }]
    const result = buildCacheQueryText(messages, 'model')
    expect(result.length).toBe(2000)
  })
})

describe('wordJaccard', () => {
  test('identical queries return 1', () => {
    expect(wordJaccard(
      'qual versão do meu laravel',
      'qual versão do meu laravel',
    )).toBe(1)
  })

  test('same-topic different-question returns low overlap', () => {
    // This is the exact bug scenario: "what version of my laravel"
    // vs "does my laravel use MVC pattern" should NOT match
    const overlap = wordJaccard(
      'qual versão do meu laravel',
      'no meu laravel ele tem padrão mvc',
    )
    // Only "laravel" overlaps after stopword removal → very low Jaccard
    expect(overlap).toBeLessThan(0.35)
  })

  test('similar questions return high overlap', () => {
    const overlap = wordJaccard(
      'qual versão do meu laravel',
      'qual é a versão do laravel',
    )
    expect(overlap).toBeGreaterThanOrEqual(0.35)
  })

  test('completely different queries return 0', () => {
    expect(wordJaccard(
      'how to sort an array in javascript',
      'como fazer deploy no docker',
    )).toBe(0)
  })

  test('both empty returns 1', () => {
    expect(wordJaccard('', '')).toBe(1)
  })

  test('one empty returns 0', () => {
    expect(wordJaccard('hello world', '')).toBe(0)
  })
})
