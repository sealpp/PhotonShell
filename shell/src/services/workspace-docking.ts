export type WorkspaceCategory = 'files' | 'editors'

export function workspaceSplitMarker(index: number, count: number): string {
  if (count <= 1 || index < 0 || index >= count) return ''
  if (index === 0) return '┌'
  if (index === count - 1) return '└'
  return '├'
}

export function canDropWorkspaceInstance(source: WorkspaceCategory, target: WorkspaceCategory): boolean {
  return source === target
}
