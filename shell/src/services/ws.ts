import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  HostCreateRequestSchema,
  HostDeleteRequestSchema,
  HostListRequestSchema,
  NodeHelloSchema,
  PairBeginSchema,
  PhotonMessageSchema,
  PtyOptionsSchema,
  SessionConnectRequestSchema,
  SessionDisconnectRequestSchema,
  ExecRequestSchema,
  TerminalCloseRequestSchema,
  TerminalInputSchema,
  TerminalOpenRequestSchema,
  TerminalResizeRequestSchema,
  type HostProfile,
  type PhotonMessage,
} from '../proto/photon_pb'
import { store, type ShellState, type Tab } from '../stores/app'
import { randomId } from '../utils/id'

const TOKEN_KEY = 'photon:token'
const DEVICE_ID_KEY = 'photon:deviceId'

function generateDeviceId(): string {
  if (typeof window !== 'undefined' && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID()
  }
  return randomId()
}

function loadPersistedAuth(): void {
  const token = localStorage.getItem(TOKEN_KEY)
  const deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (token) store.token = token
  if (deviceId) store.deviceId = deviceId
}

function persistAuth(token: string, deviceId: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  if (deviceId) localStorage.setItem(DEVICE_ID_KEY, deviceId)
}

export function clearAuth(): void {
  store.token = ''
  store.deviceId = ''
  store.nodeConnected = false
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(DEVICE_ID_KEY)
}

export function disconnectNode(): void {
  closeExistingSocket()
  clearAuth()
}

function ensureDeviceId(): void {
  if (!store.deviceId) {
    store.deviceId = generateDeviceId()
    localStorage.setItem(DEVICE_ID_KEY, store.deviceId)
  }
}

export function wsUrl(): string {
  return `ws://${window.location.hostname}:17373`
}

// Restore any persisted token/device on module load.
loadPersistedAuth()
ensureDeviceId()

let ws: WebSocket | null = null
let reqId = 0
const pendingDeletes = new Map<string, string[]>()
const pendingExecs = new Map<string, {
  resolve: (result: ExecResult) => void
  reject: (error: Error) => void
}>()
const outputHandlers = new Map<number, (data: Uint8Array) => void>()

export interface ExecResult {
  stdout: Uint8Array
  stderr: Uint8Array
  exitCode: number
}

function nextReqId(): string {
  return `req-${++reqId}`
}

function send(msg: PhotonMessage): boolean {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(toBinary(PhotonMessageSchema, msg))
    return true
  }
  return false
}

export function setTerminalOutputHandler(
  streamId: number,
  handler: ((data: Uint8Array) => void) | null,
): void {
  if (handler) {
    outputHandlers.set(streamId, handler)
  } else {
    outputHandlers.delete(streamId)
  }
}

function sendHello(): void {
  const token = store.token
  if (!token) return
  const hello = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token,
    body: {
      case: 'nodeHello',
      value: create(NodeHelloSchema, { pwaVersion: '0.1.0' }),
    },
  })
  send(hello)
}

export interface WsCallbacks {
  onError: (msg: string) => void
}

function rejectPendingExecs(message: string): void {
  for (const pending of pendingExecs.values()) {
    pending.reject(new Error(message))
  }
  pendingExecs.clear()
}

function closeExistingSocket(): void {
  rejectPendingExecs('Node connection closed')
  if (ws) {
    try {
      ws.close()
    } catch {
      // ignore
    }
    ws = null
  }
}

