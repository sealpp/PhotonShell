import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  HostCreateRequestSchema,
  HostListRequestSchema,
  NodeHelloSchema,
  PairBeginSchema,
  PhotonMessageSchema,
  type HostProfile,
  type PhotonMessage,
} from '../proto/photon_pb'
import { store } from '../stores/app'

function wsUrl(): string {
  return `ws://${window.location.hostname}:17373`
}

let ws: WebSocket | null = null
let reqId = 0

function nextReqId(): string {
  return `req-${++reqId}`
}

function send(msg: PhotonMessage): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(toBinary(PhotonMessageSchema, msg))
  }
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
      const token = resp.body.value.token
      store.token = token
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
    } else if (body === 'nodeHelloAck') {
      store.view = 'host-form'
      listHosts()
    } else if (body === 'hostListResponse') {
      store.hosts = resp.body.value.hosts as HostProfile[]
    } else if (body === 'requestFailed') {
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
    if (store.view !== 'shell') {
      store.error = store.error || 'WebSocket closed'
      callbacks.onError(store.error)
    }
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
