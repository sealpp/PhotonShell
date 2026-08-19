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
import { store } from '../stores/app'

export function wsUrl(): string {
  return `ws://${window.location.hostname}:17373`
}

let ws: WebSocket | null = null
let reqId = 0
let _onOutput: ((data: Uint8Array) => void) | null = null
const pendingDeletes = new Map<string, string[]>()

function nextReqId(): string {
  return `req-${++reqId}`
}

function send(msg: PhotonMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(toBinary(PhotonMessageSchema, msg))
  }
}

export function setTerminalOutputHandler(handler: ((data: Uint8Array) => void) | null): void {
  _onOutput = handler
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

export function pair(pin: string, callbacks: WsCallbacks): void {
  ws = new WebSocket(wsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    const msg = create(PhotonMessageSchema, {
      protocolVersion: 0,
      requestId: nextReqId(),
      body: {
        case: 'pairBegin',
        value: create(PairBeginSchema, { pin, deviceName: store.deviceName }),
      },
    })
    send(msg)
  }

  ws.onmessage = (event: MessageEvent) => {
    const data = new Uint8Array(event.data as ArrayBuffer)
    const resp = fromBinary(PhotonMessageSchema, data)
    const body = resp.body.case

    if (body === 'pairSucceeded') {
      store.token = resp.body.value.token
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
        Array.from(store.selectedHostIds).filter((id) => !deleted.has(id))
      )
      if (store.selectedHostId && deleted.has(store.selectedHostId)) {
        store.selectedHostId = ''
        store.view = 'welcome'
        store.shellState = 'idle'
        store.shellError = ''
        store.streamId = 0
        store.sessionId = ''
        store.telemetry = null
      }
    } else if (body === 'sessionStateEvent') {
      const evt = resp.body.value
      store.shellState = evt.state as 'idle' | 'connecting' | 'online' | 'error'
      store.shellError = evt.error || ''
      if (store.shellState === 'error') {
        store.error = store.shellError || 'session error'
      }
    } else if (body === 'terminalOpenedEvent') {
      const evt = resp.body.value
      store.streamId = evt.streamId
      store.sessionId = evt.sessionId
    } else if (body === 'terminalOutput') {
      if (_onOutput) {
        _onOutput(resp.body.value.payload)
      }
    } else if (body === 'telemetrySnapshot') {
      const snap = resp.body.value
      store.telemetry = {
        cpu: snap.cpuPercent?.value?.case === 'number' ? snap.cpuPercent.value.value : 0,
        mem: snap.memoryPercent?.value?.case === 'number' ? snap.memoryPercent.value.value : 0,
        disk: snap.diskPercent?.value?.case === 'number' ? snap.diskPercent.value.value : 0,
        procs: snap.processCount,
      }
    } else if (body === 'requestFailed') {
      pendingDeletes.delete(resp.requestId)
      const err = resp.body.value.error
      store.error = `${err?.code ?? 'unknown'}: ${err?.message ?? ''}`
      callbacks.onError(store.error)
    }
  }

  ws.onerror = () => {
    store.error = 'WebSocket error'
    callbacks.onError(store.error)
  }

  ws.onclose = () => {
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

export function connectToHost(hostId: string, password: string): void {
  if (!store.token) return
  store.selectedHostId = hostId
  store.connectionModalOpen = false
  store.view = 'shell'
  store.shellState = 'connecting'
  store.shellError = ''
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'sessionConnectRequest',
      value: create(SessionConnectRequestSchema, { hostId, password }),
    },
  })
  send(msg)
}

export function disconnectHost(reason: string = ''): void {
  if (!store.token || !store.selectedHostId) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'sessionDisconnectRequest',
      value: create(SessionDisconnectRequestSchema, {
        hostId: store.selectedHostId,
        reason,
      }),
    },
  })
  send(msg)
  store.shellState = 'idle'
  store.shellError = ''
  store.streamId = 0
  store.sessionId = ''
  store.telemetry = null
}

export function openTerminal(terminalId: string, columns: number, rows: number): void {
  if (!store.token || !store.selectedHostId) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'terminalOpenRequest',
      value: create(TerminalOpenRequestSchema, {
        hostId: store.selectedHostId,
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

export function startTelemetry(hostId: string, intervalMs: number = 2000): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'telemetryStartRequest',
      value: create(TelemetryStartRequestSchema, { hostId, intervalMs }),
    },
  })
  send(msg)
}

export function stopTelemetry(hostId: string): void {
  if (!store.token) return
  const msg = create(PhotonMessageSchema, {
    protocolVersion: 0,
    requestId: nextReqId(),
    token: store.token,
    body: {
      case: 'telemetryStopRequest',
      value: create(TelemetryStopRequestSchema, { hostId }),
    },
  })
  send(msg)
}
