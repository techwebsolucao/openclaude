/**
 * OpenClaude startup screen — minimal provider config summary with model selector.
 *
 * Addresses: https://github.com/Gitlawb/openclaude/issues/55
 */

import { homedir } from 'os';
import { isLocalProviderUrl } from '../services/api/providerConfig.js';
import { getEnabledSettingSources } from '../utils/settings/constants.js';
import { getSettingsFilePathForSource, getSettingsForSource, updateSettingsForSource } from '../utils/settings/settings.js';

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

const ESC = '\x1b['
const RESET = `${ESC}0m`
const DIM = `${ESC}2m`
const BOLD = `${ESC}1m`
const CLEAR = '\x1b[2J\x1b[H'

type RGB = [number, number, number]
const rgb = (r: number, g: number, b: number) => `${ESC}38;2;${r};${g};${b}m`

const ACCENT: RGB = [240, 148, 100]
const CREAM: RGB = [220, 195, 170]
const DIMCOL: RGB = [120, 100, 82]
const BORDER: RGB = [100, 80, 65]
const GREEN: RGB = [130, 175, 130]
const HIGHLIGHT: RGB = [255, 180, 120]

// ─── Settings snapshot ────────────────────────────────────────────────────────

interface RouteEntry {
  agent: string
  model: string
  baseUrl?: string
  isLocal: boolean
}

interface SettingsSnapshot {
  routes: RouteEntry[]       // from agentRouting + agentModels (preferred)
  model?: string             // fallback: bare settings.model
  apiBase?: string           // fallback: bare settings.apiBase
  isLocal: boolean
  configFile: string
}

function shortenPath(p: string): string {
  const home = homedir()
  return p.startsWith(home) ? '~' + p.slice(home.length) : p
}

/**
 * Reads provider-relevant fields directly from the highest-priority settings
 * source that contains them. Returns null if no settings have provider config.
 * Prefers agentRouting+agentModels; falls back to model/apiBase.
 */
function readSettingsSnapshot(): SettingsSnapshot | null {
  const sources = getEnabledSettingSources()
  for (const source of sources) {
    const settings = getSettingsForSource(source)
    if (!settings) continue

    const routing = settings.agentRouting as Record<string, string> | undefined
    const models = settings.agentModels as Record<string, { base_url?: string; api_key?: string }> | undefined
    const model = settings.model as string | undefined
    const apiBase = (settings as Record<string, unknown>).apiBase as string | undefined

    const hasRouting = routing && Object.keys(routing).length > 0
    const hasSimple = !!(model || apiBase)
    if (!hasRouting && !hasSimple) continue

    const filePath = getSettingsFilePathForSource(source)
    if (!filePath) continue

    const routes: RouteEntry[] = []
    if (hasRouting) {
      for (const [agent, modelName] of Object.entries(routing!)) {
        const info = models?.[modelName]
        const baseUrl = info?.base_url
        routes.push({
          agent,
          model: modelName,
          baseUrl,
          isLocal: baseUrl ? isLocalProviderUrl(baseUrl) : false,
        })
      }
    }

    // Overall isLocal: true if any route (or the fallback apiBase) is local
    const anyLocal =
      routes.some(r => r.isLocal) ||
      (apiBase ? isLocalProviderUrl(apiBase) : false)

    return {
      routes,
      model: hasRouting ? undefined : model,
      apiBase: hasRouting ? undefined : apiBase,
      isLocal: anyLocal,
      configFile: shortenPath(filePath),
    }
  }
  return null
}

// ─── Box drawing ──────────────────────────────────────────────────────────────

function boxRow(content: string, width: number, rawLen: number): string {
  const pad = Math.max(0, width - 2 - rawLen)
  return `${rgb(...BORDER)}\u2502${RESET}${content}${' '.repeat(pad)}${rgb(...BORDER)}\u2502${RESET}`
}

// ─── Model Selector ───────────────────────────────────────────────────────────

interface ModelOption {
  modelName: string
  baseUrl?: string
  isLocal: boolean
}

