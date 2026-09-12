import type { ITheme } from '@xterm/xterm'
import { store, type TerminalPreferences, type TerminalTheme } from '../stores/app'
import { readMeta, saveMeta } from './storage'

export const TERMINAL_PREFERENCES_KEY = 'terminalPreferences' as const

const xtermDefault: TerminalTheme = {
  background: '#0d0d0d', foreground: '#d4d4d4', cursor: '#d4d4d4', cursorAccent: '#0d0d0d',
  selectionBackground: '#264f78', selectionForeground: '#ffffff',
  black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf',
  brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f', brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec',
}

const themes: Record<string, TerminalTheme> = {
  'Xterm Default': xtermDefault,
  Campbell: { ...xtermDefault, background: '#0c0c0c', foreground: '#cccccc', black: '#0c0c0c', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00', blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc', brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5', brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2' },
  'Campbell Powershell': { ...xtermDefault, background: '#012456', foreground: '#f2f2f2', black: '#0c0c0c', red: '#c50f1f', green: '#13a10e', yellow: '#c19c00', blue: '#0037da', magenta: '#881798', cyan: '#3a96dd', white: '#cccccc', brightBlack: '#767676', brightRed: '#e74856', brightGreen: '#16c60c', brightYellow: '#f9f1a5', brightBlue: '#3b78ff', brightMagenta: '#b4009e', brightCyan: '#61d6d6', brightWhite: '#f2f2f2' },
  'One Half Dark': { ...xtermDefault, background: '#282c34', foreground: '#dcdfe4', black: '#282c34', red: '#e06c75', green: '#98c379', yellow: '#e5c07b', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#dcdfe4', brightBlack: '#5a6374', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#e5c07b', brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff' },
  Dracula: { ...xtermDefault, background: '#282a36', foreground: '#f8f8f2', black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#bd93f9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2', brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#d6acff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff' },
  Nord: { ...xtermDefault, background: '#2e3440', foreground: '#d8dee9', black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0', brightBlack: '#4c566a', brightRed: '#bf616a', brightGreen: '#a3be8c', brightYellow: '#ebcb8b', brightBlue: '#81a1c1', brightMagenta: '#b48ead', brightCyan: '#8fbcbb', brightWhite: '#eceff4' },
  'Solarized Dark': { ...xtermDefault, background: '#002b36', foreground: '#839496', black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5', brightBlack: '#002b36', brightRed: '#cb4b16', brightGreen: '#586e75', brightYellow: '#657b83', brightBlue: '#839496', brightMagenta: '#6c71c4', brightCyan: '#93a1a1', brightWhite: '#fdf6e3' },
  'Tango Dark': { ...xtermDefault, background: '#000000', foreground: '#eeeeec', black: '#2e3436', red: '#cc0000', green: '#4e9a06', yellow: '#c4a000', blue: '#3465a4', magenta: '#75507b', cyan: '#06989a', white: '#d3d7cf', brightBlack: '#555753', brightRed: '#ef2929', brightGreen: '#8ae234', brightYellow: '#fce94f', brightBlue: '#729fcf', brightMagenta: '#ad7fa8', brightCyan: '#34e2e2', brightWhite: '#eeeeec' },
  'Gruvbox Dark': { ...xtermDefault, background: '#282828', foreground: '#ebdbb2', black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984', brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2' },
  'Tokyo Night': { ...xtermDefault, background: '#1a1b26', foreground: '#a9b1d6', black: '#32344a', red: '#f7768e', green: '#73daca', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#787c99', brightBlack: '#444b6a', brightRed: '#ff7a93', brightGreen: '#b3f6c0', brightYellow: '#ff9e64', brightBlue: '#7da6ff', brightMagenta: '#c0a8ff', brightCyan: '#0db9d7', brightWhite: '#acb0d0' },
}

export const terminalThemeNames = Object.keys(themes)
export const terminalFontOptions = [
  { label: '0xProto Nerd Font Mono', value: '0xProto Nerd Font Mono' },
  { label: 'Maple Mono NF', value: 'Maple Mono NF' },
  { label: 'Maple Mono NF CN', value: 'Maple Mono NF CN' },
  { label: 'Lucida Console', value: 'Lucida Console' },
  { label: 'DejaVu Sans Mono', value: 'DejaVu Sans Mono' },
  { label: 'Consolas', value: 'Consolas' },
  { label: '系统等宽字体', value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
]

export function getTerminalFontFamily(name: string): string {
  if (name === '0xProto Nerd Font Mono') return '"0xProto Nerd Font Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  if (name === 'Maple Mono NF') return '"Maple Mono NF", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  if (name === 'Maple Mono NF CN') return '"Maple Mono NF CN", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  if (name === 'Lucida Console') return '"Lucida Console", ui-monospace, monospace'
  if (name === 'DejaVu Sans Mono') return '"DejaVu Sans Mono", ui-monospace, monospace'
  if (name === 'Consolas') return 'Consolas, ui-monospace, monospace'
  return 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
}
export const terminalWeightOptions = [
  { label: '常规', value: 400 as const },
  { label: '中等', value: 500 as const },
  { label: '半粗', value: 600 as const },
  { label: '粗体', value: 700 as const },
]

export const DEFAULT_TERMINAL_PREFERENCES: TerminalPreferences = {
  key: TERMINAL_PREFERENCES_KEY,
  version: 1,
  theme: 'Xterm Default',
  fontFamily: '0xProto Nerd Font Mono',
  fontSize: 13,
  lineHeight: 1,
  fontWeight: 400,
  fontWeightBold: 700,
}

export function getTerminalTheme(name: string): ITheme {
  return themes[name] ?? themes['Xterm Default']
}

// The surfaces framing the terminal (panel remainder, group view, active tab,
// preview padding) read --terminal-* vars; push the active theme so they match
// the xterm canvas instead of staying on the default scheme colors.
export function syncTerminalChrome(name: string): void {
  const theme = getTerminalTheme(name)
  const style = document.documentElement.style
  style.setProperty('--terminal-background', theme.background ?? '#0d0d0d')
  style.setProperty('--terminal-foreground', theme.foreground ?? '#d4d4d4')
}

export async function loadTerminalPreferences(): Promise<void> {
  const stored = await readMeta<TerminalPreferences>(TERMINAL_PREFERENCES_KEY)
  if (stored) store.terminalPreferences = stored
  syncTerminalChrome(store.terminalPreferences.theme)
}

export async function saveTerminalPreferences(preferences: TerminalPreferences): Promise<void> {
  await saveMeta(preferences)
  store.terminalPreferences = preferences
  syncTerminalChrome(preferences.theme)
}

export function defaultTerminalPreferences(): TerminalPreferences {
  return { ...DEFAULT_TERMINAL_PREFERENCES }
}
