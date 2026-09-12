import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_TERMINAL_PREFERENCES,
  getTerminalTheme,
  syncTerminalChrome,
  terminalFontOptions,
  terminalThemeNames,
  terminalWeightOptions,
} from './terminalPreferences'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('terminal preferences', () => {
  it('exposes the agreed defaults', () => {
    expect(DEFAULT_TERMINAL_PREFERENCES).toMatchObject({
      theme: 'Xterm Default',
      fontFamily: '0xProto Nerd Font Mono',
      fontSize: 13,
      lineHeight: 1,
      fontWeight: 400,
      fontWeightBold: 700,
    })
  })

  it('provides complete themes for every built-in scheme', () => {
    expect(terminalThemeNames.length).toBeGreaterThanOrEqual(10)
    for (const name of terminalThemeNames) {
      const theme = getTerminalTheme(name)
      expect(theme.background).toMatch(/^#/)
      expect(theme.foreground).toMatch(/^#/)
      expect(theme.brightWhite).toMatch(/^#/)
      expect(theme.red).toMatch(/^#/)
    }
  })

  it('pushes the active theme colors onto the chrome css vars', () => {
    const vars = new Map<string, string>()
    vi.stubGlobal('document', {
      documentElement: { style: { setProperty: (name: string, value: string) => vars.set(name, value) } },
    })
    syncTerminalChrome('Solarized Dark')
    expect(vars.get('--terminal-background')).toBe('#002b36')
    expect(vars.get('--terminal-foreground')).toBe('#839496')
    vars.clear()
    syncTerminalChrome('missing-theme')
    expect(vars.get('--terminal-background')).toBe('#0d0d0d')
  })

  it('contains the requested fonts and named common weights', () => {
    expect(terminalFontOptions.map((item) => item.label)).toEqual(expect.arrayContaining([
      '0xProto Nerd Font Mono', 'Maple Mono NF', 'Maple Mono NF CN', 'Lucida Console', 'DejaVu Sans Mono', 'Consolas',
    ]))
    expect(terminalWeightOptions).toEqual([
      { label: '常规', value: 400 },
      { label: '中等', value: 500 },
      { label: '半粗', value: 600 },
      { label: '粗体', value: 700 },
    ])
  })
})
