import React, { useState, useCallback } from 'react'
import { Box, Text, Link } from '../ink.js'
import { Select } from './CustomSelect/select.js'
import TextInput from './TextInput.js'
import { useTerminalSize } from '../hooks/useTerminalSize.js'
import {
  createProfileFile,
  saveProfileFile,
} from '../utils/providerProfile.js'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const POPULAR_MODELS: Array<{ label: string; value: string }> = [
  { label: 'deepseek/deepseek-chat  · fastest & cheap', value: 'deepseek/deepseek-chat' },
  { label: 'openai/gpt-4o-mini  · light & fast', value: 'openai/gpt-4o-mini' },
  { label: 'openai/gpt-4o', value: 'openai/gpt-4o' },
  { label: 'anthropic/claude-3.5-sonnet', value: 'anthropic/claude-3.5-sonnet' },
  { label: 'anthropic/claude-3-haiku  · cheap', value: 'anthropic/claude-3-haiku' },
  { label: 'google/gemini-flash-1.5  · cheap', value: 'google/gemini-flash-1.5' },
  { label: 'meta-llama/llama-3.1-8b-instruct:free  · free', value: 'meta-llama/llama-3.1-8b-instruct:free' },
  { label: 'qwen/qwen-2.5-72b-instruct', value: 'qwen/qwen-2.5-72b-instruct' },
  { label: 'Custom model name…', value: '__custom__' },
]

type Step = 'api-key' | 'model' | 'custom-model'

type Props = {
  onDone(): void
}

export function OpenRouterSetup({ onDone }: Props): React.ReactNode {
  const { columns } = useTerminalSize()
  const [step, setStep] = useState<Step>('api-key')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [apiKeyCursorOffset, setApiKeyCursorOffset] = useState(0)
  const [customModel, setCustomModel] = useState('')
  const [customModelCursorOffset, setCustomModelCursorOffset] = useState(0)
  const [customModelError, setCustomModelError] = useState<string | null>(null)

  const inputColumns = Math.max(40, columns - 6)

  const finishSetup = useCallback(
    (key: string, model: string) => {
      process.env.CLAUDE_CODE_USE_OPENAI = '1'
      process.env.OPENAI_BASE_URL = OPENROUTER_BASE_URL
      process.env.OPENAI_API_KEY = key
      process.env.OPENAI_MODEL = model

      const profileFile = createProfileFile('openai', {
        OPENAI_BASE_URL: OPENROUTER_BASE_URL,
        OPENAI_MODEL: model,
        OPENAI_API_KEY: key,
      })
      saveProfileFile(profileFile)

      onDone()
    },
    [onDone],
  )

  const handleApiKeySubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setApiKeyError('An API key is required.')
        return
      }
      setApiKeyError(null)
      setApiKey(trimmed)
      setStep('model')
    },
    [],
  )

  const handleModelSelect = useCallback(
    (value: string) => {
      if (value === '__custom__') {
        setStep('custom-model')
        return
      }
      finishSetup(apiKey, value)
    },
    [apiKey, finishSetup],
  )

  const handleCustomModelSubmit = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        setCustomModelError('A model name is required.')
        return
      }
      setCustomModelError(null)
      finishSetup(apiKey, trimmed)
    },
    [apiKey, finishSetup],
  )

  if (step === 'api-key') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>Connect to OpenRouter</Text>
        <Box flexDirection="column" gap={1} width={70}>
          <Text>
            OpenRouter lets you use any AI model (GPT-4o, Claude, DeepSeek,
            Gemini, Llama, and more) with a single API key.
          </Text>
          <Text>
            Get your key at <Link url="https://openrouter.ai/keys" />{' '}
            <Text dimColor>(free account available)</Text>
          </Text>
          <Box flexDirection="column">
            <Text bold>OpenRouter API key:</Text>
            <TextInput
              value={apiKey}
              onChange={setApiKey}
              onSubmit={handleApiKeySubmit}
              placeholder="sk-or-v1-..."
              mask="*"
              columns={inputColumns}
              cursorOffset={apiKeyCursorOffset}
              onChangeCursorOffset={setApiKeyCursorOffset}
              focus
              showCursor
            />
            {apiKeyError ? (
              <Text color="red">{apiKeyError}</Text>
            ) : (
              <Text dimColor>Enter to confirm</Text>
            )}
          </Box>
        </Box>
      </Box>
    )
  }

  if (step === 'model') {
    return (
      <Box flexDirection="column" gap={1} paddingLeft={1}>
        <Text bold>Choose a model</Text>
        <Box flexDirection="column" gap={1} width={70}>
          <Text>
            Select from popular models or enter a custom OpenRouter model ID.
            You can change this later with <Text bold>/provider</Text>.
          </Text>
          <Select
            options={POPULAR_MODELS}
            onChange={handleModelSelect}
            onCancel={() => setStep('api-key')}
          />
          <Text dimColor>Enter to confirm · Esc to go back</Text>
        </Box>
      </Box>
    )
  }

  // step === 'custom-model'
  return (
    <Box flexDirection="column" gap={1} paddingLeft={1}>
      <Text bold>Custom model</Text>
      <Box flexDirection="column" gap={1} width={70}>
        <Text>
          Enter the OpenRouter model ID (e.g.{' '}
          <Text bold>mistralai/mistral-7b-instruct</Text>).
        </Text>
        <Text>
          Browse all models at <Link url="https://openrouter.ai/models" />
        </Text>
        <Box flexDirection="column">
          <Text bold>Model ID:</Text>
          <TextInput
            value={customModel}
            onChange={setCustomModel}
            onSubmit={handleCustomModelSubmit}
            placeholder="provider/model-name"
            columns={inputColumns}
            cursorOffset={customModelCursorOffset}
            onChangeCursorOffset={setCustomModelCursorOffset}
            focus
            showCursor
          />
          {customModelError ? (
            <Text color="red">{customModelError}</Text>
          ) : (
            <Text dimColor>Enter to confirm · Esc to pick from list</Text>
          )}
        </Box>
      </Box>
    </Box>
  )
}
