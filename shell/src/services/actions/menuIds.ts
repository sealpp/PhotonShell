export const MenuId = {
  Workbench: 'workbench.activity',
  HostContext: 'host.context',
  TabContext: 'tab.context',
  TerminalContext: 'terminal.context',
  TerminalCopy: 'terminal.copy',
  TerminalPaste: 'terminal.paste',
  TerminalCharset: 'terminal.charset',
  NodeStatus: 'node.status',
} as const

export const HOST_MENU_ID = MenuId.HostContext
export const TAB_MENU_ID = MenuId.TabContext
export const TERMINAL_MENU_ID = MenuId.TerminalContext
export const NODE_MENU_ID = MenuId.NodeStatus

