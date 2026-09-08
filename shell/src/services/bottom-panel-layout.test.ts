import { describe, expect, it } from 'vitest'
import {
  BOTTOM_PANEL_COLLAPSE_THRESHOLD,
  BOTTOM_PANEL_MIN_HEIGHT,
  clampBottomPanelHeight,
  normalBottomPanelMaxHeight,
  shouldCollapseBottomPanel,
  shouldExitMaximizedBottomPanel,
  shouldMaximizeBottomPanel,
  shouldReopenBottomPanel,
} from './bottom-panel-layout'

describe('bottom panel layout', () => {
  it('leaves two measured terminal header heights below the terminal tabs', () => {
    expect(normalBottomPanelMaxHeight(1000, 135, 100, 35)).toBe(895)
  })

  it('uses the full central height when there is no terminal header', () => {
    expect(normalBottomPanelMaxHeight(1000, null, 100, 0)).toBe(1000)
  })

  it('clamps ordinary heights to the configured minimum and measured maximum', () => {
    expect(clampBottomPanelHeight(100, 800)).toBe(BOTTOM_PANEL_MIN_HEIGHT)
    expect(clampBottomPanelHeight(900, 800)).toBe(800)
  })

  it('detects collapse, maximize, and restore drag thresholds', () => {
    expect(shouldCollapseBottomPanel(BOTTOM_PANEL_COLLAPSE_THRESHOLD - 1)).toBe(true)
    expect(shouldCollapseBottomPanel(BOTTOM_PANEL_COLLAPSE_THRESHOLD)).toBe(false)
    expect(shouldReopenBottomPanel(BOTTOM_PANEL_COLLAPSE_THRESHOLD - 1)).toBe(false)
    expect(shouldReopenBottomPanel(BOTTOM_PANEL_COLLAPSE_THRESHOLD)).toBe(true)
    expect(shouldMaximizeBottomPanel(134, 135, 900, 895)).toBe(true)
    expect(shouldMaximizeBottomPanel(136, 135, 900, 895)).toBe(false)
    expect(shouldExitMaximizedBottomPanel(135, 135)).toBe(false)
    expect(shouldExitMaximizedBottomPanel(136, 135)).toBe(true)
  })
})
