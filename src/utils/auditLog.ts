import { appendFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { getSessionId } from '../bootstrap/state.js'
import { getClaudeConfigHomeDir } from './envUtils.js'

export type AuditEventType =
  | 'tool_input_validation_error'
  | 'tool_call'
  | 'tool_result'
  | 'tool_permission_denied'
  | 'worktree_created'
  | 'worktree_error'

export interface AuditEntry {
  timestamp: string
  sessionId: string
  event: AuditEventType
  toolName?: string
  data?: Record<string, unknown>
}

function getAuditLogPath(): string {
  return join(getClaudeConfigHomeDir(), 'logs', 'audit.jsonl')
}

let ensuredDir = false

export function writeAuditLog(
  event: AuditEventType,
  fields?: { toolName?: string; data?: Record<string, unknown> },
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
    event,
    ...(fields?.toolName ? { toolName: fields.toolName } : {}),
    ...(fields?.data ? { data: fields.data } : {}),
  }

  const line = JSON.stringify(entry) + '\n'
  const path = getAuditLogPath()
  const dir = dirname(path)

  const doWrite = async (): Promise<void> => {
    if (!ensuredDir) {
      await mkdir(dir, { recursive: true }).catch(() => {})
      ensuredDir = true
    }
    await appendFile(path, line, { encoding: 'utf-8' }).catch(() => {})
  }

  void doWrite()
}
