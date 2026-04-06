import * as React from 'react'
import { existsSync } from 'node:fs'
import { Box, Text, useInput } from '../../ink.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import {
  resolveAgentProvider,
  resolveMainLoopProvider,
} from '../../services/api/agentRouting.js'
import {
  getSettingsFilePathForSource,
  getSettingsWithSources,
} from '../../utils/settings/settings.js'
import { maskSecretForDisplay } from '../../utils/providerProfile.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { getMainLoopModel } from '../../utils/model/model.js'

// Well-known agent names used in the codebase
const KNOWN_AGENTS = [
  'Plan',
  'Explore',
  'general-purpose',
  'frontend-dev',
  'default',
  'security-review',
  'research',
  'test',
]

function RoutingStatus(): React.ReactNode {
  // Always read fresh from disk (reset session-level cache)
  const { effective: settings } = getSettingsWithSources()
  const routing = settings?.agentRouting
  const models = settings?.agentModels
  const settingsFilePath = getSettingsFilePathForSource('userSettings') ?? '(unknown)'

  const mainLoopOverride = resolveMainLoopProvider(settings ?? null)
  const provider = getAPIProvider()
  const currentModel = getMainLoopModel()

  if (!routing && !models) {
    const fileExists = existsSync(settingsFilePath)
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>Agent Routing</Text>
        <Text color="yellow">No agentRouting / agentModels found in settings.json</Text>
        <Box paddingLeft={2}>
          <Text dimColor>
            Reading: <Text bold>{settingsFilePath}</Text>{' '}
            {fileExists ? <Text color="green">(exists)</Text> : <Text color="red">(file not found)</Text>}
          </Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text dimColor>
            Add to <Text bold>{settingsFilePath}</Text>:
          </Text>
          <Text dimColor>{'{'}</Text>
          <Text dimColor>{'  "agentModels": {'}</Text>
          <Text dimColor>{'    "deepseek/deepseek-chat": {'}</Text>
          <Text dimColor>{'      "base_url": "https://openrouter.ai/api/v1",'}</Text>
          <Text dimColor>{'      "api_key": "sk-or-v1-..."'}</Text>
          <Text dimColor>{'    }'}</Text>
          <Text dimColor>{'  },'}</Text>
          <Text dimColor>{'  "agentRouting": {'}</Text>
          <Text dimColor>{'    "Plan": "deepseek/deepseek-chat",'}</Text>
          <Text dimColor>{'    "default": "deepseek/deepseek-chat"'}</Text>
          <Text dimColor>{'  }'}</Text>
          <Text dimColor>{'}'}</Text>
        </Box>
      </Box>
    )
  }

  // Collect all route entries (from settings + known agents not in routing)
  const allRouteKeys = new Set([
    ...Object.keys(routing ?? {}),
    ...KNOWN_AGENTS,
  ])

  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Agent Routing</Text>

      {/* Current main loop */}
      <Box flexDirection="column">
        <Text bold>Main loop (current session)</Text>
        <Box paddingLeft={2} flexDirection="column">
          <Text>
            Provider: <Text bold>{provider}</Text>{'  '}
            Model: <Text bold>{currentModel}</Text>
          </Text>
          {mainLoopOverride ? (
            <Text color="green">
              ✓ Routed via agentRouting[
              {routing?.['general-purpose'] ? '"general-purpose"' : '"default"'}] →{' '}
              <Text bold>{mainLoopOverride.model}</Text>
              {'  '}
              <Text dimColor>{mainLoopOverride.baseURL}</Text>
            </Text>
          ) : (
            <Text dimColor>Using global provider env vars (no routing override)</Text>
          )}
        </Box>
      </Box>

      {/* agentModels registry */}
      {models && Object.keys(models).length > 0 && (
        <Box flexDirection="column">
          <Text bold>Registered models (agentModels)</Text>
          {Object.entries(models).map(([name, cfg]) => (
            <Box key={name} paddingLeft={2}>
              <Text>
                <Text bold>{name}</Text>
                {'  '}
                <Text dimColor>{cfg.base_url}</Text>
                {'  '}
                key: <Text dimColor>{maskSecretForDisplay(cfg.api_key) ?? '(empty)'}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Route resolution for each agent */}
      <Box flexDirection="column">
        <Text bold>Route resolution (agentRouting)</Text>
        {[...allRouteKeys].map(agentName => {
          const override = resolveAgentProvider(agentName, undefined, settings ?? null)
          const isInConfig = routing && agentName in routing
          return (
            <Box key={agentName} paddingLeft={2}>
              {override ? (
                <Text>
                  <Text color="green">✓</Text>{' '}
                  <Text bold>{agentName.padEnd(20)}</Text>
                  {'→ '}
                  <Text bold>{override.model}</Text>
                  {'  '}
                  <Text dimColor>{override.baseURL}</Text>
                  {'  '}
                  key: <Text dimColor>{maskSecretForDisplay(override.apiKey) ?? '(empty)'}</Text>
                </Text>
              ) : isInConfig ? (
                <Text>
                  <Text color="red">✗</Text>{' '}
                  <Text bold>{agentName.padEnd(20)}</Text>
                  <Text color="red">
                    model "{routing![agentName]}" not found in agentModels
                  </Text>
                </Text>
              ) : (
                <Text dimColor>
                  {'–'} {agentName.padEnd(20)} (no rule, uses default)
                </Text>
              )}
            </Box>
          )
        })}
      </Box>

      <Text dimColor>
        Reading: <Text bold>{settingsFilePath}</Text>.{' '}
        Restart the CLI for changes to take effect.
      </Text>
    </Box>
  )
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return <RoutingStatusWrapper onDone={onDone} />
}

function RoutingStatusWrapper({ onDone }: { onDone: LocalJSXCommandOnDone }): React.ReactNode {
  useInput((_, key) => {
    if (key.escape || key.return) {
      onDone()
    }
  })
  return (
    <Box flexDirection="column">
      <RoutingStatus />
      <Text dimColor>Press Enter or Esc to close</Text>
    </Box>
  )
}
