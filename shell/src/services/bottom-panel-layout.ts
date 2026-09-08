export const BOTTOM_PANEL_MIN_HEIGHT = 220
export const BOTTOM_PANEL_DEFAULT_HEIGHT_RATIO = 0.35
export const BOTTOM_PANEL_COLLAPSE_THRESHOLD = 100

export function normalBottomPanelMaxHeight(
  availableHeight: number,
  terminalHeaderBottom: number | null,
  shellTop: number,
  terminalHeaderHeight: number,
): number {
  if (terminalHeaderBottom === null) return Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.round(availableHeight))
  const reservedTop = terminalHeaderBottom - shellTop + terminalHeaderHeight * 2
  return Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.round(availableHeight - reservedTop))
}

export function clampBottomPanelHeight(value: number, maxHeight: number): number {
  return Math.min(Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.round(maxHeight)), Math.max(BOTTOM_PANEL_MIN_HEIGHT, Math.round(value)))
}

export function shouldCollapseBottomPanel(requestedHeight: number): boolean {
  return requestedHeight < BOTTOM_PANEL_COLLAPSE_THRESHOLD
}

export function shouldReopenBottomPanel(requestedHeight: number): boolean {
  return requestedHeight >= BOTTOM_PANEL_COLLAPSE_THRESHOLD
}

export function shouldMaximizeBottomPanel(
  pointerY: number,
  maximizeBoundary: number,
  requestedHeight: number,
  normalMaxHeight: number,
): boolean {
  return pointerY <= maximizeBoundary && requestedHeight > normalMaxHeight
}

export function shouldExitMaximizedBottomPanel(pointerY: number, maximizeBoundary: number): boolean {
  return pointerY > maximizeBoundary
}
