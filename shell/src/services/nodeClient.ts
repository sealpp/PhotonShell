import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  AuthBeginSchema,
  AuthProofSchema,
  PairBeginSchema,
  PairProofSchema,
  PhotonMessageSchema,
  TransportCloseRequestSchema,
  TransportCreditSchema,
  TransportDataSchema,
  TransportHalfCloseRequestSchema,
  TransportOpenRequestSchema,
  type PhotonMessage,
} from '../proto/photon_pb'
import { randomId } from '../utils/id'
import {
  clearIdentity,
  readIdentity,
  saveIdentity,
  type StoredIdentity,
} from './storage'
import { store } from '../stores/app'
import { requireWebCrypto } from './webCrypto'

const PROTOCOL_VERSION = 1
const MAX_DATA_PAYLOAD = 60 * 1024

export interface NodeCallbacks {
  onError?: (message: string) => void
  onDisconnected?: () => void
}

export type TransportKind = 'tcp' | 'udp'

interface PendingRequest {
  resolve: (message: PhotonMessage) => void
  reject: (error: Error) => void
}

interface CreditWaiter {
  amount: number
  resolve: () => void
  reject: (error: Error) => void
}

interface PairChallengeData {
  pairingId: string
  clientNonce: Uint8Array
  devicePublicKey: Uint8Array
  deviceName: string
}

interface AuthChallengeData {
  connectionId: string
  deviceId: string
  clientNonce: Uint8Array
  nodeNonce: Uint8Array
  nodePublicKey: Uint8Array
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) {
    result |= left[index] ^ right[index]
  }
  return result === 0
}

function randomBytes(length: number): Uint8Array {
  const result = new Uint8Array(length)
  requireWebCrypto().getRandomValues(result)
  return result
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

function encodeTranscript(label: string, ...fields: Array<string | Uint8Array>): Uint8Array {
  const encoded = [text(label), ...fields.map((field) => typeof field === 'string' ? text(field) : field)]
  const total = encoded.reduce((sum, value) => sum + 4 + value.length, 0)
  const output = new Uint8Array(total)
  const view = new DataView(output.buffer)
  let offset = 0
  for (const value of encoded) {
    view.setUint32(offset, value.length, false)
    offset += 4
    output.set(value, offset)
    offset += value.length
  }
  return output
}

async function signTranscript(identity: StoredIdentity, transcript: Uint8Array): Promise<Uint8Array> {
  const signature = await requireWebCrypto().subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.devicePrivateKey,
    arrayBuffer(transcript),
  )
  return new Uint8Array(signature)
}

