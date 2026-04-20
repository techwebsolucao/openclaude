import { saveGlobalConfig } from '../../utils/config.js'
import { isTokenEconomyEnabled } from '../../utils/tokenEconomy.js'

export const call: import('../../types/command.js').LocalJSXCommandCall =
  async (onDone, _context, args) => {
    const trimmed = args.trim().toLowerCase()

    if (trimmed === '' || trimmed === 'status') {
      const enabled = isTokenEconomyEnabled()
      const envOverride = process.env.TOKEN_ECONOMY
      let msg = `Token economy mode: ${enabled ? 'ON' : 'OFF'}`
      if (envOverride) msg += ` (env: TOKEN_ECONOMY=${envOverride})`
      if (enabled) msg += '\n  Effect: minimal system prompt (~500 tokens instead of ~28k)'
      onDone(msg)
      return null
    }

    if (trimmed === 'on' || trimmed === 'off') {
      const enable = trimmed === 'on'
      saveGlobalConfig(current => ({ ...current, tokenEconomyEnabled: enable }))
      onDone(
        enable
          ? 'Token economy mode ON — minimal system prompt will be used'
          : 'Token economy mode OFF — standard system prompt will be used',
      )
      return null
    }

    onDone('Usage: /token-economy [on|off|status]')
    return null
  }

