/**
 * ContextStatus — Runtime context & token usage display
 *
 * Generates a Gemini CLI-style status line showing model, context window
 * usage, and session-level token totals after each assistant turn.
 *
 * Single Responsibility: formatting the context status string.
 * Dependency Inversion: receives raw data, returns formatted text.
 */

import { randomUUID } from 'crypto'
import { getLastInputTokens, getSdkBetas, getTotalInputTokens, getTotalOutputTokens } from '../../bootstrap/state.js'
import { getTotalCost } from '../../cost-tracker.js'
import type { Message } from '../../types/message.js'
import {
    calculateContextPercentages,
    getContextWindowForModel,
} from '../../utils/context.js'
import { formatTokens } from '../../utils/format.js'
import { renderModelName, type ModelName } from '../../utils/model/model.js'
import { getCurrentUsage } from '../../utils/tokens.js'

// ---------------------------------------------------------------------------
// Unicode progress bar (same blocks as ProgressBar.tsx)
// ---------------------------------------------------------------------------

const FILLED = '▰'
const EMPTY  = '▱'
const BAR_WIDTH = 10

function renderProgressBar(ratio: number): string {
  const clamped = Math.min(1, Math.max(0, ratio))
  const filled = Math.round(clamped * BAR_WIDTH)
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ContextStatusData {
  modelDisplay: string
  contextBar: string
  usedTokens: string
  contextWindow: string
  usedPercent: number
  totalSessionInput: string
  totalSessionOutput: string
  totalCostUsd: number | null
}

export function buildContextStatus(
  messages: Message[],
  model: ModelName,
): ContextStatusData | null {
  const betas = getSdkBetas()
  const contextWindowSize = getContextWindowForModel(model, betas)
  const usage = getCurrentUsage(messages)

  // For OpenAI-compatible providers (e.g. OpenRouter / DeepSeek), the assistant
  // message may have usage={0,0,0,0} at render time because the usage chunk
  // arrives after content_block_stop.
  //
  // Fallback chain for context-window token count:
  //   1. Last message usage (best — includes cache tokens)
  //   2. getLastInputTokens() (per-turn input tracked by cost-tracker)
  //   3. Skip display (no usable signal)
  //
  // NOTE: getTotalInputTokens() (session cumulative) is NEVER used for the
  // context bar — it sums ALL turns and vastly over-reports context fill.
  const sessionInput = getTotalInputTokens()
  const sessionOutput = getTotalOutputTokens()
  const lastInput = getLastInputTokens()

  const hasMessageUsage = usage !== null && (
    usage.input_tokens > 0 ||
    usage.cache_creation_input_tokens > 0 ||
    usage.cache_read_input_tokens > 0
  )
  const hasLastInput = lastInput > 0

  if (!hasMessageUsage && !hasLastInput) return null

  const totalInput = hasMessageUsage
    ? usage!.input_tokens + usage!.cache_creation_input_tokens + usage!.cache_read_input_tokens
    : lastInput

  const syntheticUsage = {
    input_tokens: totalInput,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  }
  const percentages = calculateContextPercentages(syntheticUsage, contextWindowSize)
  const usedPercent = percentages.used ?? 0

  const totalCost = getTotalCost()

  return {
    modelDisplay: renderModelName(model),
    contextBar: renderProgressBar(usedPercent / 100),
    usedTokens: formatTokens(totalInput),
    contextWindow: formatTokens(contextWindowSize),
    usedPercent,
    totalSessionInput: formatTokens(sessionInput),
    totalSessionOutput: formatTokens(sessionOutput),
    totalCostUsd: totalCost > 0 ? totalCost : null,
  }
}

/**
 * Formats the context status as a single-line string suitable for
 * display as a dim system message.
 *
 * Example output:
 *   Claude Sonnet 4 · ▰▰▰▰▱▱▱▱▱▱ 42k/200k (21%) · Session: ↓156k ↑12k · $0.12
 */
export function formatContextStatusLine(data: ContextStatusData): string {
  const parts: string[] = [
    data.modelDisplay,
    `${data.contextBar} ${data.usedTokens}/${data.contextWindow} (${data.usedPercent}%)`,
    `Session: ↓${data.totalSessionInput} ↑${data.totalSessionOutput}`,
  ]

  if (data.totalCostUsd !== null) {
    parts.push(`$${data.totalCostUsd.toFixed(2)}`)
  }

  return parts.join(' · ')
}

/**
 * Creates a system message with subtype 'context_status' that bypasses the
 * info-level filter in SystemTextMessage, rendering as a dimmed line with ✽.
 */
export function createContextStatusMessage(content: string) {
  return {
    type: 'system' as const,
    subtype: 'context_status' as const,
    content,
    isMeta: false as const,
    timestamp: new Date().toISOString(),
    uuid: randomUUID(),
    level: 'info' as const,
  }
}
