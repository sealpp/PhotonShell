import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  AuthBeginSchema,
  AuthProofSchema,
  PhotonMessageSchema,
  TransportCloseRequestSchema,
  TransportCreditSchema,
  TransportDataSchema,
  TransportOpenRequestSchema,
} from '../../proto/photon_pb'
import { randomId } from '../../utils/id'
import { readIdentity } from '../storage'
import { requireWebCrypto } from '../webCrypto'

const PROTOCOL_VERSION = 1
const MAX_CHUNK = 60 * 1024

type DataHandler = (payload: Uint8Array) => void

function bytes(length: number): Uint8Array {
  const result = new Uint8Array(length)
  requireWebCrypto().getRandomValues(result)
  return result
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

function transcript(label: string, ...fields: Array<string | Uint8Array>): Uint8Array {
  const encoded = [text(label), ...fields.map((field) => typeof field === 'string' ? text(field) : field)]
  const result = new Uint8Array(encoded.reduce((sum, value) => sum + 4 + value.length, 0))
  const view = new DataView(result.buffer)
  let offset = 0
  for (const value of encoded) {
    view.setUint32(offset, value.length, false)
    offset += 4
    result.set(value, offset)
    offset += value.length
  }
  return result
}

async function sign(identity: NonNullable<Awaited<ReturnType<typeof readIdentity>>>, value: Uint8Array): Promise<Uint8Array> {
  const signature = await requireWebCrypto().subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.devicePrivateKey,
    value.slice().buffer as ArrayBuffer,
  )
  return new Uint8Array(signature)
}

async function verify(publicKey: Uint8Array, signature: Uint8Array, value: Uint8Array): Promise<boolean> {
  const key = await requireWebCrypto().subtle.importKey(
    'spki',
    publicKey.slice().buffer as ArrayBuffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
  return requireWebCrypto().subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature.slice().buffer as ArrayBuffer,
    value.slice().buffer as ArrayBuffer,
  )
}

function nodeUrl(): string {
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : '127.0.0.1'
  return `ws://${host}:17373`
}

export class NodeSessionTransport {
  private socket: WebSocket | undefined
  private requestCounter = 0
  private readonly pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>()
  private streamId = 0
  private inputCredit = 0
  private outputSequence = 0n
  private inputSequence = 0n
  private connected = false
  private closed = false
  private dataHandler: DataHandler | undefined
  private dataWaiters: Array<() => void> = []

  onData(handler: DataHandler): void {
    this.dataHandler = handler
  }

