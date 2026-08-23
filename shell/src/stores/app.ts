import { reactive } from 'vue'
import type { HostProfile } from '../proto/photon_pb'
import type { CommandContext } from '../services/context'

export type View = 'welcome' | 'shell'
export type ShellState = 'idle' | 'connecting' | 'online' | 'error'

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
}

export interface AppState {
  view: View
  token: string
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
  panelOpen: boolean
  pairingModalOpen: boolean
  connectionModalOpen: boolean
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
  token: '',
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
  panelOpen: true,
  pairingModalOpen: false,
  connectionModalOpen: false,
  editingHostId: '',
  insertAfterTabId: '',
  deleteConfirmOpen: false,
  deleteConfirmIds: [],
  terminalSessionInfo: null,
  manualPaste: null,
  nodeConnected: false,
})