function handleMessage(resp: PhotonMessage, callbacks?: WsCallbacks): void {
  const body = resp.body.case

  if (body === 'pairSucceeded') {
    store.token = resp.body.value.token
    persistAuth(store.token, store.deviceId)
    sendHello()
  } else if (body === 'nodeHelloAck') {
    store.pairingModalOpen = false
    store.view = 'welcome'
    listHosts()
  } else if (body === 'hostListResponse') {
    store.hosts = resp.body.value.hosts as HostProfile[]
  } else if (body === 'hostDeleteResponse') {
    const ids = pendingDeletes.get(resp.requestId)
    pendingDeletes.delete(resp.requestId)
    const deleted = new Set(ids ?? [])
    store.hosts = store.hosts.filter((h) => !deleted.has(h.id))
    store.selectedHostIds = new Set(
      Array.from(store.selectedHostIds).filter((id) => !deleted.has(id)),
    )
  } else if (body === 'sessionStateEvent') {
    const evt = resp.body.value
    const tab = store.tabs.find((t) => t.sessionId === evt.sessionId)
    if (tab) {
      tab.state = evt.state as ShellState
      tab.error = evt.error || ''
      if (tab.state === 'idle' || tab.state === 'error') {
        tab.telemetry = null
        if (tab.id === store.activeTabId) {
          store.telemetry = null
        }
      }
    }
  } else if (body === 'terminalOpenedEvent') {
    const evt = resp.body.value
    const tab = store.tabs.find((t) => t.terminalId === evt.terminalId)
    if (tab) {
      tab.streamId = evt.streamId
      tab.sessionId = evt.sessionId
    }
  } else if (body === 'terminalOutput') {
    const out = resp.body.value
    const handler = outputHandlers.get(out.streamId)
    if (handler) {
      handler(out.payload)
    }
  } else if (body === 'execResponse') {
    const pending = pendingExecs.get(resp.requestId)
    if (pending) {
      pendingExecs.delete(resp.requestId)
      const result = resp.body.value
      pending.resolve({
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      })
    }
  } else if (body === 'requestFailed') {
    pendingDeletes.delete(resp.requestId)
    const err = resp.body.value.error
    store.error = `${err?.code ?? 'unknown'}: ${err?.message ?? ''}`
    const pending = pendingExecs.get(resp.requestId)
    if (pending) {
      pendingExecs.delete(resp.requestId)
      pending.reject(new Error(store.error))
    }
    if (err?.code === 'invalid_token') {
      clearAuth()
      store.pairingModalOpen = true
    }
    callbacks?.onError(store.error)
  }
}

export function connect(token: string, callbacks?: WsCallbacks): void {
  closeExistingSocket()
  ws = new WebSocket(wsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    store.token = token
    store.nodeConnected = true
    sendHello()
  }

  ws.onmessage = (event: MessageEvent) => {
    const data = new Uint8Array(event.data as ArrayBuffer)
    const resp = fromBinary(PhotonMessageSchema, data)
    handleMessage(resp, callbacks)
  }

  ws.onerror = () => {
    rejectPendingExecs('Node connection error')
    store.nodeConnected = false
    store.error = 'WebSocket error'
    callbacks?.onError(store.error)
  }

  ws.onclose = () => {
    rejectPendingExecs('Node connection closed')
    store.nodeConnected = false
    store.error = store.error || 'WebSocket closed'
    callbacks?.onError(store.error)
  }
}

export function pair(pin: string, callbacks: WsCallbacks): void {
  closeExistingSocket()
  ws = new WebSocket(wsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    store.nodeConnected = true
    ensureDeviceId()
    const msg = create(PhotonMessageSchema, {
      protocolVersion: 0,
      requestId: nextReqId(),
      body: {
        case: 'pairBegin',
        value: create(PairBeginSchema, {
          pin,
          deviceName: store.deviceName,
          deviceId: store.deviceId,
        }),
      },
    })
    send(msg)
  }

  ws.onmessage = (event: MessageEvent) => {
    const data = new Uint8Array(event.data as ArrayBuffer)
    const resp = fromBinary(PhotonMessageSchema, data)
    handleMessage(resp, callbacks)
  }

  ws.onerror = () => {
    rejectPendingExecs('Node connection error')
    store.nodeConnected = false
    store.error = 'WebSocket error'
    callbacks.onError(store.error)
  }

  ws.onclose = () => {
    rejectPendingExecs('Node connection closed')
    store.nodeConnected = false
    store.error = store.error || 'WebSocket closed'
    callbacks.onError(store.error)
  }
}

export function listHosts(): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'hostListRequest',
      value: create(HostListRequestSchema, {}),
    },
  })
  send(msg)
}

export function createHost(host: HostProfile): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'hostCreateRequest',
      value: create(HostCreateRequestSchema, { host }),
    },
  })
  send(msg)
}

