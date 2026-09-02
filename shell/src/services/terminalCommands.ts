import type { Terminal } from '@xterm/xterm'
import { store } from '../stores/app'
import { closeTab, connectHost } from './ws'
import { writeToClipboard, readFromClipboard } from '../utils/clipboard'
import { getBufferText, getScreenText, getSelectedText } from '../utils/terminalText'
import type { CommandContext } from './context'
import { registerAction, registerSubmenu } from './commands'
import { MenuId } from './actions/menuIds'

const encodingLocales = [
  { id: 'en_US', label: 'English(en_US)', encodings: ['utf-8', 'us-ascii', 'iso-8859-15', 'iso-8859-1'] },
  { id: 'zh_CN', label: '简体中文(zh_CN)', encodings: ['utf-8', 'gb18030', 'gbk', 'gb2312'] },
  { id: 'zh_TW', label: '繁體中文(zh_TW)', encodings: ['utf-8', 'big5'] },
  { id: 'c', label: 'C', encodings: ['us-ascii'] },
  { id: 'posix', label: 'POSIX', encodings: ['us-ascii'] },
]

const encodingLabels: Record<string, string> = {
  'utf-8': 'UTF-8',
  'us-ascii': 'US-ASCII',
  'iso-8859-15': 'ISO-8859-15',
  'iso-8859-1': 'ISO-8859-1',
  gb18030: 'GB18030',
  gbk: 'GBK',
  gb2312: 'GB2312',
  big5: 'Big5',
}

function getTab(ctx: CommandContext) {
  return store.tabs.find((tab) => tab.id === ctx.tabId)
}

function getTerminal(ctx: CommandContext): Terminal | undefined {
  return ctx.terminal
}

registerSubmenu({ id: MenuId.TerminalCopy, title: '复制', parentMenuId: MenuId.TerminalContext, order: 20 })
registerSubmenu({ id: MenuId.TerminalPaste, title: '粘贴', parentMenuId: MenuId.TerminalContext, order: 30 })
registerSubmenu({ id: MenuId.TerminalCharset, title: '字符集', parentMenuId: MenuId.TerminalContext, order: 40 })

registerAction({
  id: 'terminal.newTab',
  title: '新建终端',
  description: '为当前主机新建终端标签',
  category: 'terminal',
  when: 'tabExists',
  run: (ctx) => {
    const tab = getTab(ctx)
    if (!tab) return
    const host = store.hosts.find((item) => item.id === tab.hostId)
    if (host) void connectHost(host, tab.id)
  },
  keybindings: [{ key: 'Mod+Backquote' }],
  menus: [{ menuId: MenuId.TerminalContext, order: 10 }],
})

registerAction({
  id: 'terminal.copySelected',
  title: '复制选中文本',
  description: '复制终端中选中的文本',
  category: 'terminal',
  when: 'area == "terminal"',
  enablement: 'hasSelection == true',
  run: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getSelectedText(terminal)
    if (text) await writeToClipboard(text)
  },
  menus: [{ menuId: MenuId.TerminalCopy, order: 10 }],
})

registerAction({
  id: 'terminal.copyScreen',
  title: '复制当前屏幕',
  description: '复制终端当前屏幕文本',
  category: 'terminal',
  when: 'area == "terminal"',
  run: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getScreenText(terminal)
    if (text) await writeToClipboard(text)
  },
  menus: [{ menuId: MenuId.TerminalCopy, order: 20 }],
})

registerAction({
  id: 'terminal.copyBuffer',
  title: '复制屏幕缓冲区',
  description: '复制终端屏幕缓冲区文本',
  category: 'terminal',
  when: 'area == "terminal"',
  run: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = getBufferText(terminal)
    if (text) await writeToClipboard(text)
  },
  menus: [{ menuId: MenuId.TerminalCopy, order: 30 }],
})

registerAction({
  id: 'terminal.pasteFromClipboard',
  title: '粘贴',
  description: '将剪贴板文本粘贴到终端',
  category: 'terminal',
  when: 'area == "terminal"',
  enablement: 'isOnline == true',
  run: async (ctx) => {
    const terminal = getTerminal(ctx)
    if (!terminal) return
    const text = await readFromClipboard()
    if (text !== null) terminal.paste(text)
    else store.manualPaste = { open: true, tabId: ctx.tabId ?? '', context: { ...ctx } }
  },
  menus: [{ menuId: MenuId.TerminalPaste, order: 10 }],
})

registerAction({
  id: 'terminal.pasteManual',
  title: '手动粘贴...',
  description: '手动编辑后粘贴文本到终端',
  category: 'terminal',
  when: 'area == "terminal"',
  enablement: 'isOnline == true',
  run: (ctx) => {
    store.manualPaste = { open: true, tabId: ctx.tabId ?? '', context: { ...ctx } }
  },
  menus: [{ menuId: MenuId.TerminalPaste, order: 20 }],
})

for (const locale of encodingLocales) {
  const submenuId = `terminal.charset.${locale.id}`
  registerSubmenu({ id: submenuId, title: locale.label, parentMenuId: MenuId.TerminalCharset, order: encodingLocales.indexOf(locale) })
  for (const enc of locale.encodings) {
    registerAction({
      id: `terminal.charset.${locale.id}.${enc}`,
      title: encodingLabels[enc] ?? enc,
      description: `将终端字符集切换为 ${encodingLabels[enc] ?? enc}`,
      category: 'terminal',
      when: 'area == "terminal"',
      enablement: 'tabExists',
      checked: (ctx) => ctx.tabEncoding === enc,
      run: (ctx) => {
        const tab = getTab(ctx)
        if (tab) tab.encoding = enc
      },
      menus: [{ menuId: submenuId, order: locale.encodings.indexOf(enc) }],
    })
  }
}

registerAction({
  id: 'terminal.sessionInfo',
  title: '终端会话信息',
  description: '查看当前终端会话信息',
  category: 'terminal',
  when: 'area == "terminal"',
  enablement: 'tabExists',
  run: (ctx) => {
    if (ctx.tabId) store.terminalSessionInfo = { open: true, tabId: ctx.tabId }
  },
  menus: [{ menuId: MenuId.TerminalContext, order: 50 }],
})

registerAction({
  id: 'terminal.disconnect',
  title: '断开连接',
  description: '断开当前终端连接',
  category: 'terminal',
  when: 'area == "terminal"',
  enablement: 'tabExists',
  run: (ctx) => {
    if (ctx.tabId) closeTab(ctx.tabId)
  },
  menus: [{ menuId: MenuId.TerminalContext, order: 60 }],
})

export { TERMINAL_MENU_ID } from './actions/menuIds'
