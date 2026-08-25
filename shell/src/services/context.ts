import type { Terminal } from '@xterm/xterm'

export type CommandArea = 'global' | 'host' | 'node' | 'terminal' | 'tab'

export interface CommandContext {
  area: CommandArea
  tabId?: string
  tabGroupTabIds?: string[]
  terminal?: Terminal
  hasSelection?: boolean
  isOnline?: boolean
  canPaste?: boolean
  tabEncoding?: string
  selectedIds?: string[]
  selectedCount?: number
  isPaired?: boolean
}
