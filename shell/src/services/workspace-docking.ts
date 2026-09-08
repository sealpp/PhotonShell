import type { Box } from 'dockview-vue'

export type WorkspaceCategory = 'files' | 'editors'
export type WorkspaceDropPosition = 'top' | 'bottom' | 'left' | 'right' | 'center'

export function workspaceSplitMarker(index: number, count: number): string {
  if (count <= 1 || index < 0 || index >= count) return ''
  if (index === 0) return '┌'
  if (index === count - 1) return '└'
  return '├'
}

export function workspaceDropPosition(point: { x: number; y: number }, box: Box, edgeRatio = 0.24): WorkspaceDropPosition {
  const edgeX = box.width * edgeRatio
  const edgeY = box.height * edgeRatio
  const fromLeft = point.x - box.left
  const fromTop = point.y - box.top
  const fromRight = box.left + box.width - point.x
  const fromBottom = box.top + box.height - point.y
  const nearest = Math.min(fromLeft, fromRight, fromTop, fromBottom)
  if (nearest >= 0 && nearest <= edgeX && nearest <= edgeY) {
    if (nearest === fromLeft) return 'left'
    if (nearest === fromRight) return 'right'
    if (nearest === fromTop) return 'top'
    return 'bottom'
  }
  return 'center'
}

export function canDropWorkspaceInstance(source: WorkspaceCategory, target: WorkspaceCategory): boolean {
  return source === target
}
