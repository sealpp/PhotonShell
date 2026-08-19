import { reactive } from 'vue'
import type { HostProfile } from '../proto/photon_pb'

export type View = 'pairing' | 'host-form' | 'shell'

export interface AppState {
  view: View
  token: string
  pin: string
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
}

export const store = reactive<AppState>({
  view: 'pairing',
  token: '',
  pin: '',
  deviceName: 'PhotonShell PWA',
  error: '',
  hosts: [],
  selectedHostId: '',
  shellState: 'idle',
  shellError: '',
  streamId: 0,
  sessionId: '',
  telemetry: null,
})
