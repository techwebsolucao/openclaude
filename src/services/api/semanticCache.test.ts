import { describe, expect, test } from 'bun:test'
import { buildCacheQueryText } from './semanticCache.js'

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
