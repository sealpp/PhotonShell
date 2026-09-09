import { describe, expect, it } from 'vitest'
import { arrangeWorkspaceInstances, canDropWorkspaceInstance, workspaceSplitMarker } from './workspace-docking'

describe('workspace docking primitives', () => {
  it('uses VS Code style markers for grouped tabs', () => {
    expect([0, 1, 2].map((index) => workspaceSplitMarker(index, 3))).toEqual(['┌', '├', '└'])
    expect(workspaceSplitMarker(0, 1)).toBe('')
  })

  it('orders instances by pane position and marks actual tab groups', () => {
    expect(arrangeWorkspaceInstances(
      ['file-a', 'file-b', 'file-c', 'pending'],
      [
        { workspaceGroupId: 'group-c', panelIds: ['file-c'], bounds: { left: 600, top: 0 } },
        { workspaceGroupId: 'group-a', panelIds: ['file-a'], bounds: { left: 0, top: 0 } },
        { workspaceGroupId: 'group-a', panelIds: ['file-b'], bounds: { left: 300, top: 0 } },
      ],
    )).toEqual([
      { tabId: 'file-a', marker: '┌' },
      { tabId: 'file-b', marker: '└' },
      { tabId: 'file-c', marker: '' },
      { tabId: 'pending', marker: '' },
    ])
  })

  it('does not draw markers for independent panes', () => {
    expect(arrangeWorkspaceInstances(
      ['file-a', 'file-b'],
      [
        { workspaceGroupId: 'group-a', panelIds: ['file-a'], bounds: { left: 0, top: 0 } },
        { workspaceGroupId: 'group-b', panelIds: ['file-b'], bounds: { left: 600, top: 0 } },
      ],
    )).toEqual([
      { tabId: 'file-a', marker: '' },
      { tabId: 'file-b', marker: '' },
    ])
  })

  it('rejects drops across workspace categories', () => {
    expect(canDropWorkspaceInstance('files', 'files')).toBe(true)
    expect(canDropWorkspaceInstance('editors', 'editors')).toBe(true)
    expect(canDropWorkspaceInstance('files', 'editors')).toBe(false)
  })
})
