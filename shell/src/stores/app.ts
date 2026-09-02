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
  tabs: Tab[]
  activeTabId: string
  selectedHostIds: Set<string>
  selectionAnchor: string
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
  tabs: [],
  activeTabId: '',
  selectedHostIds: new Set(),
  selectionAnchor: '',
  telemetry: null,
  sidebarOpen: true,
  sidebarView: 'connections',
  sidebarWidth: 220,
  panelOpen: true,
  panelWidth: 280,
  pairingModalOpen: false,
  connectionModalOpen: false,
  loginDialogOpen: false,
  settingsModalOpen: false,
  aboutModalOpen: false,
  loginDialogHostId: '',
  loginDialogTabId: '',
  loginDialogError: '',
  loginDialogInsertAfterTabId: '',
  hostKeyPrompt: null,
  editingHostId: '',
  insertAfterTabId: '',
  deleteConfirmOpen: false,
  deleteConfirmIds: [],
  terminalSessionInfo: null,
  manualPaste: null,
  nodeConnected: false,
})
