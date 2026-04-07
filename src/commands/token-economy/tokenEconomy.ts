import { getResponseCacheStats } from '../../services/api/responseCache.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import {
    ECONOMY_AUTOCOMPACT_BUFFER_TOKENS,
    ECONOMY_COMPACT_MAX_OUTPUT_TOKENS,
    ECONOMY_CONTEXT_WINDOW_FRACTION,
    ECONOMY_DIMINISHING_THRESHOLD,
    ECONOMY_MAX_RESULT_SIZE_CHARS,
    ECONOMY_MAX_TOOL_RESULTS_PER_MESSAGE_CHARS,
    ECONOMY_MAX_USER_CONTEXT_VALUE_CHARS,
    ECONOMY_TOKEN_ESTIMATION_PADDING,
    isTokenEconomyEnabled,
} from '../../utils/tokenEconomy.js'

/** Format a value, showing user override when different from default. */
function fmt(val: number | boolean, def: number | boolean, unit = ''): string {
  const vStr = typeof val === 'number' ? val.toLocaleString() : String(val)
  if (val !== def) return `${vStr}${unit} (custom, default: ${typeof def === 'number' ? def.toLocaleString() : def}${unit})`
  return `${vStr}${unit}`
}

export const call: import('../../types/command.js').LocalJSXCommandCall =
  async (onDone, _context, args) => {
    const trimmed = args.trim().toLowerCase()

    // Show status
    if (trimmed === '' || trimmed === 'status') {
      const enabled = isTokenEconomyEnabled()
      const envOverride = process.env.TOKEN_ECONOMY
      const cfg = getGlobalConfig().tokenEconomyConfig ?? {}
      let statusMsg = `Token economy mode: ${enabled ? 'ON' : 'OFF'}`
      if (envOverride) {
        statusMsg += ` (env: TOKEN_ECONOMY=${envOverride})`
      }
      if (enabled) {
        const cwf = cfg.contextWindowFraction ?? ECONOMY_CONTEXT_WINDOW_FRACTION
        const acb = cfg.autocompactBufferTokens ?? ECONOMY_AUTOCOMPACT_BUFFER_TOKENS
        const mrs = cfg.maxResultSizeChars ?? ECONOMY_MAX_RESULT_SIZE_CHARS
        const mtr = cfg.maxToolResultsPerMessage ?? ECONOMY_MAX_TOOL_RESULTS_PER_MESSAGE_CHARS
        const muc = cfg.maxUserContextChars ?? ECONOMY_MAX_USER_CONTEXT_VALUE_CHARS
        const tep = cfg.tokenEstimationPadding ?? ECONOMY_TOKEN_ESTIMATION_PADDING
        const sp = cfg.skipPrefetches ?? true
        const cmo = cfg.compactMaxOutputTokens ?? ECONOMY_COMPACT_MAX_OUTPUT_TOKENS

        statusMsg += `\n\n  Context & Compaction:`
        statusMsg += `\n  • Context window → ${fmt(Math.round(cwf * 100), Math.round(ECONOMY_CONTEXT_WINDOW_FRACTION * 100), '%')} of normal`
        statusMsg += `\n  • Auto-compact buffer: ${fmt(acb, ECONOMY_AUTOCOMPACT_BUFFER_TOKENS, ' tokens')}`
        statusMsg += `\n  • Diminishing returns: ${ECONOMY_DIMINISHING_THRESHOLD} tokens (after 2 continuations)`
        statusMsg += `\n  • Compact output budget: ${fmt(cmo, ECONOMY_COMPACT_MAX_OUTPUT_TOKENS, ' tokens')}`
        statusMsg += `\n\n  Tool Results:`
        statusMsg += `\n  • Per-tool max: ${fmt(mrs, ECONOMY_MAX_RESULT_SIZE_CHARS, ' chars')} (vs 50k normal)`
        statusMsg += `\n  • Per-message max: ${fmt(mtr, ECONOMY_MAX_TOOL_RESULTS_PER_MESSAGE_CHARS, ' chars')} (vs 200k normal)`
        statusMsg += `\n\n  Context Injection:`
        statusMsg += `\n  • User context truncated at ${fmt(muc, ECONOMY_MAX_USER_CONTEXT_VALUE_CHARS, ' chars')}`
        statusMsg += `\n  • Memory/skill prefetches: ${sp ? 'SKIPPED' : 'enabled'} ${sp !== true ? '(custom)' : ''}`
        statusMsg += `\n  • Memory instructions: ${cfg.skipMemoryInstructions ? 'SKIPPED (saves ~1.5k tokens)' : 'included'}`
        statusMsg += `\n  • Tool descriptions: capped at 1200 chars (saves ~5-8k tokens)`
        statusMsg += `\n  • Token estimation padding: ${fmt(Math.round(tep * 100 - 100), Math.round(ECONOMY_TOKEN_ESTIMATION_PADDING * 100 - 100), '%')} (vs 33% normal)`
        const cacheStats = getResponseCacheStats()
        statusMsg += `\n\n  Response Cache: ${cacheStats.size} entries, ${cacheStats.totalHits} hits`
        statusMsg += `\n\n  Customize via: /config set tokenEconomyConfig.contextWindowFraction 0.6`
      }
      onDone(statusMsg)
      return null
    }

    // Toggle
    if (trimmed === 'on' || trimmed === 'off') {
      const enable = trimmed === 'on'
      saveGlobalConfig(current => ({
        ...current,
        tokenEconomyEnabled: enable,
      }))

      if (enable) {
        const cwf = (getGlobalConfig().tokenEconomyConfig?.contextWindowFraction ?? ECONOMY_CONTEXT_WINDOW_FRACTION)
        const acb = (getGlobalConfig().tokenEconomyConfig?.autocompactBufferTokens ?? ECONOMY_AUTOCOMPACT_BUFFER_TOKENS)
        onDone(
          `Token economy mode ON\n` +
            `  • Context window → ${Math.round(cwf * 100)}% of normal\n` +
            `  • Compaction triggers earlier (buffer: ${acb.toLocaleString()} tokens)\n` +
            `  • Lean compact prompt (no analysis scratchpad)\n` +
            `  • Aggressive diminishing-returns detection\n` +
            `  Customize: /config set tokenEconomyConfig.contextWindowFraction 0.6`,
        )
      } else {
        onDone('Token economy mode OFF — using standard context and compaction settings')
      }
      return null
    }

    onDone('Usage: /token-economy [on|off|status]')
    return null
  }
