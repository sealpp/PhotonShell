import { reactive } from 'vue'
import type { HostProfile } from '../proto/photon_pb'

export type View = 'welcome' | 'shell'
export type ShellState = 'idle' | 'connecting' | 'online' | 'error'

export interface Telemetry {
  cpu: number
  mem: number
  disk: number
  procs: number
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
  settingsMenuOpen: boolean
  deleteConfirmOpen: boolean
  deleteConfirmIds: string[]
  contextMenuOpen: boolean
  contextMenuX: number
  contextMenuY: number
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
  settingsMenuOpen: false,
  deleteConfirmOpen: false,
  deleteConfirmIds: [],
  contextMenuOpen: false,
  contextMenuX: 0,
  contextMenuY: 0,
})
