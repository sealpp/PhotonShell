import type { Terminal } from '@xterm/xterm'
import { commandRegistry, menuRegistry, type MenuEntry } from './commands'
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
  return ctx.terminal
}

commandRegistry.register({
  id: 'terminal.newTab',
  label: '新建终端',
  shortcut: 'Ctrl+`',
  enabled: (ctx) => !!getTab(ctx),
  execute: (ctx) => {
    const tab = getTab(ctx)
    if (!tab) return
    store.editingHostId = tab.hostId
    store.insertAfterTabId = tab.id
    store.connectionModalOpen = true
  },
})

commandRegistry.register({
  id: 'terminal.copySelected',
  label: '复制选中文本',
  enabled: (ctx) => ctx.hasSelection === true,
  execute: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getSelectedText(terminal)
    if (text) await writeToClipboard(text)
  },
})

commandRegistry.register({
  id: 'terminal.copyScreen',
  label: '复制当前屏幕',
  execute: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getScreenText(terminal)
    if (text) await writeToClipboard(text)
  },
})

commandRegistry.register({
  id: 'terminal.copyBuffer',
  label: '复制屏幕缓冲区',
  execute: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getBufferText(terminal)
    if (text) await writeToClipboard(text)
  },
})

commandRegistry.register({
  id: 'terminal.pasteFromClipboard',
  label: '粘贴',
  enabled: (ctx) => ctx.isOnline === true,
  execute: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = await readFromClipboard()
    if (text !== null) {
      terminal.paste(text)
    } else {
      store.manualPaste = {
        open: true,
        tabId: ctx.tabId ?? '',
        context: { ...ctx },
      }
    }
  },
})

commandRegistry.register({
  id: 'terminal.pasteManual',
  label: '手动粘贴...',
  enabled: (ctx) => ctx.isOnline === true,
  execute: (ctx) => {
    store.manualPaste = {
      open: true,
      tabId: ctx.tabId ?? '',
      context: { ...ctx },
    }
  },
})

for (const locale of encodingLocales) {
  for (const enc of locale.encodings) {
    commandRegistry.register({
      id: `terminal.charset.${locale.id}.${enc}`,
      label: encodingLabels[enc] ?? enc,
      checked: (ctx) => ctx.tabEncoding === enc,
      enabled: (ctx) => !!getTab(ctx),
      execute: (ctx) => {
        const tab = getTab(ctx)
        if (tab) tab.encoding = enc
      },
    })
  }
}

commandRegistry.register({
  id: 'terminal.sessionInfo',
  label: '终端会话信息',
  enabled: (ctx) => !!getTab(ctx),
  execute: (ctx) => {
    if (!ctx.tabId) return
    store.terminalSessionInfo = { open: true, tabId: ctx.tabId }
  },
})

commandRegistry.register({
  id: 'terminal.disconnect',
  label: '断开连接',
  enabled: (ctx) => !!getTab(ctx),
  execute: (ctx) => {
    if (ctx.tabId) closeTab(ctx.tabId)
  },
})

const charsetEntries: MenuEntry[] = encodingLocales.map((locale) => ({
  kind: 'submenu',
  id: `terminal.charset.${locale.id}`,
  label: locale.label,
  items: locale.encodings.map((enc) => ({
    kind: 'command',
    commandId: `terminal.charset.${locale.id}.${enc}`,
  })),
}))

export const TERMINAL_MENU_ID = 'terminal.context'

menuRegistry.register(TERMINAL_MENU_ID, [
  { kind: 'command', commandId: 'terminal.newTab' },
  {
    kind: 'submenu',
    id: 'terminal.copy',
    label: '复制',
    items: [
      { kind: 'command', commandId: 'terminal.copySelected' },
      { kind: 'command', commandId: 'terminal.copyScreen' },
      { kind: 'command', commandId: 'terminal.copyBuffer' },
    ],
  },
  {
    kind: 'submenu',
    id: 'terminal.paste',
    label: '粘贴',
    items: [
      { kind: 'command', commandId: 'terminal.pasteFromClipboard' },
      { kind: 'command', commandId: 'terminal.pasteManual' },
    ],
  },
  {
    kind: 'submenu',
    id: 'terminal.charset',
    label: '字符集',
    items: charsetEntries,
  },
  { kind: 'command', commandId: 'terminal.sessionInfo' },
  { kind: 'command', commandId: 'terminal.disconnect' },
])
