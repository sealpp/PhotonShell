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
  panelOpen: boolean
  pairingModalOpen: boolean
  connectionModalOpen: boolean
  editingHostId: string
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
  panelOpen: true,
  pairingModalOpen: false,
  connectionModalOpen: false,
  editingHostId: '',
})
