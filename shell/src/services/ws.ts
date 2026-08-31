import { randomId } from '../utils/id'
import { store, type HostProfile, type ShellState, type Tab } from '../stores/app'
import {
  deleteHosts as deleteStoredHosts,
  listHosts as listStoredHosts,
  saveHost,
} from './storage'
import {
  initializeVault,
  loadCredentialRecord,
} from './vault'
import {
  closeExec as closeSshExec,
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

export interface AddTabOptions {
  allowLoginDialog?: boolean
}

export function addTab(host: HostProfile, password: string, insertAfterTabId?: string, options?: AddTabOptions): Tab {
  const tabId = randomId()
  const sessionId = randomId()
  const terminalId = randomId()
  const tab: Tab = {
    id: tabId,
    hostId: host.id,
    label: host.name ?? '',
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
  void startTab(tab, host, password, options)
  return tab
}

export function reconnectTab(tab: Tab, host: HostProfile, password: string, options?: AddTabOptions): Tab | undefined {
  const reactiveTab = store.tabs.find((item) => item.id === tab.id)
  if (!reactiveTab) return undefined
  if (reactiveTab.streamId) {
    setTerminalOutputHandler(reactiveTab.streamId, null)
    outputHandlers.delete(reactiveTab.streamId)
    pendingOutput.delete(reactiveTab.streamId)
  }
  void closeSsh(reactiveTab.sessionId)
  reactiveTab.state = 'connecting'
  reactiveTab.error = ''
  reactiveTab.telemetry = null
  reactiveTab.sessionId = randomId()
  reactiveTab.streamId = 0
  void startTab(reactiveTab, host, password, options)
  return reactiveTab
}

const AUTH_ERROR_PATTERN = /authentication|authenticate|permission\s*denied|too\s*many\s*authentication|invalid\s*credentials|no\s+supported\s+methods\s+remain|no\s+remaining\s+authentication\s+methods/i

function isAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERN.test(message)
}

function isSavedHost(host: HostProfile): boolean {
  return store.hosts.some((item) => item.id === host.id)
}

function openLoginDialog(host: HostProfile, error: string, tabId = '', insertAfterTabId = ''): void {
  store.loginDialogHostId = host.id
  store.loginDialogTabId = tabId
  store.loginDialogError = error
  store.loginDialogInsertAfterTabId = insertAfterTabId
  store.loginDialogOpen = true
}

async function getSavedCredential(hostId: string): Promise<string | undefined> {
  const saved = await loadCredentialRecord(hostId)
  if (!saved) return undefined
  return saved.password ?? ''
}

export async function connectHost(host: HostProfile, insertAfterTabId?: string): Promise<void> {
  try {
    const credential = await getSavedCredential(host.id)
    if (credential === undefined) {
      openLoginDialog(host, '', '', insertAfterTabId)
      return
    }
    addTab(host, credential, insertAfterTabId)
  } catch (error) {
    store.error = error instanceof Error ? error.message : String(error)
  }
}

export async function connectHostForTab(tab: Tab): Promise<void> {
  const host = store.hosts.find((item) => item.id === tab.hostId)
  if (!host) return
  try {
    const credential = await getSavedCredential(host.id)
    if (credential === undefined) {
      openLoginDialog(host, '', tab.id)
      return
    }
    reconnectTab(tab, host, credential)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    store.error = message
    updateTabState(tab.sessionId, 'error', message)
  }
}

async function startTab(tab: Tab, host: HostProfile, password: string, options?: AddTabOptions): Promise<void> {
  const { allowLoginDialog = true } = options ?? {}
  try {
    let credential = password
    if (!credential) {
      const saved = await loadCredentialRecord(host.id)
      if (saved) {
        credential = saved.password ?? ''
      }
    }
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
    if (store.loginDialogOpen && store.loginDialogHostId === host.id) {
      store.loginDialogOpen = false
      store.loginDialogError = ''
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    updateTabState(tab.sessionId, 'error', message)
    if (allowLoginDialog && isSavedHost(host) && isAuthError(message)) {
      openLoginDialog(host, message, tab.id)
    } else if (store.loginDialogOpen && store.loginDialogHostId === host.id) {
      store.loginDialogError = message
    }
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

export function closeExec(sessionId: string): Promise<void> {
  return closeSshExec(sessionId)
}
