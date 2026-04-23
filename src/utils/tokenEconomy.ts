import { getGlobalConfig } from './config.js'
import { isEnvTruthy } from './envUtils.js'

/**
 * Token Economy Mode
 *
 * When enabled, replaces the system prompt with a minimal version to reduce
 * token consumption on every message.
 *
 * Can be toggled via:
 * - /token-economy command (runtime toggle)
 * - /config set tokenEconomyEnabled true (persistent)
 * - --token-economy CLI flag
 * - TOKEN_ECONOMY=1 environment variable
 */

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

export function getTokenEconomyConfig() {
  const config = getGlobalConfig()
  return config.tokenEconomyConfig
}

export function getTokenEconomyContextWindowFraction(): number {
  return getTokenEconomyConfig()?.contextWindowFraction ?? 0.5
}

export function getTokenEconomyAutocompactBufferTokens(): number | undefined {
  return getTokenEconomyConfig()?.autocompactBufferTokens
}

export function getTokenEconomyCompactMaxOutputTokens(): number | undefined {
  return getTokenEconomyConfig()?.compactMaxOutputTokens
}

export function getTokenEconomyMaxResultSizeChars(): number | undefined {
  return getTokenEconomyConfig()?.maxResultSizeChars
}

export function getTokenEconomyMaxToolResultsPerMessage(): number | undefined {
  return getTokenEconomyConfig()?.maxToolResultsPerMessage
}

export function getTokenEconomyTokenEstimationPadding(): number | undefined {
  return getTokenEconomyConfig()?.tokenEstimationPadding
}

export function getTokenEconomySkipPrefetches(): boolean | undefined {
  return getTokenEconomyConfig()?.skipPrefetches
}

export function getTokenEconomySkipMemoryInstructions(): boolean | undefined {
  const value = getTokenEconomyConfig()?.skipMemoryInstructions
  if (value === undefined && isTokenEconomyEnabled()) {
    return true
  }
  return value
}

export function getTokenEconomyMaxUserContextChars(): number | undefined {
  return getTokenEconomyConfig()?.maxUserContextChars
}
