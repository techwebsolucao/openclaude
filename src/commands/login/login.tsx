import { feature } from 'bun:bundle'
import * as React from 'react'
import { useState } from 'react'

import { resetCostState } from '../../bootstrap/state.js'
import {
  clearTrustedDeviceToken,
  enrollTrustedDevice,
} from '../../bridge/trustedDevice.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { ConfigurableShortcutHint } from '../../components/ConfigurableShortcutHint.js'
import {
  ConsoleOAuthFlow,
  type ConsoleOAuthFlowResult,
} from '../../components/ConsoleOAuthFlow.js'
import { OpenRouterSetup } from '../../components/OpenRouterSetup.js'
import { Select } from '../../components/CustomSelect/select.js'
import { Dialog } from '../../components/design-system/Dialog.js'
import { useMainLoopModel } from '../../hooks/useMainLoopModel.js'
import { Box, Text } from '../../ink.js'
import { refreshGrowthBookAfterAuthChange } from '../../services/analytics/growthbook.js'
import { refreshPolicyLimits } from '../../services/policyLimits/index.js'
import { refreshRemoteManagedSettings } from '../../services/remoteManagedSettings/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { stripSignatureBlocks } from '../../utils/messages.js'
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js'
import {
  checkAndDisableAutoModeIfNeeded,
  checkAndDisableBypassPermissionsIfNeeded,
  resetAutoModeGateCheck,
  resetBypassPermissionsCheck,
} from '../../utils/permissions/bypassPermissionsKillswitch.js'
import { resetUserCache } from '../../utils/user.js'

type ProviderChoice = 'openrouter' | 'anthropic'

type LoginCompletion =
  | ConsoleOAuthFlowResult
  | {
      type: 'cancel'
    }

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  return (
    <Login
      onDone={async result => {
        if (result.type === 'cancel') {
          onDone('Login interrupted')
          return
        }

        if (result.type === 'provider-setup') {
          onDone(result.message, { display: 'system' })
          return
        }

        context.onChangeAPIKey()
        // Signature-bearing blocks (thinking, connector_text) are bound to the
        // API key. Strip them so the new key doesn't reject stale signatures.
        context.setMessages(stripSignatureBlocks)

        // Post-login refresh logic. Keep in sync with onboarding in
        // src/interactiveHelpers.tsx.
        resetCostState()
        void refreshRemoteManagedSettings()
        void refreshPolicyLimits()
        resetUserCache()
        refreshGrowthBookAfterAuthChange()

        // Re-apply env vars from settings (including .claude/settings.json provider
        // config) so any changes since startup are picked up, and the active
        // provider profile is re-applied with the new credentials.
        applyConfigEnvironmentVariables()

        // Clear any stale trusted device token from a previous account before
        // re-enrolling to avoid sending the old token while enrollment is
        // in flight.
        clearTrustedDeviceToken()
        void enrollTrustedDevice()

        resetBypassPermissionsCheck()
        const appState = context.getAppState()
        void checkAndDisableBypassPermissionsIfNeeded(
          appState.toolPermissionContext,
          context.setAppState,
        )

        if (feature('TRANSCRIPT_CLASSIFIER')) {
          resetAutoModeGateCheck()
          void checkAndDisableAutoModeIfNeeded(
            appState.toolPermissionContext,
            context.setAppState,
            appState.fastMode,
          )
        }

        context.setAppState(prev => ({
          ...prev,
          authVersion: prev.authVersion + 1,
        }))

        onDone('Login successful')
      }}
    />
  )
}

export function Login(props: {
  onDone: (result: LoginCompletion, mainLoopModel: string) => void
  startingMessage?: string
}): React.ReactNode {
  const mainLoopModel = useMainLoopModel()
  const [choice, setChoice] = useState<ProviderChoice | null>(null)

  return (
    <Dialog
      title="Login"
      onCancel={() => props.onDone({ type: 'cancel' }, mainLoopModel)}
      color="permission"
      inputGuide={exitState =>
        exitState.pending ? (
          <Text>Press {exitState.keyName} again to exit</Text>
        ) : (
          <ConfigurableShortcutHint
            action="confirm:no"
            context="Confirmation"
            fallback="Esc"
            description="cancel"
          />
        )
      }
    >
      {choice === 'anthropic' && (
        <ConsoleOAuthFlow
          onDone={result =>
            props.onDone(result ?? { type: 'cancel' }, mainLoopModel)
          }
          startingMessage={props.startingMessage}
        />
      )}
      {choice === 'openrouter' && (
        <OpenRouterSetup
          onDone={() =>
            props.onDone(
              { type: 'provider-setup', message: 'OpenRouter configured successfully' },
              mainLoopModel,
            )
          }
        />
      )}
      {!choice && (
        <Box flexDirection="column" gap={1} paddingLeft={1}>
          <Text bold>How do you want to connect?</Text>
          <Select
            options={[
              { label: 'OpenRouter  · use any model with one API key', value: 'openrouter' },
              { label: 'OpenClaude / direct API key', value: 'anthropic' },
            ]}
            onChange={v => setChoice(v as ProviderChoice)}
          />
        </Box>
      )}
    </Dialog>
  )
}