export function deleteHosts(hostIds: string[]): void {
  if (!store.token || !hostIds.length) return
  const requestId = nextReqId()
  pendingDeletes.set(requestId, hostIds)
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId,
    token: store.token,
    body: {
      case: 'hostDeleteRequest',
      value: create(HostDeleteRequestSchema, { hostIds }),
    },
  })
  send(msg)
}

export function addTab(host: HostProfile, password: string, insertAfterTabId?: string): void {
  if (!store.token) return
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
    const idx = store.tabs.findIndex((t) => t.id === insertAfterTabId)
    if (idx !== -1) {
      store.tabs.splice(idx + 1, 0, tab)
    } else {
      store.tabs.push(tab)
    }
  } else {
    store.tabs.push(tab)
  }

  store.activeTabId = tabId
  store.view = 'shell'
  store.connectionModalOpen = false
  store.editingHostId = ''

  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'sessionConnectRequest',
      value: create(SessionConnectRequestSchema, { hostId: host.id, password, sessionId }),
    },
  })
  send(msg)
}

export function closeTab(tabId: string): void {
  closeTabs([tabId])
}

export function closeTabs(tabIds: string[]): void {
  const closingIds = new Set(tabIds)
  const tabsToClose = store.tabs.filter((tab) => closingIds.has(tab.id))
  if (!tabsToClose.length) return

  const activeTabId = store.activeTabId
  const activeIndex = store.tabs.findIndex((tab) => tab.id === activeTabId)
  const remainingTabs = store.tabs.filter((tab) => !closingIds.has(tab.id))
  store.tabs.splice(0, store.tabs.length, ...remainingTabs)

  for (const tab of tabsToClose) {
    if (tab.streamId) {
      setTerminalOutputHandler(tab.streamId, null)
    }
    disconnectSession(tab.sessionId)
  }

  if (activeTabId && !closingIds.has(activeTabId) && store.tabs.some((tab) => tab.id === activeTabId)) {
    return
  }

  const next = store.tabs[activeIndex] || store.tabs[activeIndex - 1] || store.tabs[0]
  store.activeTabId = next?.id ?? ''
  store.telemetry = next?.telemetry ?? null
  if (!store.activeTabId) {
    store.view = 'welcome'
    store.telemetry = null
  }
}

function disconnectSession(sessionId: string, reason: string = ''): void {
  if (!store.token || !sessionId) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'sessionDisconnectRequest',
      value: create(SessionDisconnectRequestSchema, { sessionId, reason }),
    },
  })
  send(msg)
}

export function openTerminal(sessionId: string, terminalId: string, columns: number, rows: number): void {
  if (!store.token || !sessionId) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'terminalOpenRequest',
      value: create(TerminalOpenRequestSchema, {
        sessionId,
        terminalId,
        pty: create(PtyOptionsSchema, {
          term: 'xterm-256color',
          columns,
          rows,
        }),
      }),
    },
  })
  send(msg)
}

export function sendTerminalInput(streamId: number, payload: Uint8Array): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'terminalInput',
      value: create(TerminalInputSchema, { streamId, sequence: 0n, payload }),
    },
  })
  send(msg)
}

export function resizeTerminal(terminalId: string, columns: number, rows: number): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'terminalResizeRequest',
      value: create(TerminalResizeRequestSchema, {
        terminalId,
        pty: create(PtyOptionsSchema, {
          term: 'xterm-256color',
          columns,
          rows,
        }),
      }),
    },
  })
  send(msg)
}

export function closeTerminal(terminalId: string): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'terminalCloseRequest',
      value: create(TerminalCloseRequestSchema, { terminalId }),
    },
  })
  send(msg)
}

export function exec(sessionId: string, command: string): Promise<ExecResult> {
  if (!store.token || !sessionId) {
    return Promise.reject(new Error('Node session is unavailable'))
  }

  const requestId = nextReqId()
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId,
    token: store.token,
    body: {
      case: 'execRequest',
      value: create(ExecRequestSchema, { sessionId, command }),
    },
  })

  return new Promise((resolve, reject) => {
    pendingExecs.set(requestId, { resolve, reject })
    if (!send(msg)) {
      pendingExecs.delete(requestId)
      reject(new Error('Node is not connected'))
    }
  })
}


