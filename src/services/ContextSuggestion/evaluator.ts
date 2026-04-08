/**
 * ContextSuggestionEvaluator (Chain of Responsibility)
 *
 * Iterates registered strategies in priority order and returns the
 * first non-null suggestion. New strategies are added to the default
 * list — existing strategies are never modified (Open/Closed).
 */

import type { AppState } from '../../state/AppState.js'
import type { Message } from '../../types/message.js'
import { TasksCompleteStrategy } from './strategies/TasksCompleteStrategy.js'
import type { ContextSuggestion, ContextSuggestionStrategy } from './types.js'

export class ContextSuggestionEvaluator {
  private readonly strategies: ContextSuggestionStrategy[]

  constructor(strategies?: ContextSuggestionStrategy[]) {
    this.strategies = strategies ?? [new TasksCompleteStrategy()]
  }

  evaluate(messages: Message[], appState: AppState): ContextSuggestion | null {
    for (const strategy of this.strategies) {
      const suggestion = strategy.evaluate(messages, appState)
      if (suggestion) return suggestion
    }
    return null
  }
}
