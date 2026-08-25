import { randomId } from '../utils/id'
import { store, type HostProfile, type ShellState, type Tab } from '../stores/app'
import {
  deleteHosts as deleteStoredHosts,
  listHosts as listStoredHosts,
  saveHost,
} from './storage'
import {
  initializeVault,
  isVaultUnlocked,
  loadCredentialRecord,
  saveCredentialRecord,
} from './vault'
import {
  closeSsh,
  connectSsh,
  exec as runExec,
  getSshSession,
  resize as resizeSsh,
  sendInput,
} from './ssh'
import { nodeClient, type NodeCallbacks } from './nodeClient'

const outputHandlers = new Map<number, (data: Uint8Array) => void>()
const pendingOutput = new Map<number, Uint8Array[]>()

export interface ExecResult {
  stdout: Uint8Array
  stderr: Uint8Array
  exitCode: number
}

export async function initializePwa(): Promise<void> {
  await nodeClient.initializeIdentity()
  await initializeVault()
  store.vaultUnlocked = isVaultUnlocked()
  store.hosts = await listStoredHosts()
}

export function wsUrl(): string {
  return nodeClient.wsUrl()
}

export function setNodeDisconnectedHandler(handler: (() => void) | undefined): void {
  nodeClient.setDisconnectedHandler(handler)
}

export function clearAuth(): void {
  nodeClient.clearPairing()
  store.paired = false
  store.nodeConnected = false
}

export function disconnectNode(): void {
  nodeClient.disconnect()
}

export async function pair(pairingCode: string, callbacks: NodeCallbacks = {}): Promise<void> {
  try {
    await nodeClient.pair(pairingCode, callbacks)
    store.error = ''
    store.pairingModalOpen = false
    await listHosts()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.error = message
    callbacks.onError?.(message)
    throw error
  }
}

export async function connect(callbacks: NodeCallbacks = {}): Promise<void> {
  try {
    await nodeClient.connect(callbacks)
    store.error = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.nodeConnected = false
    store.error = message
    callbacks.onError?.(message)
    throw error
  }
}

export async function listHosts(): Promise<void> {
  store.hosts = await listStoredHosts()
}

export async function createHost(host: HostProfile): Promise<void> {
  await saveHost(host)
  const current = store.hosts.findIndex((item) => item.id === host.id)
  if (current === -1) store.hosts.push(host)
  else store.hosts[current] = host
}

export async function deleteHosts(hostIds: string[]): Promise<void> {
  if (!hostIds.length) return
  await deleteStoredHosts(hostIds)
  const deleted = new Set(hostIds)
  store.hosts = store.hosts.filter((host) => !deleted.has(host.id))
  store.selectedHostIds = new Set(
    Array.from(store.selectedHostIds).filter((id) => !deleted.has(id)),
  )
}

export function setTerminalOutputHandler(
  streamId: number,
  handler: ((data: Uint8Array) => void) | null,
): void {
  if (!handler) {
    outputHandlers.delete(streamId)
    pendingOutput.delete(streamId)
    return
  }
  outputHandlers.set(streamId, handler)
  const buffered = pendingOutput.get(streamId)
  pendingOutput.delete(streamId)
  for (const data of buffered ?? []) handler(data)
}

function emitTerminalOutput(streamId: number, data: Uint8Array): void {
  const handler = outputHandlers.get(streamId)
  if (handler) {
    handler(data)
    return
  }
  const buffered = pendingOutput.get(streamId) ?? []
  const total = buffered.reduce((sum, item) => sum + item.length, 0)
  if (total + data.length <= 1024 * 1024) {
    buffered.push(data.slice())
    pendingOutput.set(streamId, buffered)
  }
}

