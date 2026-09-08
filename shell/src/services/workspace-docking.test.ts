import { describe, expect, it } from 'vitest'
import { canDropWorkspaceInstance, workspaceDropPosition, workspaceSplitMarker } from './workspace-docking'

describe('workspace docking primitives', () => {
  it('uses VS Code style markers for visible split panes', () => {
    expect([0, 1, 2].map((index) => workspaceSplitMarker(index, 3))).toEqual(['┌', '├', '└'])
    expect(workspaceSplitMarker(0, 1)).toBe('')
  })

  it('maps the center and four edges of a group', () => {
    const box = { left: 10, top: 20, width: 100, height: 80 }
    expect(workspaceDropPosition({ x: 60, y: 60 }, box)).toBe('center')
    expect(workspaceDropPosition({ x: 12, y: 60 }, box)).toBe('left')
    expect(workspaceDropPosition({ x: 108, y: 60 }, box)).toBe('right')
    expect(workspaceDropPosition({ x: 60, y: 22 }, box)).toBe('top')
    expect(workspaceDropPosition({ x: 60, y: 98 }, box)).toBe('bottom')
  })

  it('rejects drops across workspace categories', () => {
    expect(canDropWorkspaceInstance('files', 'files')).toBe(true)
    expect(canDropWorkspaceInstance('editors', 'editors')).toBe(true)
    expect(canDropWorkspaceInstance('files', 'editors')).toBe(false)
  })
})
