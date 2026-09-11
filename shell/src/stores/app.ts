import { reactive } from 'vue'
import type { CommandContext } from '../services/context'

export type View = 'welcome' | 'shell'
export type ShellState = 'idle' | 'connecting' | 'online' | 'error'
export type TabKind = 'terminal' | 'file' | 'editor'
export type BottomPanelCategory = 'files' | 'editors'
export type FocusedDock = 'terminal' | 'bottomPanel'

export type FileSortKey = 'name' | 'modified' | 'size' | 'type'
export type FileSortDirection = 'asc' | 'desc'

export interface FileWorkspaceState {
  cwd: string
  defaultPath: string
  history: string[]
  historyIndex: number
  entries: FileEntry[]
  selectedPaths: string[]
  sortKey: FileSortKey
  sortDirection: FileSortDirection
  showHidden: boolean
  loading: boolean
  error: string
}

export interface EditorState {
  path: string
  language: string
  dirty: boolean
  encoding: 'utf-8' | 'utf-16le' | 'utf-16be'
  bom: boolean
  lineEnding: '\n' | '\r\n' | '\r'
  content: string
  size: number
  largeFileConfirmed: boolean
}

export interface FileEntry {
  name: string
  path: string
  kind: 'file' | 'directory' | 'symlink' | 'unknown'
  size: number
  modifiedAt: number
  mode?: number
  target?: string
  hidden?: boolean
  temporary?: boolean
}

export interface HostProfile {
  id: string
  name?: string
  address: string
  port: number
  username: string
  folderId: string | null
}

export interface FolderProfile {
  id: string
  name: string
  parentId: string | null
}

export type MetricQuality = 'valid' | 'missing'

export interface MetricValue {
  value: number | string | null
  unit: string
  quality: MetricQuality
}

export interface Telemetry {
  sampledAt: number
  metrics: Record<string, MetricValue>
}

export interface Tab {
  id: string
  kind: TabKind
  hostId: string
  label: string
  state: ShellState
  error: string
  sessionId: string
  terminalId: string
  telemetry: Telemetry | null
  encoding: string
  cwd?: string
  afterTabId?: string
  file?: FileWorkspaceState
  editor?: EditorState
}

export interface TerminalTab extends Tab {
  kind: 'terminal'
  terminalId: string
}

export interface FileTab extends Tab {
  kind: 'file'
  file: FileWorkspaceState
}

export interface EditorTab extends Tab {
  kind: 'editor'
  editor: EditorState
}

export interface SftpClipboardState {
  version: 1
  mode: 'copy' | 'cut'
  sourceTabId: string
  sourceSessionId: string
  entries: Pick<FileEntry, 'path' | 'name' | 'kind' | 'size'>[]
  createdAt: number
}

export type InteractionDialogKind = 'confirm' | 'prompt' | 'alert'

export interface InteractionDialogState {
  kind: InteractionDialogKind
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  value: string
  placeholder: string
}

export interface AppState {
  view: View
  identityLoaded: boolean
  paired: boolean
  deviceId: string
  deviceName: string
  error: string
  hosts: HostProfile[]
  folders: FolderProfile[]
  tabs: Tab[]
  activeTerminalTabId: string
  activeFileTabId: string
  activeEditorTabId: string
  bottomPanelCategory: BottomPanelCategory
  focusedDock: FocusedDock
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  bottomPanelInstanceListWidth: number
  bottomPanelMaximized: boolean
  bottomPanelRestoreHeight: number
  selectedHostIds: Set<string>
  selectionAnchor: string
  selectedNodeIds: Set<string>
  selectionAnchorNodeId: string
  expandedFolderIds: Set<string>
  telemetry: Telemetry | null
  sidebarOpen: boolean
  sidebarView: 'connections'
  sidebarWidth: number
  panelOpen: boolean
  panelWidth: number
  pairingModalOpen: boolean
  connectionModalOpen: boolean
  loginDialogOpen: boolean
  settingsModalOpen: boolean
  keyboardShortcutsModalOpen: boolean
  aboutModalOpen: boolean
  dirtyCloseConfirm: {
    tabId: string
    path: string
    remainingTabIds: string[]
  } | null
  interactionDialog: InteractionDialogState | null
  loginDialogHostId: string
  loginDialogTabId: string
  loginDialogError: string
  loginDialogInsertAfterTabId: string
  hostKeyPrompt: {
    host: string
    port: number
    fingerprint: string
  } | null
  editingHostId: string
  insertAfterTabId: string
  newHostFolderId: string | null
  folderModalOpen: boolean
  editingFolderId: string
  folderParentId: string | null
  deleteFolderIds: string[]
  deleteFolderConfirmOpen: boolean
  deleteConfirmOpen: boolean
  deleteConfirmIds: string[]
  terminalSessionInfo: {
    open: boolean
    tabId: string
  } | null
  manualPaste: {
    open: boolean
    tabId: string
    context?: CommandContext
  } | null
  nodeConnected: boolean
  sftpClipboard: SftpClipboardState | null
}

export const store = reactive<AppState>({
  view: 'welcome',
  identityLoaded: false,
  paired: false,
  deviceId: '',
  deviceName: 'SealShell PWA',
  error: '',
  hosts: [],
  folders: [],
  tabs: [],
  activeTerminalTabId: '',
  activeFileTabId: '',
  activeEditorTabId: '',
  bottomPanelCategory: 'files',
  focusedDock: 'terminal',
  bottomPanelOpen: false,
  bottomPanelHeight: 320,
  bottomPanelInstanceListWidth: 220,
  bottomPanelMaximized: false,
  bottomPanelRestoreHeight: 320,
  selectedHostIds: new Set(),
  selectionAnchor: '',
  selectedNodeIds: new Set(),
  selectionAnchorNodeId: '',
  expandedFolderIds: new Set(),
  telemetry: null,
  sidebarOpen: true,
  sidebarView: 'connections',
  sidebarWidth: 220,
  panelOpen: false,
  panelWidth: 280,
  pairingModalOpen: false,
  connectionModalOpen: false,
  loginDialogOpen: false,
  settingsModalOpen: false,
  keyboardShortcutsModalOpen: false,
  aboutModalOpen: false,
  dirtyCloseConfirm: null,
  interactionDialog: null,
  loginDialogHostId: '',
  loginDialogTabId: '',
  loginDialogError: '',
  loginDialogInsertAfterTabId: '',
  hostKeyPrompt: null,
  editingHostId: '',
  insertAfterTabId: '',
  newHostFolderId: null,
  folderModalOpen: false,
  editingFolderId: '',
  folderParentId: null,
  deleteFolderIds: [],
  deleteFolderConfirmOpen: false,
  deleteConfirmOpen: false,
  deleteConfirmIds: [],
  terminalSessionInfo: null,
  manualPaste: null,
  nodeConnected: false,
  sftpClipboard: null,
})

export function getActiveBottomPanelTabId(): string {
  return store.bottomPanelCategory === 'files' ? store.activeFileTabId : store.activeEditorTabId
}

export function getFocusedTabId(): string {
  return store.focusedDock === 'terminal' ? store.activeTerminalTabId : getActiveBottomPanelTabId()
}

export function setBottomPanelActiveTab(tabId: string, category: BottomPanelCategory): void {
  if (category === 'files') store.activeFileTabId = tabId
  else store.activeEditorTabId = tabId
  store.bottomPanelCategory = category
  store.focusedDock = 'bottomPanel'
}
