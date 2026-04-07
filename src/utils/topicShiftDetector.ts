import type { Message } from '../types/message.js'
import { getGlobalConfig } from './config.js'
import { getContentText } from './messages.js'

const DEFAULT_SIMILARITY_THRESHOLD = 0.08
const DEFAULT_MIN_CONVERSATION_TURNS = 3
const DEFAULT_RECENT_TURNS_WINDOW = 6
const DEFAULT_MIN_NEW_MESSAGE_WORDS = 5

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'that',
  'this', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their', 'what',
  'which', 'who', 'whom', 'these', 'those', 'am', 'been', 'being',
  'get', 'got', 'make', 'like', 'also', 'well', 'back', 'even',
  'still', 'way', 'take', 'come', 'thing', 'think', 'know', 'see',
  'want', 'give', 'use', 'find', 'tell', 'ask', 'work', 'seem',
  'feel', 'try', 'leave', 'call', 'keep', 'let', 'put', 'say',
  'please', 'ok', 'okay', 'yes', 'no', 'yeah', 'sure', 'right',
  // Portuguese common words (since the user writes in Portuguese)
  'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da',
  'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com',
  'sem', 'sob', 'sobre', 'entre', 'e', 'ou', 'mas', 'que', 'se', 'como',
  'quando', 'onde', 'porque', 'pois', 'nem', 'eu', 'tu', 'ele', 'ela',
  'nós', 'vós', 'eles', 'elas', 'me', 'te', 'se', 'nos', 'vos',
  'meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa',
  'ser', 'estar', 'ter', 'haver', 'fazer', 'ir', 'vir', 'ver',
  'isso', 'isto', 'aquilo', 'esse', 'esta', 'este', 'essa',
  'muito', 'mais', 'menos', 'bem', 'mal', 'já', 'ainda', 'também',
  'só', 'agora', 'então', 'depois', 'antes', 'aqui', 'ali', 'lá',
  'não', 'sim', 'voce', 'você',
])

export interface TopicShiftConfig {
  similarityThreshold?: number
  minConversationTurns?: number
  recentTurnsWindow?: number
  minNewMessageWords?: number
}

interface TopicShiftResult {
  isTopicShift: boolean
  similarity: number
  recentTopicSummary: string
}

function getUserTopicShiftConfig(): TopicShiftConfig {
  return getGlobalConfig().topicShiftConfig ?? {}
}

export function isTopicShiftDetectionEnabled(): boolean {
  if (process.env.TOPIC_SHIFT_DETECTION === '1') return true
  if (process.env.TOPIC_SHIFT_DETECTION === '0') return false
  return getGlobalConfig().topicShiftDetectionEnabled ?? false
}

let lastTopicShiftInput: string | null = null

export function getLastTopicShiftInput(): string | null {
  return lastTopicShiftInput
}

export function setLastTopicShiftInput(value: string | null): void {
  lastTopicShiftInput = value
}

function extractKeywords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  return new Set(words)
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1
  if (setA.size === 0 || setB.size === 0) return 0

  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

function getRecentUserTexts(messages: Message[], window: number): string[] {
  const userTexts: string[] = []
  for (let i = messages.length - 1; i >= 0 && userTexts.length < window; i--) {
    const msg = messages[i]
    if (msg && msg.type === 'user' && !msg.isMeta) {
      const text = getContentText(msg.message.content)
      if (text && text.trim().length > 0) {
        userTexts.push(text)
      }
    }
  }
  return userTexts
}

export function detectTopicShift(
  newMessageText: string,
  messages: Message[],
): TopicShiftResult {
  const config = getUserTopicShiftConfig()
  const threshold = config.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD
  const minTurns = config.minConversationTurns ?? DEFAULT_MIN_CONVERSATION_TURNS
  const turnsWindow = config.recentTurnsWindow ?? DEFAULT_RECENT_TURNS_WINDOW
  const minWords = config.minNewMessageWords ?? DEFAULT_MIN_NEW_MESSAGE_WORDS

  const newKeywords = extractKeywords(newMessageText)

  if (newKeywords.size < minWords) {
    return { isTopicShift: false, similarity: 1, recentTopicSummary: '' }
  }

  const recentTexts = getRecentUserTexts(messages, turnsWindow)

  if (recentTexts.length < minTurns) {
    return { isTopicShift: false, similarity: 1, recentTopicSummary: '' }
  }

  const recentKeywords = new Set<string>()
  for (const text of recentTexts) {
    for (const kw of extractKeywords(text)) {
      recentKeywords.add(kw)
    }
  }

  let assistantCount = 0
  for (let i = messages.length - 1; i >= 0 && assistantCount < turnsWindow; i--) {
    const msg = messages[i]
    if (msg && msg.type === 'assistant') {
      const text = getContentText(msg.message.content)
      if (text) {
        for (const kw of extractKeywords(text)) {
          recentKeywords.add(kw)
        }
        assistantCount++
      }
    }
  }

  const similarity = jaccardSimilarity(newKeywords, recentKeywords)

  const topKeywords = [...recentKeywords].slice(0, 8).join(', ')
  const recentTopicSummary = topKeywords || recentTexts[0]?.slice(0, 60) || ''

  return {
    isTopicShift: similarity < threshold,
    similarity,
    recentTopicSummary,
  }
}
