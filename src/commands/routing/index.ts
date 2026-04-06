import type { Command } from '../../commands.js'

const routing = {
  type: 'local-jsx',
  name: 'routing',
  description: 'Show current agent routing config from settings.json and test each route',
  immediate: true,
  load: () => import('./routing.js'),
} satisfies Command

export default routing
