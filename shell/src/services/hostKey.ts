import { store } from '../stores/app'

export interface HostKeyPromptState {
  host: string
  port: number
  fingerprint: string
}

let pending: ((accepted: boolean) => void) | undefined

export function requestHostKeyApproval(prompt: HostKeyPromptState): Promise<boolean> {
  if (pending) return Promise.reject(new Error('another host key prompt is active'))
  store.hostKeyPrompt = prompt
  return new Promise((resolve) => {
    pending = resolve
  })
}

export function respondHostKeyApproval(accepted: boolean): void {
  const resolve = pending
  pending = undefined
  store.hostKeyPrompt = null
  resolve?.(accepted)
}
