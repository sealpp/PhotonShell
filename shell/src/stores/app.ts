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
}

export const store = reactive<AppState>({
  view: 'pairing',
  token: '',
  pin: '',
  deviceName: 'PhotonShell PWA',
  error: '',
  hosts: [],
  selectedHostId: '',
})
