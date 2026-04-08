/**
 * ContextSuggestion — Domain types
 *
 * Single Responsibility: type definitions only, no logic.
 */

import type { AppState } from '../../state/AppState.js'
import type { Message } from '../../types/message.js'

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export type ContextSuggestionReason =
  | 'tasks_complete'
  | 'long_conversation'
  | 'none'

export interface ContextSuggestion {
  text: string
  /** Reason key used for analytics / diagnostics */
  reason: ContextSuggestionReason
}

// ---------------------------------------------------------------------------
// Strategy interface (ISP — callers depend only on `evaluate`)
// ---------------------------------------------------------------------------

export interface ContextSuggestionStrategy {
  evaluate(messages: Message[], appState: AppState): ContextSuggestion | null
}
