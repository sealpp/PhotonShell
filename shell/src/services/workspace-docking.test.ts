import { describe, expect, it } from 'vitest'
import { canDropWorkspaceInstance, workspaceSplitMarker } from './workspace-docking'

describe('workspace docking primitives', () => {
  it('uses VS Code style markers for visible split panes', () => {
    expect([0, 1, 2].map((index) => workspaceSplitMarker(index, 3))).toEqual(['┌', '├', '└'])
    expect(workspaceSplitMarker(0, 1)).toBe('')
  })

  it('rejects drops across workspace categories', () => {
    expect(canDropWorkspaceInstance('files', 'files')).toBe(true)
    expect(canDropWorkspaceInstance('editors', 'editors')).toBe(true)
    expect(canDropWorkspaceInstance('files', 'editors')).toBe(false)
  })
})
