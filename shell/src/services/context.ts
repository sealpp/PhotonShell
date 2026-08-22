import type { Terminal } from '@xterm/xterm'

export type CommandArea = 'global' | 'host' | 'node' | 'terminal'

export interface CommandContext {
  area: CommandArea
  tabId?: string
  terminal?: Terminal
  hasSelection?: boolean
  isOnline?: boolean
  canPaste?: boolean
  tabEncoding?: string
  selectedIds?: string[]
  selectedCount?: number
  hasToken?: boolean
}
