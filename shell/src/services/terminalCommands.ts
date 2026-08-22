import type { Terminal } from '@xterm/xterm'
import { commandRegistry } from './commands'
import type { CommandContext } from './context'
import { store } from '../stores/app'
import { closeTab } from './ws'
import { writeToClipboard, readFromClipboard } from '../utils/clipboard'
import { getBufferText, getScreenText, getSelectedText } from '../utils/terminalText'

const encodingLocales = [
  {
    id: 'en_US',
    label: 'English(en_US)',
    encodings: ['utf-8', 'us-ascii', 'iso-8859-15', 'iso-8859-1'],
  },
  {
    id: 'zh_CN',
    label: '简体中文(zh_CN)',
    encodings: ['utf-8', 'gb18030', 'gbk', 'gb2312'],
  },
  {
    id: 'zh_TW',
    label: '繁體中文(zh_TW)',
    encodings: ['utf-8', 'big5'],
  },
  {
    id: 'c',
    label: 'C',
    encodings: ['us-ascii'],
  },
  {
    id: 'posix',
    label: 'POSIX',
    encodings: ['us-ascii'],
  },
]

const encodingLabels: Record<string, string> = {
  'utf-8': 'UTF-8',
  'us-ascii': 'US-ASCII',
  'iso-8859-15': 'ISO-8859-15',
  'iso-8859-1': 'ISO-8859-1',
  'gb18030': 'GB18030',
  'gbk': 'GBK',
  'gb2312': 'GB2312',
  'big5': 'Big5',
}

function getTab(ctx: CommandContext) {
  return store.tabs.find((t) => t.id === ctx.tabId)
}

function getTerminal(ctx: CommandContext): Terminal | undefined {
  return ctx.terminal as Terminal | undefined
}

commandRegistry.register({
  id: 'terminal.newTab',
  label: '新建终端',
  shortcut: 'Ctrl+`',
  action: (ctx) => {
    const tab = getTab(ctx)
    if (!tab) return
    store.editingHostId = tab.hostId
    store.insertAfterTabId = tab.id
    store.connectionModalOpen = true
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.copy',
  label: '复制',
  children: ['terminal.copySelected', 'terminal.copyScreen', 'terminal.copyBuffer'],
})

commandRegistry.register({
  id: 'terminal.copySelected',
  label: '复制选中文本',
  disabled: (ctx) => !ctx.hasSelection,
  action: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getSelectedText(terminal)
    if (text) await writeToClipboard(text)
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.copyScreen',
  label: '复制当前屏幕',
  action: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getScreenText(terminal)
    if (text) await writeToClipboard(text)
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.copyBuffer',
  label: '复制屏幕缓冲区',
  action: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getBufferText(terminal)
    if (text) await writeToClipboard(text)
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.paste',
  label: '粘贴',
  disabled: (ctx) => ctx.isOnline !== true,
  action: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = await readFromClipboard()
    if (text !== null) {
      terminal.paste(text)
    } else {
      store.manualPaste = { open: true, tabId: ctx.tabId as string, context: { ...ctx } }
    }
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.charset',
  label: '字符集',
  children: encodingLocales.map((l) => `terminal.charset.${l.id}`),
})

for (const locale of encodingLocales) {
  commandRegistry.register({
    id: `terminal.charset.${locale.id}`,
    label: locale.label,
    children: locale.encodings.map((enc) => `terminal.charset.${locale.id}.${enc}`),
  })
  for (const enc of locale.encodings) {
    commandRegistry.register({
      id: `terminal.charset.${locale.id}.${enc}`,
      label: encodingLabels[enc] ?? enc,
      checked: (ctx) => (ctx.tabEncoding as string | undefined) === enc,
      action: (ctx) => {
        const tab = getTab(ctx)
        if (tab) tab.encoding = enc
        store.contextMenu = null
      },
    })
  }
}

commandRegistry.register({
  id: 'terminal.sessionInfo',
  label: '终端会话信息',
  action: (ctx) => {
    store.terminalSessionInfo = { open: true, tabId: ctx.tabId as string }
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'terminal.disconnect',
  label: '断开连接',
  action: (ctx) => {
    const tabId = ctx.tabId as string
    if (tabId) closeTab(tabId)
    store.contextMenu = null
  },
})

export function getTerminalMenuIds(): string[] {
  return [
    'terminal.newTab',
    'terminal.copy',
    'terminal.paste',
    'terminal.charset',
    'terminal.sessionInfo',
    'terminal.disconnect',
  ]
}