async function verifyNodeSignature(
  nodePublicKey: Uint8Array,
  signature: Uint8Array,
  transcript: Uint8Array,
): Promise<boolean> {
  const key = await requireWebCrypto().subtle.importKey(
    'spki',
    arrayBuffer(nodePublicKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return requireWebCrypto().subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    arrayBuffer(signature),
    arrayBuffer(transcript),
  )
}

function toError(message: PhotonMessage): Error {
  const error = message.body.case === 'transportErrorEvent'
    ? `${message.body.value.code}: ${message.body.value.message}`
    : 'Node request failed'
  return new Error(error)
}

export class NodeTransportStream {
  readonly streamId: number
  readonly kind: TransportKind
  onData: ((payload: Uint8Array) => void) | null = null
  onError: ((error: Error) => void) | null = null
  onClose: (() => void) | null = null

  private inputCredit: number
  private inputSequence = 0n
  private outputSequence = 0n
  private closed = false
  private readonly inputCreditWaiters: CreditWaiter[] = []
  private sendQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly client: NodeClient,
    streamId: number,
    kind: TransportKind,
    inputCredit: number,
  ) {
    this.streamId = streamId
    this.kind = kind
    this.inputCredit = inputCredit
  }

  send(payload: Uint8Array): Promise<void> {
    const task = this.sendQueue.then(() => this.sendNow(payload))
    this.sendQueue = task.then(() => undefined, () => undefined)
    return task
  }

  private async sendNow(payload: Uint8Array): Promise<void> {
    if (this.closed) throw new Error('transport stream is closed')
    for (let offset = 0; offset < payload.length; offset += MAX_DATA_PAYLOAD) {
      const chunk = payload.subarray(offset, offset + MAX_DATA_PAYLOAD)
      await this.waitForInputCredit(chunk.length)
      this.inputCredit -= chunk.length
      this.drainInputCreditWaiters()
      const message = create(PhotonMessageSchema, {
        protocolVersion: PROTOCOL_VERSION,
        requestId: '',
        body: {
          case: 'transportData',
          value: create(TransportDataSchema, {
            streamId: this.streamId,
            sequence: this.inputSequence,
            payload: chunk,
          }),
        },
      })
      this.inputSequence += 1n

      try {
        this.client.sendMessage(message)
      } catch (error) {
        this.inputCredit += chunk.length
        this.drainInputCreditWaiters()
        throw error
      }
    }
  }

  async halfClose(): Promise<void> {
    if (this.closed) return
    this.client.sendMessage(create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: '',
      body: {
        case: 'transportHalfCloseRequest',
        value: create(TransportHalfCloseRequestSchema, { streamId: this.streamId }),
      },
    }))
  }

  async close(reason = ''): Promise<void> {
    if (this.closed) return
    this.closed = true
    try {
      this.client.sendMessage(create(PhotonMessageSchema, {
        protocolVersion: PROTOCOL_VERSION,
        requestId: '',
        body: {
          case: 'transportCloseRequest',
          value: create(TransportCloseRequestSchema, { streamId: this.streamId, reason }),
        },
      }))
    } finally {
      this.client.removeStream(this.streamId)
    }
  }

  receive(sequence: bigint, payload: Uint8Array): void {
    if (this.closed) return
    if (sequence !== this.outputSequence) {
      const error = new Error('transport sequence is not increasing')
      this.onError?.(error)
      void this.close('sequence_error')
      return
    }
    this.outputSequence += 1n
    try {
      this.onData?.(payload)
    } finally {
      try {
        this.client.sendCredit(this.streamId, 'output', payload.length)
      } catch {
        this.finish()
      }
    }
  }

  receiveInputCredit(amount: number): void {
    if (amount <= 0) return
    this.inputCredit += amount
    this.drainInputCreditWaiters()
  }

  private drainInputCreditWaiters(): void {
    const waiter = this.inputCreditWaiters[0]
    if (waiter && this.inputCredit >= waiter.amount) {
      this.inputCreditWaiters.shift()
      waiter.resolve()
    }
  }

  finish(): void {
    if (this.closed) return
    this.closed = true
    this.client.removeStream(this.streamId)
    const error = new Error('transport stream is closed')
    for (const waiter of this.inputCreditWaiters.splice(0)) waiter.reject(error)
    this.onClose?.()
  }

  fail(error: Error): void {
    if (this.closed) return
    this.onError?.(error)
    this.finish()
  }

  private waitForInputCredit(amount: number): Promise<void> {
    if (this.closed) return Promise.reject(new Error('transport stream is closed'))
    if (this.inputCredit >= amount) return Promise.resolve()
    return new Promise((resolve, reject) => {
      this.inputCreditWaiters.push({ amount, resolve, reject })
    })
  }
}

export class NodeClient {
  private socket: WebSocket | null = null
  private identity: StoredIdentity | undefined
  private requestCounter = 0
  private readonly pending = new Map<string, PendingRequest>()
  private readonly streams = new Map<number, NodeTransportStream>()
  private callbacks: NodeCallbacks = {}
  private disconnectedHandler: (() => void) | undefined
  private authenticated = false
  private socketReady: Promise<void> | undefined
  private socketReadyResolve: (() => void) | undefined
  private socketReadyReject: ((error: Error) => void) | undefined

  setDisconnectedHandler(handler: (() => void) | undefined): void {
    this.disconnectedHandler = handler
  }

  async initializeIdentity(): Promise<void> {
    this.identity = await readIdentity()
    store.identityLoaded = true
    store.deviceId = this.identity?.deviceId ?? ''
    store.deviceName = this.identity?.deviceName ?? 'PhotonShell PWA'
    store.paired = Boolean(this.identity?.nodeId && this.identity?.nodePublicKey)
    store.vaultUnlocked = false
  }

