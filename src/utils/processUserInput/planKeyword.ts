/**
 * Detects plan-related keywords in user input to auto-activate /plan mode.
 * Supports English and Portuguese keywords.
 */

// Keywords that indicate the user wants to plan something.
// Must appear as standalone words (word boundaries), case-insensitive.
const PLAN_KEYWORDS = [
  // English
  'planning',
  'plan this',
  'make a plan',
  'create a plan',
  'let me plan',
  'help me plan',
  // Portuguese
  'planeje',
  'planejar',
  'planejamento',
  'planejar isso',
  'faça um plano',
  'fazer um plano',
  'crie um plano',
  'criar um plano',
  'me ajude a planejar',
]

/**
 * Returns true if the input text contains a plan-related keyword.
 * Only matches standalone words to avoid false positives
 * (e.g. "explain" contains "plan" but shouldn't trigger).
 */
export function hasPlanKeyword(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return PLAN_KEYWORDS.some(keyword => {
    const idx = lower.indexOf(keyword)
    if (idx === -1) return false
    // Check word boundary before
    if (idx > 0) {
      const before = lower[idx - 1]!
      if (/\w/.test(before)) return false
    }
    // Check word boundary after
    const end = idx + keyword.length
    if (end < lower.length) {
      const after = lower[end]!
      if (/\w/.test(after)) return false
    }
    return true
  })
}
