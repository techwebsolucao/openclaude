import { getEmbeddingModel, isEmbeddingAvailable } from '../../services/api/ollamaEmbedding.js'
import { clearSemanticCache, configureSemanticCache, getSemanticCacheStats } from '../../services/api/semanticCache.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { hasLocalOllama } from '../../utils/providerDiscovery.js'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export const call: import('../../types/command.js').LocalJSXCommandCall =
  async (onDone, _context, args) => {
    const trimmed = args.trim().toLowerCase()

    if (trimmed === '' || trimmed === 'status') {
      const cfg = getGlobalConfig().semanticCacheConfig ?? {}
      const enabled = cfg.enabled !== false
      const ollamaRunning = await hasLocalOllama()
      const embeddingReady = await isEmbeddingAvailable()
      const model = getEmbeddingModel()
      const stats = getSemanticCacheStats()
      const usingOllama = ollamaRunning && embeddingReady

      let msg = `Semantic cache: ${enabled ? 'ON' : 'OFF'}`

      msg += `\n\n  Embedding Strategy:`
      if (usingOllama) {
        msg += `\n  • Mode: Ollama neural embeddings (high quality)`
        msg += `\n  • Model: ${model} ✓ ready`
        msg += `\n  • Similarity threshold: ${cfg.similarityThreshold ?? 0.92}`
      } else {
        msg += `\n  • Mode: Local n-gram hashing (zero dependencies)`
        msg += `\n  • Ollama: ${ollamaRunning ? '✓ running' : '✗ not installed'}`
        if (ollamaRunning && !embeddingReady) {
          msg += ` (model ${model} not pulled — run: ollama pull ${model})`
        }
        msg += `\n  • Similarity threshold: ${cfg.localSimilarityThreshold ?? 0.85}`
        msg += `\n  • Upgrade: install Ollama + \`ollama pull ${model}\` for neural embeddings`
      }

      msg += `\n\n  Cache Stats:`
      msg += `\n  • Entries: ${stats.entries}/${stats.maxEntries}`
      msg += `\n  • Total hits: ${stats.totalHits}`
      msg += `\n  • Disk usage: ${formatBytes(stats.diskSizeBytes)}`

      msg += `\n\n  Config:`
      msg += `\n  • Max entries: ${cfg.maxEntries ?? 200}`
      msg += `\n  • TTL: ${((cfg.entryTtlMs ?? 604800000) / 86400000).toFixed(0)} days`
      msg += `\n  • Auto-pull Ollama model: ${cfg.autoPullModel !== false ? 'yes' : 'no'}`

      msg += `\n\n  Customize: /config set semanticCacheConfig.similarityThreshold 0.90`

      onDone(msg)
      return null
    }

    if (trimmed === 'on') {
      saveGlobalConfig(current => ({
        ...current,
        semanticCacheConfig: {
          ...current.semanticCacheConfig,
          enabled: true,
        },
      }))
      configureSemanticCache({ enabled: true })
      onDone('Semantic cache enabled. Using local embeddings (Ollama upgrade available for better quality).')
      return null
    }

    if (trimmed === 'off') {
      saveGlobalConfig(current => ({
        ...current,
        semanticCacheConfig: {
          ...current.semanticCacheConfig,
          enabled: false,
        },
      }))
      configureSemanticCache({ enabled: false })
      onDone('Semantic cache disabled.')
      return null
    }

    if (trimmed === 'clear') {
      clearSemanticCache()
      onDone('Semantic cache cleared — all cached entries removed from disk.')
      return null
    }

    onDone('Usage: /semantic-cache [status|on|off|clear]')
    return null
  }