  async pair(pairingCode: string, callbacks: NodeCallbacks = {}): Promise<void> {
    this.callbacks = callbacks
    requireWebCrypto()
    const identity = await this.ensureIdentity()
    await this.openSocket()

    const clientNonce = randomBytes(32)
    const pairRequestId = this.nextRequestId()
    const begin = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: pairRequestId,
      body: {
        case: 'pairBegin',
        value: create(PairBeginSchema, {
          pairingCode,
          deviceId: identity.deviceId,
          deviceName: identity.deviceName,
          devicePublicKey: new Uint8Array(identity.devicePublicKey),
          clientNonce,
        }),
      },
    })
    const challenge = await this.request(begin)
    if (challenge.body.case !== 'pairChallenge') {
      throw new Error('unexpected Node pairing response')
    }

    const challengeData: PairChallengeData = {
      pairingId: challenge.body.value.pairingId,
      clientNonce,
      devicePublicKey: new Uint8Array(identity.devicePublicKey),
      deviceName: identity.deviceName,
    }
    const transcript = encodeTranscript(
      'PHOTON-PAIR-1',
      String(PROTOCOL_VERSION),
      challengeData.pairingId,
      identity.deviceId,
      challengeData.deviceName,
      challengeData.devicePublicKey,
      challenge.body.value.nodeId,
      challenge.body.value.nodePublicKey,
      challengeData.clientNonce,
      challenge.body.value.nodeNonce,
    )
    const proof = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextRequestId(),
      body: {
        case: 'pairProof',
        value: create(PairProofSchema, {
          pairingId: challengeData.pairingId,
          deviceSignature: await signTranscript(identity, transcript),
        }),
      },
    })
    const result = await this.request(proof)
    if (result.body.case !== 'pairSucceeded') {
      throw new Error('unexpected Node pairing result')
    }

    await this.savePairedIdentity(
      identity,
      result.body.value.nodeId,
      new Uint8Array(result.body.value.nodePublicKey),
    )
    this.authenticated = true
    store.paired = true
    store.nodeConnected = true
  }

  async connect(callbacks: NodeCallbacks = {}): Promise<void> {
    this.callbacks = callbacks
    requireWebCrypto()
    const identity = this.identity ?? await readIdentity()
    this.identity = identity
    if (!identity?.nodeId || !identity.nodePublicKey) {
      throw new Error('PWA device is not paired with PhotonNode')
    }

    await this.openSocket()
    const connectionId = randomId()
    const clientNonce = randomBytes(32)
    const begin = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextRequestId(),
      body: {
        case: 'authBegin',
        value: create(AuthBeginSchema, {
          deviceId: identity.deviceId,
          connectionId,
          clientNonce,
        }),
      },
    })
    const challenge = await this.request(begin)
    if (challenge.body.case !== 'authChallenge') {
      throw new Error('unexpected Node authentication response')
    }
    if (challenge.body.value.connectionId !== connectionId || challenge.body.value.nodeId !== identity.nodeId) {
      throw new Error('Node authentication transcript does not match')
    }

    const nodePublicKey = new Uint8Array(challenge.body.value.nodePublicKey)
    if (!bytesEqual(nodePublicKey, new Uint8Array(identity.nodePublicKey))) {
      throw new Error('Node identity key changed')
    }
    const authData: AuthChallengeData = {
      connectionId,
      deviceId: identity.deviceId,
      clientNonce,
      nodeNonce: new Uint8Array(challenge.body.value.nodeNonce),
      nodePublicKey,
    }
    const transcript = encodeTranscript(
      'PHOTON-AUTH-1',
      String(PROTOCOL_VERSION),
      authData.connectionId,
      authData.deviceId,
      identity.nodeId,
      authData.clientNonce,
      authData.nodeNonce,
    )
    if (!await verifyNodeSignature(authData.nodePublicKey, new Uint8Array(challenge.body.value.nodeSignature), transcript)) {
      throw new Error('Node authentication signature is invalid')
    }

    const proof = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextRequestId(),
      body: {
        case: 'authProof',
        value: create(AuthProofSchema, {
          connectionId,
          deviceSignature: await signTranscript(identity, transcript),
        }),
      },
    })
    const result = await this.request(proof)
    if (result.body.case !== 'authSucceeded') {
      throw new Error('unexpected Node authentication result')
    }
    this.authenticated = true
    store.nodeConnected = true
  }

  async openStream(kind: TransportKind, host: string, port: number): Promise<NodeTransportStream> {
    if (!this.authenticated) throw new Error('Node is not authenticated')
    const streamId = this.allocateStreamId()
    const response = await this.request(create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextRequestId(),
      body: {
        case: 'transportOpenRequest',
        value: create(TransportOpenRequestSchema, {
          streamId,
          transport: kind,
          host,
          port,
        }),
      },
    }))
    if (response.body.case !== 'transportOpenedEvent') {
      throw new Error('unexpected transport open response')
    }
    const stream = new NodeTransportStream(
      this,
      streamId,
      kind,
      Number(response.body.value.inputCreditBytes),
    )
    this.streams.set(streamId, stream)
    return stream
  }

  wsUrl(): string {
    return `ws://${window.location.hostname}:17373`
  }

  sendMessage(message: PhotonMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Node WebSocket is not connected')
    }
    this.socket.send(toBinary(PhotonMessageSchema, message))
  }

  sendCredit(streamId: number, direction: 'input' | 'output', amount: number): void {
    if (amount <= 0) return
    this.sendMessage(create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: '',
      body: {
        case: 'transportCredit',
        value: create(TransportCreditSchema, {
          streamId,
          direction,
          addBytes: BigInt(amount),
        }),
      },
    }))
  }

  removeStream(streamId: number): void {
    this.streams.delete(streamId)
  }

  clearPairing(): void {
    this.closeSocket()
    this.identity = undefined
    store.paired = false
    store.deviceId = ''
    store.nodeConnected = false
    void clearIdentity()
  }

  disconnect(): void {
    this.closeSocket()
    store.nodeConnected = false
  }

  private async ensureIdentity(): Promise<StoredIdentity> {
    if (this.identity?.devicePrivateKey && this.identity.devicePublicKey) return this.identity
    const keyPair = await requireWebCrypto().subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify'],
    ) as CryptoKeyPair
    const publicKey = await requireWebCrypto().subtle.exportKey('spki', keyPair.publicKey)
    const identity: StoredIdentity = {
      key: 'identity',
      deviceId: requireWebCrypto().randomUUID?.() ?? randomId(),
      deviceName: store.deviceName,
      devicePrivateKey: keyPair.privateKey,
      devicePublicKey: publicKey,
    }
    await saveIdentity(identity)
    this.identity = identity
    store.deviceId = identity.deviceId
    store.identityLoaded = true
    return identity
  }

  private async savePairedIdentity(identity: StoredIdentity, nodeId: string, nodePublicKey: Uint8Array): Promise<void> {
    const paired: StoredIdentity = {
      ...identity,
      nodeId,
      nodePublicKey: nodePublicKey.slice().buffer,
    }
    await saveIdentity(paired)
    this.identity = paired
  }

  private async openSocket(): Promise<void> {
    this.closeSocket()
    this.socket = new WebSocket(wsUrl())
    this.socket.binaryType = 'arraybuffer'
    this.authenticated = false
    store.nodeConnected = false
    this.socketReady = new Promise<void>((resolve, reject) => {
      this.socketReadyResolve = resolve
      this.socketReadyReject = reject
    })
    this.socket.onopen = () => this.socketReadyResolve?.()
    this.socket.onmessage = (event) => this.handleMessage(event)
    this.socket.onerror = () => {
      const error = new Error('Node WebSocket error')
      this.socketReadyReject?.(error)
      this.rejectPending(error)
      this.callbacks.onError?.(error.message)
    }
    this.socket.onclose = () => {
      const error = new Error('Node WebSocket closed')
      this.socketReadyReject?.(error)
      store.nodeConnected = false
      this.authenticated = false
      this.rejectPending(error)
      for (const stream of this.streams.values()) stream.fail(error)
      this.streams.clear()
      this.callbacks.onError?.(error.message)
      this.callbacks.onDisconnected?.()
      this.disconnectedHandler?.()
    }
    await this.socketReady
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = new Uint8Array(event.data as ArrayBuffer)
      const message = fromBinary(PhotonMessageSchema, data)
      const body = message.body.case
      if (body === 'transportData') {
        const stream = this.streams.get(message.body.value.streamId)
        if (stream) {
          stream.receive(message.body.value.sequence, new Uint8Array(message.body.value.payload))
        }
        return
      }
      if (body === 'transportCredit') {
        const stream = this.streams.get(message.body.value.streamId)
        if (stream && message.body.value.direction === 'input') {
          stream.receiveInputCredit(Number(message.body.value.addBytes))
        }
        return
      }
      if (body === 'transportClosedEvent') {
        const stream = this.streams.get(message.body.value.streamId)
        stream?.finish()
        return
      }
      if (body === 'transportErrorEvent' && message.body.value.streamId) {
        const stream = this.streams.get(message.body.value.streamId)
        stream?.fail(toError(message))
      }
      const pending = this.pending.get(message.requestId)
      if (!pending) return
      this.pending.delete(message.requestId)
      if (body === 'transportErrorEvent') pending.reject(toError(message))
      else pending.resolve(message)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.callbacks.onError?.(`Node message error: ${message}`)
    }
  }

  private request(message: PhotonMessage): Promise<PhotonMessage> {
    return new Promise((resolve, reject) => {
      this.pending.set(message.requestId, { resolve, reject })
      try {
        this.sendMessage(message)
      } catch (error) {
        this.pending.delete(message.requestId)
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }

  private closeSocket(): void {
    this.authenticated = false
    this.socketReadyReject?.(new Error('Node connection closed'))
    this.socketReady = undefined
    this.socketReadyResolve = undefined
    this.socketReadyReject = undefined
    this.rejectPending(new Error('Node connection closed'))
    for (const stream of this.streams.values()) stream.finish()
    this.streams.clear()
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.close()
      this.socket = null
    }
  }

  private nextRequestId(): string {
    this.requestCounter += 1
    return `request-${this.requestCounter}`
  }

  private allocateStreamId(): number {
    let streamId = requireWebCrypto().getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
    while (streamId === 0 || this.streams.has(streamId)) {
      streamId = requireWebCrypto().getRandomValues(new Uint32Array(1))[0] & 0x7fffffff
    }
    return streamId
  }
}

export const nodeClient = new NodeClient()

export function wsUrl(): string {
  return nodeClient.wsUrl()
}