async function printModelSelector(models: ModelOption[]): Promise<number> {
  const W = 62
  const out: string[] = []

  out.push(`${rgb(...BORDER)}\u2554${'\u2550'.repeat(W - 2)}\u2557${RESET}`)

  const title = ` ${BOLD}${rgb(...ACCENT)}Select Model${RESET}`
  out.push(boxRow(title, W, ' Select Model'.length))
  out.push(`${rgb(...BORDER)}\u255f${'\u2500'.repeat(W - 2)}\u2562${RESET}`)

  for (let i = 0; i < models.length; i++) {
    const m = models[i]
    const num = i + 1
    const urlPart = m.baseUrl
      ? ` ${DIM}${rgb(...DIMCOL)}(${m.baseUrl.length > 30 ? m.baseUrl.slice(0, 27) + '...' : m.baseUrl})${RESET}`
      : ''
    const localBadge = m.isLocal ? ` ${rgb(...GREEN)}[local]${RESET}` : ''
    const row = ` ${DIM}${rgb(...DIMCOL)}[${num}]${RESET} ${rgb(...CREAM)}${m.modelName}${RESET}${localBadge}${urlPart}`
    const rawLen = ` [${num}] ${m.modelName}`.length + (m.isLocal ? 8 : 0)
    out.push(boxRow(row, W, Math.min(rawLen, W - 4)))
  }

  out.push(`${rgb(...BORDER)}\u255a${'\u2550'.repeat(W - 2)}\u255d${RESET}`)
  out.push('')
  out.push(`${DIM}Enter model number (1-${models.length}), or press Enter to skip:${RESET} `)

  process.stdout.write(out.join('\n'))

  // Read user input
  const input = await readLine()
  const num = parseInt(input?.trim(), 10)

  if (!isNaN(num) && num >= 1 && num <= models.length) {
    return num - 1
  }

  return -1
}

async function readLine(): Promise<string | undefined> {
  // Simple async readline for model selection
  const readline = await import('readline')

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close()
      resolve(answer)
    })

    // Timeout after 5 seconds
    setTimeout(() => {
      rl.close()
      resolve('')
    }, 5000)
  })
}

