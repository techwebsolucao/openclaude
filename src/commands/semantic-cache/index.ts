import type { Command } from '../../commands.js'

const semanticCacheCommand = {
  type: 'local-jsx',
  name: 'semantic-cache',
  aliases: ['scache'],
  description: 'Manage semantic response cache (Ollama embeddings)',
  argumentHint: '[status|on|off|clear]',
  isEnabled: () => true,
  load: () => import('./semanticCache.js'),
} satisfies Command

export default semanticCacheCommand
