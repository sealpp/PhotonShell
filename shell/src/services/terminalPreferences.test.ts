import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_PREFERENCES,
  getTerminalTheme,
  terminalFontOptions,
  terminalThemeNames,
  terminalWeightOptions,
} from './terminalPreferences'

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