async function updateSettingsWithSelectedModel(
  selectedModel: string,
): Promise<void> {
  const sources = getEnabledSettingSources()
  const source = sources[0] // Use highest priority source
  if (!source) return

  const filePath = getSettingsFilePathForSource(source)
  if (!filePath) return

  const settings = getSettingsForSource(source)
  if (!settings) return

  // Update agentRouting to use selected model for general-purpose and default
  const newRouting: Record<string, string> = {
    ...(settings.agentRouting as Record<string, string> || {}),
    'general-purpose': selectedModel,
    'default': selectedModel,
  }

  const newSettings = {
    ...settings,
    agentRouting: newRouting,
  }

  try {
    await updateSettingsForSource(source, newSettings)
    console.log(`${rgb(...GREEN)}\u2713${RESET} ${DIM}Model updated to:${RESET} ${rgb(...CREAM)}${selectedModel}${RESET}`)
    console.log('')
  } catch (err) {
    console.log(`${DIM}Note: Run /model command to change models${RESET}`)
    console.log('')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function printStartupScreen(): void {
  // Skip in non-interactive / CI / print mode
  if (process.env.CI || !process.stdout.isTTY) return

  const snap = readSettingsSnapshot()
  if (!snap) return // nothing to show

  const W = 62
  const out: string[] = []

  out.push('')

  // Settings config box — shows actual routing from settings.json
  out.push(`${rgb(...BORDER)}\u2554${'\u2550'.repeat(W - 2)}\u2557${RESET}`)

  const lbl = (k: string, v: string, c: RGB = CREAM): [string, number] => {
    const padK = k.padEnd(9)
    return [` ${DIM}${rgb(...DIMCOL)}${padK}${RESET} ${rgb(...c)}${v}${RESET}`, ` ${padK} ${v}`.length]
  }

  if (snap.routes.length > 0) {
    // agentRouting header
    const hRow = ` ${rgb(...ACCENT)}agentRouting${RESET}`
    out.push(boxRow(hRow, W, ' agentRouting'.length))

    for (const route of snap.routes) {
      const agentPad = route.agent.padEnd(18)
      const urlPart = route.baseUrl
        ? ` ${DIM}${rgb(...DIMCOL)}(${route.baseUrl.length > 26 ? route.baseUrl.slice(0, 23) + '...' : route.baseUrl})${RESET}`
        : ''
      const rawModelC: RGB = route.isLocal ? [130, 175, 130] : CREAM
      const rawLine = `   ${agentPad}\u2192 ${route.model}${route.baseUrl ? ` (${route.baseUrl.length > 26 ? route.baseUrl.slice(0, 23) + '...' : route.baseUrl})` : ''}`
      const row = `   ${DIM}${rgb(...DIMCOL)}${agentPad}${RESET}${rgb(...DIMCOL)}\u2192 ${RESET}${rgb(...rawModelC)}${route.model}${RESET}${urlPart}`
      out.push(boxRow(row, W, rawLine.length))
    }
  } else {
    // Fallback: bare model / apiBase
    let [r, l]: [string, number] = ['', 0]
    if (snap.model) {
      ;[r, l] = lbl('model', snap.model)
      out.push(boxRow(r, W, l))
    }
    if (snap.apiBase) {
      const ep = snap.apiBase.length > 38 ? snap.apiBase.slice(0, 35) + '...' : snap.apiBase
      ;[r, l] = lbl('apiBase', ep)
      out.push(boxRow(r, W, l))
    }
  }

  const cfgRow = ` ${rgb(...DIMCOL)}config: ${rgb(...ACCENT)}${snap.configFile}${RESET}`
  const cfgLen = ` config: ${snap.configFile}`.length
  out.push(boxRow(cfgRow, W, cfgLen))

  out.push(`${rgb(...BORDER)}\u2560${'\u2550'.repeat(W - 2)}\u2563${RESET}`)

  const sC: RGB = snap.isLocal ? [130, 175, 130] : ACCENT
  const sL = snap.isLocal ? 'local' : 'cloud'
  const sRow = ` ${rgb(...sC)}\u25cf${RESET} ${DIM}${rgb(...DIMCOL)}${sL}${RESET}    ${DIM}${rgb(...DIMCOL)}Ready \u2014 type ${RESET}${rgb(...ACCENT)}/help${RESET}${DIM}${rgb(...DIMCOL)} to begin${RESET}`
  const sLen = ` \u25cf ${sL}    Ready \u2014 type /help to begin`.length
  out.push(boxRow(sRow, W, sLen))

  out.push(`${rgb(...BORDER)}\u255a${'\u2550'.repeat(W - 2)}\u255d${RESET}`)
  out.push('')

  process.stdout.write(out.join('\n') + '\n')
}

/**
 * Interactive model selector - shows available models from agentModels
 * and allows user to select which one to use for general-purpose/default
 */
export async function showModelSelector(): Promise<void> {
  // Skip in non-interactive / CI / print mode
  if (process.env.CI || !process.stdout.isTTY) return

  const sources = getEnabledSettingSources()
  const source = sources[0]
  if (!source) return

  const settings = getSettingsForSource(source)
  if (!settings) return

  const agentModels = settings.agentModels as Record<string, { base_url?: string; api_key?: string }> | undefined
  if (!agentModels || Object.keys(agentModels).length === 0) return

  // Build list of available models
  const modelOptions: ModelOption[] = Object.entries(agentModels).map(([name, config]) => ({
    modelName: name,
    baseUrl: config.base_url,
    isLocal: config.base_url ? isLocalProviderUrl(config.base_url) : false,
  }))

  if (modelOptions.length === 0) return

  // Clear screen and show selector
  process.stdout.write(CLEAR)

  const selectedIndex = await printModelSelector(modelOptions)

  if (selectedIndex >= 0) {
    const selectedModel = modelOptions[selectedIndex].modelName
    await updateSettingsWithSelectedModel(selectedModel)
  }
}
