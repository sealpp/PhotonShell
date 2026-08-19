import { reactive } from 'vue'
import type { HostProfile } from '../proto/photon_pb'

export type View = 'welcome' | 'shell'

export interface AppState {
  view: View
  token: string
  deviceName: string
  error: string
  hosts: HostProfile[]
  selectedHostId: string
  shellState: 'idle' | 'connecting' | 'online' | 'error'
  shellError: string
  streamId: number
  sessionId: string
  telemetry: {
    cpu: number
    mem: number
    disk: number
    procs: number
  } | null
  sidebarOpen: boolean
  sidebarView: 'connections'
  panelOpen: boolean
  pairingModalOpen: boolean
  connectionModalOpen: boolean
  editingHostId: string
  settingsMenuOpen: boolean
  selectedHostIds: Set<string>
  selectionAnchor: string
  deleteConfirmOpen: boolean
  deleteConfirmIds: string[]
  contextMenuOpen: boolean
  contextMenuX: number
  contextMenuY: number
}

export const store = reactive<AppState>({
  view: 'welcome',
  token: '',
  deviceName: 'PhotonShell PWA',
  error: '',
  hosts: [],
  selectedHostId: '',
  shellState: 'idle',
  shellError: '',
  streamId: 0,
  sessionId: '',
  telemetry: null,
  sidebarOpen: true,
  sidebarView: 'connections',
  panelOpen: true,
  pairingModalOpen: false,
  connectionModalOpen: false,
  editingHostId: '',
  settingsMenuOpen: false,
  selectedHostIds: new Set(),
  selectionAnchor: '',
  deleteConfirmOpen: false,
  deleteConfirmIds: [],
  contextMenuOpen: false,
  contextMenuX: 0,
  contextMenuY: 0,
})
