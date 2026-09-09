export type BottomPanelCategory = 'files' | 'editors'

export interface WorkspaceGroupLayout {
  panelIds: readonly string[]
  bounds?: { left: number; top: number }
}

export interface WorkspaceInstanceLayout {
  tabId: string
  marker: string
}

export function workspaceSplitMarker(index: number, count: number): string {
  if (count <= 1 || index < 0 || index >= count) return ''
  if (index === 0) return '┌'
  if (index === count - 1) return '└'
  return '├'
}

export function arrangeWorkspaceInstances(
  tabIds: readonly string[],
  groups: readonly WorkspaceGroupLayout[],
): WorkspaceInstanceLayout[] {
  const knownIds = new Set(tabIds)
  const arranged = groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      if (!left.group.bounds && !right.group.bounds) return left.index - right.index
      if (!left.group.bounds) return 1
      if (!right.group.bounds) return -1
      return left.group.bounds.top - right.group.bounds.top
        || left.group.bounds.left - right.group.bounds.left
        || left.index - right.index
    })

  const result: WorkspaceInstanceLayout[] = []
  const placedIds = new Set<string>()
  for (const { group } of arranged) {
    const panelIds = group.panelIds.filter((id) => knownIds.has(id))
    panelIds.forEach((tabId, index) => {
      if (placedIds.has(tabId)) return
      placedIds.add(tabId)
      result.push({ tabId, marker: workspaceSplitMarker(index, panelIds.length) })
    })
  }
  for (const tabId of tabIds) {
    if (!placedIds.has(tabId)) result.push({ tabId, marker: '' })
  }
  return result
}

export function canDropWorkspaceInstance(source: BottomPanelCategory, target: BottomPanelCategory): boolean {
  return source === target
}
