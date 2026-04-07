import type { Command } from '../../commands.js'

const tokenEconomy = {
  type: 'local-jsx',
  name: 'token-economy',
  aliases: ['economy', 'save-tokens'],
  description: 'Toggle token economy mode (aggressive context savings)',
  argumentHint: '[on|off]',
  isEnabled: () => true,
  load: () => import('./tokenEconomy.js'),
} satisfies Command

export default tokenEconomy
