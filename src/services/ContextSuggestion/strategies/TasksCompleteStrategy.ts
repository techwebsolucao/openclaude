/**
 * TasksCompleteStrategy
 *
 * Suggests clearing context when the assistant has finished responding
 * and there are no pending tool calls — i.e. the task queue is effectively
 * empty and the conversation has reached a natural break point.
 *
 * Single Responsibility: one heuristic rule per strategy.
 * Open/Closed: add new strategies without touching existing ones.
 */

import type { AppState } from '../../../state/AppState.js'
import type { Message } from '../../../types/message.js'
import { hasToolCallsInLastAssistantTurn } from '../../../utils/messages.js'
import type {
    ContextSuggestion,
    ContextSuggestionStrategy,
} from '../types.js'

const MIN_ASSISTANT_TURNS = 3
const CLEAR_SUGGESTION = '/clear to start a new context'

export class TasksCompleteStrategy implements ContextSuggestionStrategy {
  evaluate(messages: Message[], appState: AppState): ContextSuggestion | null {
    if (this.hasPendingWork(appState)) return null
    if (!this.hasEnoughConversation(messages)) return null
    if (hasToolCallsInLastAssistantTurn(messages)) return null
    if (this.hasRunningTasks(appState)) return null

    return { text: CLEAR_SUGGESTION, reason: 'tasks_complete' }
  }

  private hasPendingWork(appState: AppState): boolean {
    return !!(
      appState.pendingWorkerRequest ||
      appState.pendingSandboxRequest ||
      appState.elicitation.queue.length > 0
    )
  }

  private hasEnoughConversation(messages: Message[]): boolean {
    let count = 0
    for (const msg of messages) {
      if (msg.type === 'assistant') count++
    }
    return count >= MIN_ASSISTANT_TURNS
  }

  private hasRunningTasks(appState: AppState): boolean {
    return Object.values(appState.tasks).some(task => {
      const t = task as { status?: string }
      return t.status === 'running'
    })
  }
}