export function addTab(host: HostProfile, password: string, insertAfterTabId?: string): void {
  const tabId = randomId()
  const sessionId = randomId()
  const terminalId = randomId()
  const tab: Tab = {
    id: tabId,
    hostId: host.id,
    label: host.address,
    state: 'connecting',
    error: '',
    streamId: 0,
    sessionId,
    terminalId,
    telemetry: null,
    encoding: 'utf-8',
  }

  if (insertAfterTabId) {
    const index = store.tabs.findIndex((item) => item.id === insertAfterTabId)
    if (index >= 0) store.tabs.splice(index + 1, 0, tab)
    else store.tabs.push(tab)
  } else {
    store.tabs.push(tab)
  }
  store.activeTabId = tabId
  store.view = 'shell'
  store.connectionModalOpen = false
  store.editingHostId = ''
  void startTab(tab, host, password)
}

async function startTab(tab: Tab, host: HostProfile, password: string): Promise<void> {
  try {
    let credential = password
    if (!credential) {
      const saved = await loadCredentialRecord(host.id)
      credential = saved?.password ?? ''
    }
    if (!credential) throw new Error('请输入 SSH 密码，或先保存凭据')
    await saveCredentialRecord(host.id, { password: credential })

    const reactiveTab = store.tabs.find((item) => item.id === tab.id)
    if (!reactiveTab) throw new Error('tab not found in reactive store')

    const initialOutput: Uint8Array[] = []
    const connection = await connectSsh(
      {
        sessionId: reactiveTab.sessionId,
        host: host.address,
        port: host.port,
        username: host.username,
        password: credential,
      },
      (state, error) => updateTabState(reactiveTab.sessionId, state, error),
      (data) => {
        if (!reactiveTab.streamId) initialOutput.push(data.slice())
        else emitTerminalOutput(reactiveTab.streamId, data)
      },
    )
    reactiveTab.streamId = connection.streamId
    for (const data of initialOutput) emitTerminalOutput(reactiveTab.streamId, data)
    updateTabState(reactiveTab.sessionId, 'online')
  } catch (error) {
    updateTabState(tab.sessionId, 'error', error instanceof Error ? error.message : String(error))
  }
}

function updateTabState(sessionId: string, state: ShellState, error = ''): void {
  const tab = store.tabs.find((item) => item.sessionId === sessionId)
  if (!tab) return
  tab.state = state
  tab.error = error
  if (state === 'idle' || state === 'error') {
    tab.telemetry = null
    if (tab.id === store.activeTabId) store.telemetry = null
  }
}

export function closeTab(tabId: string): void {
  closeTabs([tabId])
}

export function closeTabs(tabIds: string[]): void {
  const closing = new Set(tabIds)
  const tabsToClose = store.tabs.filter((tab) => closing.has(tab.id))
  if (!tabsToClose.length) return

  const activeTabId = store.activeTabId
  const activeIndex = store.tabs.findIndex((tab) => tab.id === activeTabId)
  store.tabs = store.tabs.filter((tab) => !closing.has(tab.id))
  for (const tab of tabsToClose) {
    if (tab.streamId) {
      outputHandlers.delete(tab.streamId)
      pendingOutput.delete(tab.streamId)
    }
    void closeSsh(tab.sessionId)
  }

  if (activeTabId && !closing.has(activeTabId) && store.tabs.some((tab) => tab.id === activeTabId)) return
  const next = store.tabs[activeIndex] || store.tabs[activeIndex - 1] || store.tabs[0]
  store.activeTabId = next?.id ?? ''
  store.telemetry = next?.telemetry ?? null
  if (!store.activeTabId) {
    store.view = 'welcome'
    store.telemetry = null
  }
}

export function sendTerminalInput(streamId: number, payload: Uint8Array): void {
  const tab = store.tabs.find((item) => item.streamId === streamId)
  if (tab) void sendInput(tab.sessionId, payload).catch((error) => {
    updateTabState(tab.sessionId, 'error', error instanceof Error ? error.message : String(error))
  })
}

export function resizeTerminal(terminalId: string, columns: number, rows: number): void {
  const tab = store.tabs.find((item) => item.terminalId === terminalId)
  if (tab) void resizeSsh(tab.sessionId, columns, rows)
}

export async function exec(sessionId: string, command: string): Promise<ExecResult> {
  const session = getSshSession(sessionId)
  if (!session) throw new Error('SSH session is unavailable')
  return runExec(session, command)
}
