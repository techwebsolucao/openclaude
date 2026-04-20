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

