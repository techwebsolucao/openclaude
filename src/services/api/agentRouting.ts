import type { SettingsJson } from '../../utils/settings/types.js'

export interface ProviderOverride {
  model: string
  baseURL: string
  apiKey: string
}

function normalize(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, '')
}

function getNormalizedRouting(routing: Record<string, string>): Map<string, string> {
  const normalizedRouting = new Map<string, string>()
  for (const [key, value] of Object.entries(routing)) {
    const nk = normalize(key)
    if (!normalizedRouting.has(nk)) {
      normalizedRouting.set(nk, value)
    }
  }
  return normalizedRouting
}

export function resolveAgentProvider(
  name: string | undefined,
  subagentType: string | undefined,
  settings: SettingsJson | null,
): ProviderOverride | null {
  if (!settings) return null

  const routing = settings.agentRouting
  const models = settings.agentModels
  if (!routing || !models) return null

  const normalizedRouting = getNormalizedRouting(routing)

  const candidates = [name, subagentType, 'default'].filter(Boolean) as string[]
  let modelName: string | undefined

  for (const candidate of candidates) {
    const match = normalizedRouting.get(normalize(candidate))
    if (match) {
      modelName = match
      break
    }
  }

  if (!modelName) return null

  const modelConfig = models[modelName]
  if (!modelConfig) return null

  return {
    model: modelName,
    baseURL: modelConfig.base_url,
    apiKey: modelConfig.api_key,
  }
}

export function resolveMainLoopProvider(
  settings: SettingsJson | null,
  mode?: string,
): ProviderOverride | null {
  if (!settings) return null

  const routing = settings.agentRouting
  const models = settings.agentModels
  if (!routing || !models) return null

  const normalizedRouting = getNormalizedRouting(routing)

  const candidates = [
    mode === 'plan' ? 'Plan' : undefined,
    'general-purpose',
    'default',
  ].filter(Boolean) as string[]

  let modelName: string | undefined
  for (const candidate of candidates) {
    const match = normalizedRouting.get(normalize(candidate))
    if (match) {
      modelName = match
      break
    }
  }

  if (!modelName) return null

  const modelConfig = models[modelName]
  if (!modelConfig) return null

  return {
    model: modelName,
    baseURL: modelConfig.base_url,
    apiKey: modelConfig.api_key,
  }
}
