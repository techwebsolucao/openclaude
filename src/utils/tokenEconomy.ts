import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

/**
 * Token Economy Mode
 *
 * When enabled, applies aggressive strategies to reduce token consumption:
 *
 * 1. Earlier auto-compaction: triggers at ~80% context usage instead of ~93%
 * 2. Reduced effective context window: 50% of the model's full window
 * 3. More aggressive diminishing returns detection in budget tracking
 * 4. Lower tool result limits: 20k per tool (vs 50k), 80k per message (vs 200k)
 * 5. Skips memory/skill prefetches (avoids wasted side-queries)
 * 6. Truncates user context injection (shorter context per turn)
 * 7. Reduces token estimation padding (33% → 15%)
 * 8. Lean compact prompt (no <analysis> scratchpad, shorter output budget)
 *
 * All parameters are user-configurable via tokenEconomyConfig in ~/.openclaude.json.
 * Use /config set tokenEconomyConfig.contextWindowFraction 0.6 etc.
 *
 * Can be toggled via:
 * - /token-economy command (runtime toggle)
 * - /config set tokenEconomyEnabled true (persistent)
 * - --token-economy CLI flag
 * - TOKEN_ECONOMY=1 environment variable
 */

// --- Built-in defaults (used when user hasn't overridden) ---

// Context Window
export const ECONOMY_CONTEXT_WINDOW_FRACTION = 0.50
// Auto-compact
export const ECONOMY_AUTOCOMPACT_BUFFER_TOKENS = 40_000
// Diminishing returns
export const ECONOMY_DIMINISHING_THRESHOLD = 300
export const ECONOMY_DIMINISHING_MIN_CONTINUATIONS = 2
// Tool result limits
export const ECONOMY_MAX_RESULT_SIZE_CHARS = 20_000
export const ECONOMY_MAX_TOOL_RESULTS_PER_MESSAGE_CHARS = 80_000
// User context truncation
export const ECONOMY_MAX_USER_CONTEXT_VALUE_CHARS = 2_000
// Token estimation
export const ECONOMY_TOKEN_ESTIMATION_PADDING = 1.15
// Compact output
export const ECONOMY_COMPACT_MAX_OUTPUT_TOKENS = 8_000

/**
 * Read user's economy config overrides from global config.
 */
function getUserEconomyConfig() {
  return getGlobalConfig().tokenEconomyConfig ?? {}
}

export function isTokenEconomyEnabled(): boolean {
  // Env var override
  if (isEnvTruthy(process.env.TOKEN_ECONOMY)) {
    return true
  }
  if (process.env.TOKEN_ECONOMY === '0') {
    return false
  }

  const config = getGlobalConfig()
  return config.tokenEconomyEnabled
}

/**
 * Adjust context window size for token economy mode.
 * User override: tokenEconomyConfig.contextWindowFraction (0–1)
 */
export function applyEconomyContextWindow(contextWindow: number): number {
  if (!isTokenEconomyEnabled()) {
    return contextWindow
  }
  const fraction = getUserEconomyConfig().contextWindowFraction ?? ECONOMY_CONTEXT_WINDOW_FRACTION
  return Math.floor(contextWindow * fraction)
}

/**
 * Get the autocompact buffer tokens.
 * User override: tokenEconomyConfig.autocompactBufferTokens
 */
export function getEconomyAutocompactBuffer(normalBuffer: number): number {
  if (!isTokenEconomyEnabled()) {
    return normalBuffer
  }
  return getUserEconomyConfig().autocompactBufferTokens ?? ECONOMY_AUTOCOMPACT_BUFFER_TOKENS
}

/**
 * Get the diminishing returns threshold for budget tracking.
 */
export function getEconomyDiminishingThreshold(
  normalThreshold: number,
): number {
  if (!isTokenEconomyEnabled()) {
    return normalThreshold
  }
  return ECONOMY_DIMINISHING_THRESHOLD
}

/**
 * Get the minimum continuations before checking diminishing returns.
 */
export function getEconomyDiminishingMinContinuations(
  normalMin: number,
): number {
  if (!isTokenEconomyEnabled()) {
    return normalMin
  }
  return ECONOMY_DIMINISHING_MIN_CONTINUATIONS
}

/**
 * Get the per-tool result size limit.
 * User override: tokenEconomyConfig.maxResultSizeChars
 */
export function getEconomyMaxResultSizeChars(normalMax: number): number {
  if (!isTokenEconomyEnabled()) {
    return normalMax
  }
  const limit = getUserEconomyConfig().maxResultSizeChars ?? ECONOMY_MAX_RESULT_SIZE_CHARS
  return Math.min(normalMax, limit)
}

/**
 * Get the per-message aggregate tool result budget.
 * User override: tokenEconomyConfig.maxToolResultsPerMessage
 */
export function getEconomyPerMessageBudget(normalBudget: number): number {
  if (!isTokenEconomyEnabled()) {
    return normalBudget
  }
  const limit = getUserEconomyConfig().maxToolResultsPerMessage ?? ECONOMY_MAX_TOOL_RESULTS_PER_MESSAGE_CHARS
  return Math.min(normalBudget, limit)
}

/**
 * Whether to skip memory/skill prefetches.
 * User override: tokenEconomyConfig.skipPrefetches
 */
export function shouldSkipPrefetchesForEconomy(): boolean {
  if (!isTokenEconomyEnabled()) return false
  return getUserEconomyConfig().skipPrefetches ?? true
}

/**
 * Truncate a user context value for economy mode.
 * User override: tokenEconomyConfig.maxUserContextChars
 */
export function truncateContextValueForEconomy(value: string): string {
  if (!isTokenEconomyEnabled()) {
    return value
  }
  const maxChars = getUserEconomyConfig().maxUserContextChars ?? ECONOMY_MAX_USER_CONTEXT_VALUE_CHARS
  if (value.length <= maxChars) {
    return value
  }
  return (
    value.slice(0, maxChars) +
    `\n... [truncated, ${value.length - maxChars} chars omitted for token economy]`
  )
}

/**
 * Get the token estimation padding multiplier.
 * User override: tokenEconomyConfig.tokenEstimationPadding
 */
export function getEconomyTokenEstimationPadding(normalPadding: number): number {
  if (!isTokenEconomyEnabled()) {
    return normalPadding
  }
  return getUserEconomyConfig().tokenEstimationPadding ?? ECONOMY_TOKEN_ESTIMATION_PADDING
}

/**
 * Get the compact max output tokens.
 * User override: tokenEconomyConfig.compactMaxOutputTokens
 */
export function getEconomyCompactMaxOutputTokens(): number {
  return getUserEconomyConfig().compactMaxOutputTokens ?? ECONOMY_COMPACT_MAX_OUTPUT_TOKENS
}
