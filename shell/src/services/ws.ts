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
  TelemetryStartRequestSchema,
  TelemetryStopRequestSchema,
  TerminalCloseRequestSchema,
  TerminalInputSchema,
  TerminalOpenRequestSchema,
  TerminalResizeRequestSchema,
  type HostProfile,
  type PhotonMessage,
} from '../proto/photon_pb'
import { store, type ShellState, type Tab, type Telemetry } from '../stores/app'
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
const outputHandlers = new Map<number, (data: Uint8Array) => void>()
const telemetryStarted = new Set<string>()

function nextReqId(): string {
  return `req-${++reqId}`
}

function send(msg: PhotonMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(toBinary(PhotonMessageSchema, msg))
  }
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

function closeExistingSocket(): void {
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
  } else if (body === 'telemetrySnapshot') {
    const snap = resp.body.value
    const telemetry: Telemetry = {
      cpu: snap.cpuPercent?.value?.case === 'number' ? snap.cpuPercent.value.value : 0,
      mem: snap.memoryPercent?.value?.case === 'number' ? snap.memoryPercent.value.value : 0,
      disk: snap.diskPercent?.value?.case === 'number' ? snap.diskPercent.value.value : 0,
      procs: snap.processCount,
    }
    const targetTab = store.tabs.find((t) => t.sessionId === snap.sessionId)
    if (targetTab) {
      targetTab.telemetry = telemetry
      if (targetTab.id === store.activeTabId) {
        store.telemetry = telemetry
      }
    }
  } else if (body === 'requestFailed') {
    pendingDeletes.delete(resp.requestId)
    const err = resp.body.value.error
    store.error = `${err?.code ?? 'unknown'}: ${err?.message ?? ''}`
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
    store.nodeConnected = false
    store.error = 'WebSocket error'
    callbacks?.onError(store.error)
  }

  ws.onclose = () => {
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
    store.nodeConnected = false
    store.error = 'WebSocket error'
    callbacks.onError(store.error)
  }

  ws.onclose = () => {
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
  const idx = store.tabs.findIndex((t) => t.id === tabId)
  if (idx === -1) return
  const tab = store.tabs[idx]
  store.tabs.splice(idx, 1)

  if (tab.streamId) {
    setTerminalOutputHandler(tab.streamId, null)
  }
  stopTelemetry(tab.sessionId)
  disconnectSession(tab.sessionId)

  if (store.activeTabId === tabId) {
    const next = store.tabs[idx] || store.tabs[idx - 1]
    store.activeTabId = next ? next.id : ''
    store.telemetry = next ? next.telemetry : null
    if (!store.activeTabId) {
      store.view = 'welcome'
      store.telemetry = null
    }
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

export function startTelemetry(sessionId: string, intervalMs: number = 2000): void {
  if (!store.token || !sessionId || telemetryStarted.has(sessionId)) return
  telemetryStarted.add(sessionId)
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'telemetryStartRequest',
      value: create(TelemetryStartRequestSchema, { sessionId, intervalMs }),
    },
  })
  send(msg)
}

export function stopTelemetry(sessionId: string): void {
  if (!store.token || !sessionId || !telemetryStarted.has(sessionId)) return
  telemetryStarted.delete(sessionId)
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'telemetryStopRequest',
      value: create(TelemetryStopRequestSchema, { sessionId }),
    },
  })
  send(msg)
}


