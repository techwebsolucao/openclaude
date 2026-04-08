/**
 * SessionMemory Attachment Provider
 *
 * Encapsulates the logic for injecting session memory as a context
 * attachment on the first turn of a session.
 *
 * Single Responsibility: session memory → attachment conversion.
 * Dependency Inversion: depends on abstractions (getSessionMemoryContent,
 * getSessionMemoryPath) rather than filesystem details.
 */

import { logForDebugging } from '../../utils/debug.js'
import { getSessionMemoryPath } from '../../utils/permissions/filesystem.js'
import { logEvent } from '../analytics/index.js'
import { roughTokenCountEstimation } from '../tokenEstimation.js'
import { getSessionMemoryContent } from './sessionMemoryUtils.js'

// ---------------------------------------------------------------------------
// State — flag-gated to first turn per session
// ---------------------------------------------------------------------------

let injected = false

export function resetSessionMemoryInjection(): void {
  injected = false
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SessionMemoryAttachment {
  type: 'current_session_memory'
  content: string
  path: string
  tokenCount: number
}

export async function getSessionMemoryAttachment(): Promise<SessionMemoryAttachment[]> {
  if (injected) {
    logForDebugging('session-memory-attachment: already injected, skipping')
    return []
  }

  try {
    const memoryPath = getSessionMemoryPath()
    logForDebugging(`session-memory-attachment: reading from ${memoryPath}`)

    const content = await getSessionMemoryContent()
    if (!content || content.trim().length === 0) {
      logForDebugging('session-memory-attachment: no content found (file missing or empty)')
      return []
    }

    const tokenCount = roughTokenCountEstimation(content)

    injected = true

    logForDebugging(`session-memory-attachment: injected ${tokenCount} tokens`)
    logEvent('tengu_session_memory_attachment_injected', {
      token_count: tokenCount,
      content_length: content.length,
    })

    return [
      {
        type: 'current_session_memory',
        content,
        path: memoryPath,
        tokenCount,
      },
    ]
  } catch (e) {
    logForDebugging(`session-memory-attachment: error - ${e}`)
    return []
  }
}