  async connect(host: string, port: number): Promise<void> {
    const identity = await readIdentity()
    if (!identity?.nodeId || !identity.nodePublicKey) throw new Error('PWA device is not paired with PhotonNode')
    this.socket = new WebSocket(nodeUrl())
    this.socket.binaryType = 'arraybuffer'
    this.socket.onmessage = (event) => this.handleMessage(event)
    this.socket.onerror = () => this.fail(new Error('Node session WebSocket error'))
    this.socket.onclose = () => this.fail(new Error('Node session WebSocket closed'))
    await new Promise<void>((resolve, reject) => {
      const socket = this.socket
      if (!socket) return reject(new Error('Node session socket unavailable'))
      const onOpen = () => { socket.removeEventListener('open', onOpen); resolve() }
      const onError = () => { socket.removeEventListener('error', onError); reject(new Error('Node session WebSocket error')) }
      socket.addEventListener('open', onOpen)
      socket.addEventListener('error', onError)
    })

    const connectionId = randomId()
    const clientNonce = bytes(32)
    const begin = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextId(),
      body: { case: 'authBegin', value: create(AuthBeginSchema, { deviceId: identity.deviceId, connectionId, clientNonce }) },
    })
    const challenge = await this.request(begin)
    if (challenge.body.case !== 'authChallenge' || challenge.body.value.connectionId !== connectionId || challenge.body.value.nodeId !== identity.nodeId) {
      throw new Error('Node authentication challenge is invalid')
    }
    const nodePublicKey = new Uint8Array(challenge.body.value.nodePublicKey)
    const expectedNodeKey = new Uint8Array(identity.nodePublicKey)
    if (nodePublicKey.length !== expectedNodeKey.length || nodePublicKey.some((value, index) => value !== expectedNodeKey[index])) {
      throw new Error('Node identity key changed')
    }
    const authTranscript = transcript('PHOTON-AUTH-1', String(PROTOCOL_VERSION), connectionId, identity.deviceId, identity.nodeId, clientNonce, new Uint8Array(challenge.body.value.nodeNonce))
    if (!await verify(nodePublicKey, new Uint8Array(challenge.body.value.nodeSignature), authTranscript)) throw new Error('Node authentication signature is invalid')
    const proof = create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextId(),
      body: { case: 'authProof', value: create(AuthProofSchema, { connectionId, deviceSignature: await sign(identity, authTranscript) }) },
    })
    const authenticated = await this.request(proof)
    if (authenticated.body.case !== 'authSucceeded') throw new Error('Node authentication failed')

    const opened = await this.request(create(PhotonMessageSchema, {
      protocolVersion: PROTOCOL_VERSION,
      requestId: this.nextId(),
      body: { case: 'transportOpenRequest', value: create(TransportOpenRequestSchema, { streamId: this.allocateStreamId(), transport: 'tcp', host, port }) },
    }))
    if (opened.body.case !== 'transportOpenedEvent') throw new Error('Node transport open failed')
    this.streamId = Number(opened.body.value.streamId)
    this.inputCredit = Number(opened.body.value.inputCreditBytes)
    this.connected = true
  }

  async send(payload: Uint8Array): Promise<void> {
    if (!this.connected || this.closed) throw new Error('Node session transport is closed')
    for (let offset = 0; offset < payload.length; offset += MAX_CHUNK) {
      const chunk = payload.slice(offset, offset + MAX_CHUNK)
      while (this.inputCredit < chunk.length) await new Promise<void>((resolve) => this.dataWaiters.push(resolve))
      this.inputCredit -= chunk.length
      this.sendMessage(create(PhotonMessageSchema, {
        protocolVersion: PROTOCOL_VERSION,
        requestId: '',
        body: { case: 'transportData', value: create(TransportDataSchema, { streamId: this.streamId, sequence: this.inputSequence, payload: chunk }) },
      }))
      this.inputSequence += 1n
    }
  }

  async waitForData(): Promise<void> {
    if (this.closed) throw new Error('Node session transport is closed')
    await new Promise<void>((resolve) => this.dataWaiters.push(resolve))
  }

  async close(reason = 'session_closed'): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.connected = false
    if (this.socket?.readyState === WebSocket.OPEN && this.streamId) {
      this.sendMessage(create(PhotonMessageSchema, {
        protocolVersion: PROTOCOL_VERSION,
        requestId: '',
        body: { case: 'transportCloseRequest', value: create(TransportCloseRequestSchema, { streamId: this.streamId, reason }) },
      }))
    }
    this.socket?.close()
    this.fail(new Error(reason))
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = fromBinary(PhotonMessageSchema, new Uint8Array(event.data as ArrayBuffer))
      if (message.body.case === 'transportData') {
        if (message.body.value.streamId !== this.streamId || message.body.value.sequence !== this.outputSequence) return
        this.outputSequence += 1n
        const payload = new Uint8Array(message.body.value.payload)
        this.dataHandler?.(payload)
        this.sendMessage(create(PhotonMessageSchema, {
          protocolVersion: PROTOCOL_VERSION,
          requestId: '',
          body: { case: 'transportCredit', value: create(TransportCreditSchema, { streamId: this.streamId, direction: 'output', addBytes: BigInt(payload.length) }) },
        }))
        this.dataWaiters.splice(0).forEach((resolve) => resolve())
        return
      }
      if (message.body.case === 'transportCredit' && message.body.value.streamId === this.streamId && message.body.value.direction === 'input') {
        this.inputCredit += Number(message.body.value.addBytes)
        this.dataWaiters.splice(0).forEach((resolve) => resolve())
        return
      }
      const pending = this.pending.get(message.requestId)
      if (pending) {
        this.pending.delete(message.requestId)
        if (message.body.case === 'transportErrorEvent') pending.reject(new Error(`${message.body.value.code}: ${message.body.value.message}`))
        else pending.resolve(message)
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private request(message: any): Promise<any> {
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

  private sendMessage(message: any): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('Node session WebSocket is not connected')
    this.socket.send(toBinary(PhotonMessageSchema, message))
  }

  private fail(error: Error): void {
    if (this.closed) return
    this.closed = true
    this.connected = false
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
    this.dataWaiters.splice(0).forEach((resolve) => resolve())
  }

  private nextId(): string { this.requestCounter += 1; return `session-${this.requestCounter}-${randomId()}` }

  private allocateStreamId(): number {
    return requireWebCrypto().getRandomValues(new Uint32Array(1))[0] & 0x7fffffff || 1
  }
}
