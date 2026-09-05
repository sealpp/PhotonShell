import { reactive } from 'vue'
import type { CommandContext } from '../services/context'

export type View = 'welcome' | 'shell'
export type ShellState = 'idle' | 'connecting' | 'online' | 'error'

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
  hostId: string
  label: string
  state: ShellState
  error: string
  streamId: number
  sessionId: string
  terminalId: string
  telemetry: Telemetry | null
  encoding: string
  afterTabId?: string
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
  activeTabId: string
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
}

export const store = reactive<AppState>({
  view: 'welcome',
  identityLoaded: false,
  paired: false,
  deviceId: '',
  deviceName: 'PhotonShell PWA',
  error: '',
  hosts: [],
  folders: [],
  tabs: [],
  activeTabId: '',
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
})
