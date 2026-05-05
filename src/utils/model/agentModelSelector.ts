// Utility functions for reading and updating agentModels/agentRouting in settings.
// Used by both StartupScreen and /model command.

import { isLocalProviderUrl } from '../../services/api/providerConfig.js'
import {
  type EditableSettingSource,
  getEnabledSettingSources,
} from '../settings/constants.js'
import {
  getSettingsFilePathForSource,
  getSettingsForSource,
  updateSettingsForSource,
} from '../settings/settings.js'

export interface AgentModelOption {
  modelName: string
  baseUrl?: string
  isLocal: boolean
}

/**
 * Read the highest-priority settings source that contains agentModels
 * and return a list of available model options.
 * Returns { options, source, sourceName } or null if no agentModels found.
 */
export function getAgentModelOptions(): {
  options: AgentModelOption[]
  source: EditableSettingSource
  sourceName: string
} | null {
  const sources = getEnabledSettingSources()

  for (const source of sources) {
    // Policy and flag settings are not editable
    if (source === 'policySettings' || source === 'flagSettings') continue

    const settings = getSettingsForSource(source)
    if (!settings) continue

    const agentModels = settings.agentModels as
      | Record<string, { base_url?: string; api_key?: string }>
      | undefined

    if (!agentModels || Object.keys(agentModels).length === 0) continue

    const options: AgentModelOption[] = Object.entries(agentModels).map(
      ([name, config]) => ({
        modelName: name,
        baseUrl: config.base_url,
        isLocal: config.base_url
          ? isLocalProviderUrl(config.base_url)
          : false,
      }),
    )

    if (options.length === 0) continue

    return { options, source, sourceName: source }
  }

  return null
}

/**
 * Check if agentRouting is currently configured in settings.
 * Returns the routing default model name if found, null otherwise.
 */
export function getAgentRoutingDefault(): {
  modelName: string
  source: EditableSettingSource
} | null {
  const sources = getEnabledSettingSources()

  for (const source of sources) {
    if (source === 'policySettings' || source === 'flagSettings') continue

    const settings = getSettingsForSource(source)
    if (!settings) continue

    const routing = settings.agentRouting as
      | Record<string, string>
      | undefined
    if (!routing || Object.keys(routing).length === 0) continue

    const defaultModel =
      routing['default'] || routing['general-purpose']
    if (defaultModel) {
      return { modelName: defaultModel, source }
    }
  }

  return null
}

/**
 * Update agentRouting in settings to set the default and general-purpose
 * routes to the given model name. This mirrors what StartupScreen does.
 */
export function updateAgentRoutingDefault(
  modelName: string,
  source: EditableSettingSource,
): { error: Error | null } {
  const settings = getSettingsForSource(source)
  if (!settings) {
    return { error: new Error(`No settings found for source: ${source}`) }
  }

  const currentRouting =
    (settings.agentRouting as Record<string, string> | undefined) ?? {}

  // Update both 'default' and 'general-purpose' routes
  const newRouting: Record<string, string> = {
    ...currentRouting,
    'general-purpose': modelName,
    default: modelName,
  }

  return updateSettingsForSource(source, {
    ...settings,
    agentRouting: newRouting,
  })
}