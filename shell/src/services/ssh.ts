import { CustomTransport, SSHClient } from 'sshclient-wasm'
import { randomId } from '../utils/id'
import { nodeClient, type NodeTransportStream } from './nodeClient'
import { requestHostKeyApproval } from './hostKey'
import { readKnownHost, saveKnownHost } from './storage'
import { requireWebCrypto } from './webCrypto'

const SSH_CONNECT_TIMEOUT_MS = 15_000
const SSH_EXEC_TIMEOUT_MS = 10_000
const MAX_EXEC_OUTPUT_BYTES = 4 * 1024 * 1024
const SSH_CHANNEL_DATA = 94
const SSH_CHANNEL_EXTENDED_DATA = 95
const SSH_KEX_REPLY = 31

export interface SshConnectionInfo {
  sessionId: string
  host: string
  port: number
  username: string
  password: string
  streamId: number
}

type OutputHandler = (payload: Uint8Array) => void
type StateHandler = (state: 'connecting' | 'online' | 'error' | 'idle', error?: string) => void

interface PwaSshSession extends SshConnectionInfo {
  transport: CustomTransport
  stream: NodeTransportStream
  ssh: Awaited<ReturnType<typeof SSHClient.connect>>
  output: OutputHandler
}

class HostKeyRequiredError extends Error {
  constructor(readonly publicKey: Uint8Array) {
    super('remote host key requires confirmation')
  }
}

class HostKeyMismatchError extends Error {
  constructor() {
    super('remote host key does not match the saved fingerprint')
  }
}

const sessions = new Map<string, PwaSshSession>()
const execLocks = new Map<string, Promise<void>>()
const sendLocks = new Map<string, Promise<void>>()
let initialization: Promise<void> | undefined

function ensureSshClient(): Promise<void> {
  if (!initialization) {
    initialization = SSHClient.initialize({
      wasmPath: '/sshclient.wasm',
      wasmExecPath: '/wasm_exec.js',
      cacheBusting: false,
      timeout: SSH_CONNECT_TIMEOUT_MS,
    })
  }
  return initialization
}

function readUint32(data: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > data.length) return undefined
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, false)
}

function readSshString(data: Uint8Array, offset: number): Uint8Array | undefined {
  const length = readUint32(data, offset)
  if (length === undefined || offset + 4 + length > data.length) return undefined
  return data.slice(offset + 4, offset + 4 + length)
}

function parseChannelData(payload: Uint8Array): Uint8Array | undefined {
  if (payload.length < 9) return undefined
  const messageType = payload[0]
  if (messageType !== SSH_CHANNEL_DATA && messageType !== SSH_CHANNEL_EXTENDED_DATA) return undefined
  const lengthOffset = messageType === SSH_CHANNEL_DATA ? 5 : 9
  const dataOffset = lengthOffset + 4
  const dataLength = readUint32(payload, lengthOffset)
  if (dataLength === undefined || dataOffset + dataLength > payload.length) return undefined
  return payload.slice(dataOffset, dataOffset + dataLength)
}

function unpackSshPacket(packet: Uint8Array): Uint8Array | undefined {
  if (packet.length < 5) return undefined
  const packetLength = readUint32(packet, 0)
  if (packetLength === undefined || packetLength + 4 > packet.length) return undefined
  const paddingLength = packet[4]
  const payloadLength = packetLength - paddingLength - 1
  if (payloadLength <= 0 || 5 + payloadLength > packet.length) return undefined
  return packet.slice(5, 5 + payloadLength)
}

function extractChannelData(data: Uint8Array): Uint8Array | undefined {
  return parseChannelData(data) ?? parseChannelData(unpackSshPacket(data) ?? new Uint8Array())
}

function extractHostKey(data: Uint8Array): Uint8Array | undefined {
  const payload = unpackSshPacket(data)
  if (!payload || payload[0] !== SSH_KEX_REPLY) return undefined
  return readSshString(payload, 1)
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let result = 0
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index]
  return result === 0
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function fingerprint(publicKey: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await requireWebCrypto().subtle.digest('SHA-256', publicKey.slice().buffer as ArrayBuffer))
  return `SHA256:${bytesToBase64(digest).replace(/=+$/g, '')}`
}

async function connectSshOnce(
  info: Omit<SshConnectionInfo, 'streamId'>,
  knownHostKey: Uint8Array | undefined,
  onState: StateHandler,
  onOutput: OutputHandler,
): Promise<SshConnectionInfo> {
  await ensureSshClient()
  onState('connecting')

  let stream: NodeTransportStream | undefined
  let activeSession: PwaSshSession | undefined
  let hostKeyFailure: Error | undefined
  let rejectHostKey: (error: Error) => void = () => undefined
  const hostKeyAbort = new Promise<never>((_, reject) => {
    rejectHostKey = reject
  })
  let transport: CustomTransport
  let sshPromise: Promise<Awaited<ReturnType<typeof SSHClient.connect>>> | undefined
  transport = new CustomTransport(
    `ssh-${info.sessionId}`,
    async () => {
      stream = await nodeClient.openStream('tcp', info.host, info.port)
      stream.onData = (data) => transport.injectData(data)
      stream.onError = (error) => onState('error', error.message)
      stream.onClose = () => onState('idle')
    },
    async () => {
      await stream?.close('ssh_closed')
    },
    async (data) => {
      await stream?.send(data)
    },
  )

  try {
    sshPromise = SSHClient.connect(
      {
        host: info.host,
        port: info.port,
        user: info.username,
        password: info.password,
      },
      transport,
      {
        onPacketReceive: (data, metadata) => {
          const observedHostKey = extractHostKey(data)
          if (observedHostKey && !hostKeyFailure) {
            if (knownHostKey && !bytesEqual(knownHostKey, observedHostKey)) {
              hostKeyFailure = new HostKeyMismatchError()
              rejectHostKey(hostKeyFailure)
              void transport.disconnect()
              return
            }
            if (!knownHostKey) {
              hostKeyFailure = new HostKeyRequiredError(observedHostKey)
              rejectHostKey(hostKeyFailure)
              void transport.disconnect()
              return
            }
          }

          const output = activeSession?.output ?? onOutput
          const payload = extractChannelData(data)
          if (payload) {
            output(payload)
          } else if (metadata?.type === 'data') {
            output(data)
          }
        },
        onStateChange: (state) => {
          if (state === 'error') onState('error', 'SSH protocol error')
        },
      },
    )
    const ssh = await connectWithTimeout(Promise.race([sshPromise, hostKeyAbort]), SSH_CONNECT_TIMEOUT_MS)
    if (hostKeyFailure) throw hostKeyFailure
    if (!stream) throw new Error('SSH transport was not opened')
    const session: PwaSshSession = {
      ...info,
      streamId: stream.streamId,
      transport,
      stream,
      ssh,
      output: onOutput,
    }
    sessions.set(info.sessionId, session)
    activeSession = session

    // sshclient-wasm lazily requests the PTY/shell on the first channel write
    // for any session, including exec-* telemetry sessions. A zero-length
    // write may be dropped by the underlying Go channel, so send a single
    // carriage return to force the PTY/shell to start before the first real
    // command is sent.
    try {
      await session.ssh.send(new TextEncoder().encode('\r'))
    } catch (err) {
      console.error('[ssh] startShell failed', info.sessionId, err)
    }

    onState('online')
    return {
      sessionId: info.sessionId,
      host: info.host,
      port: info.port,
      username: info.username,
      password: info.password,
      streamId: stream.streamId,
    }
  } catch (error) {
    await transport.disconnect().catch(() => undefined)
    if (sshPromise) {
      await Promise.race([
        sshPromise.then(async (lateSession) => {
          await lateSession.disconnect().catch(() => undefined)
        }, () => undefined),
        new Promise<void>((resolve) => setTimeout(resolve, 1000)),
      ])
    }
    if (!(error instanceof HostKeyRequiredError)) {
      onState('error', error instanceof Error ? error.message : String(error))
    }
    throw error
  }
}

async function connectWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('SSH connection timed out')), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function connectSsh(
  info: Omit<SshConnectionInfo, 'streamId'>,
  onState: StateHandler,
  onOutput: OutputHandler,
): Promise<SshConnectionInfo> {
  const known = await readKnownHost(info.host, info.port)
  const knownKey = known ? base64ToBytes(known.publicKey) : undefined
  try {
    return await connectSshOnce(info, knownKey, onState, onOutput)
  } catch (error) {
    if (!(error instanceof HostKeyRequiredError)) throw error
    const hostKeyFingerprint = await fingerprint(error.publicKey)
    const accepted = await requestHostKeyApproval({
      host: info.host,
      port: info.port,
      fingerprint: hostKeyFingerprint,
    })
    if (!accepted) throw new Error('remote host key was rejected')
    await saveKnownHost({
      host: info.host,
      port: info.port,
      publicKey: bytesToBase64(error.publicKey),
      fingerprint: hostKeyFingerprint,
    })
    return connectSshOnce(info, error.publicKey, onState, onOutput)
  }
}

export function sendInput(sessionId: string, payload: Uint8Array): Promise<void> {
  const previous = sendLocks.get(sessionId) ?? Promise.resolve()
  const task = previous.then(async () => {
    const session = sessions.get(sessionId)
    if (!session) throw new Error('SSH session is unavailable')
    await session.ssh.send(payload)
  })
  const lock = task.then(() => undefined, () => undefined)
  sendLocks.set(sessionId, lock)
  return task.finally(() => {
    if (sendLocks.get(sessionId) === lock) sendLocks.delete(sessionId)
  })
}

export async function resize(sessionId: string, columns: number, rows: number): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) return
  await session.ssh.resizeTerminal(columns, rows)
}

async function closeSshSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)
  await session.stream.close('ssh_closed').catch(() => undefined)
  await session.ssh.disconnect().catch(() => undefined)
}

export async function closeSsh(sessionId: string): Promise<void> {
  await closeSshSession(sessionId)
  await closeSshSession(`exec-${sessionId}`)
  execLocks.delete(sessionId)
  sendLocks.delete(sessionId)
}

function lastMatchIndex(value: string, expression: RegExp): number {
  let last = -1
  for (const match of value.matchAll(expression)) last = match.index ?? last
  return last
}

function lastMatch(value: string, expression: RegExp): { index: number; value: string } | undefined {
  let last: { index: number; value: string } | undefined
  for (const match of value.matchAll(expression)) {
    if (match.index !== undefined) last = { index: match.index, value: match[1] }
  }
  return last
}

async function waitForExecOutput(
  sessionId: string,
  command: string,
): Promise<{ stdout: Uint8Array; stderr: Uint8Array; exitCode: number }> {
  const start = `__PHOTON_EXEC_START_${randomId().replace(/[^a-zA-Z0-9]/g, '')}__`
  const end = `__PHOTON_EXEC_END_${randomId().replace(/[^a-zA-Z0-9]/g, '')}__`
  let output = ''
  let outputBytes = 0
  let settled = false
  let resolveResult: ((value: { stdout: Uint8Array; stderr: Uint8Array; exitCode: number }) => void) | undefined
  let rejectResult: ((error: Error) => void) | undefined
  const result = new Promise<{ stdout: Uint8Array; stderr: Uint8Array; exitCode: number }>((resolve, reject) => {
    resolveResult = resolve
    rejectResult = reject
  })
  const original = sessions.get(sessionId)
  if (!original) throw new Error('SSH session is unavailable')
  const previousOutput = original.output
  const decoder = new TextDecoder('utf-8', { fatal: false })
  original.output = (data) => {
    outputBytes += data.length
    if (outputBytes > MAX_EXEC_OUTPUT_BYTES) {
      if (!settled) {
        settled = true
        rejectResult?.(new Error('SSH exec output exceeded the limit'))
      }
      return
    }
    output += decoder.decode(data, { stream: true })
    const startMatch = new RegExp(`${start}(?:\\r?\\n)`, 'g')
    const endMatch = new RegExp(`${end}(-?\\d+)(?:\\r?\\n|$)`, 'g')
    const startAt = lastMatchIndex(output, startMatch)
    const endResult = lastMatch(output, endMatch)
    if (!settled && startAt >= 0 && endResult && endResult.index > startAt) {
      settled = true
      const body = output.slice(startAt + start.length + (output[startAt + start.length] === '\\r' ? 2 : 1), endResult.index)
      const exitCode = Number(endResult.value)
      resolveResult?.({
        stdout: new TextEncoder().encode(body.replace(/^\r?\n/, '').replace(/\r?\n$/, '')),
        stderr: new Uint8Array(),
        exitCode,
      })
    }
  }
  const timeout = setTimeout(() => {
    if (!settled) {
      settled = true
      rejectResult?.(new Error('SSH exec timed out'))
    }
  }, SSH_EXEC_TIMEOUT_MS)
  try {
    await sendInput(
      sessionId,
      new TextEncoder().encode(
        `stty -echo; printf '${start}\\n'; ${command}; status=$?; printf '\\n${end}%s\\n' "$status"; stty echo\r\n`,
      ),
    )
    return await result
  } finally {
    clearTimeout(timeout)
    original.output = previousOutput
  }
}

export async function exec(
  info: Omit<SshConnectionInfo, 'streamId'>,
  command: string,
): Promise<{ stdout: Uint8Array; stderr: Uint8Array; exitCode: number }> {
  const previous = execLocks.get(info.sessionId) ?? Promise.resolve()
  const task = previous.then(async () => {
    const execSessionId = `exec-${randomId()}`
    let connection: SshConnectionInfo | undefined
    try {
      connection = await connectSsh(
        { ...info, sessionId: execSessionId },
        () => undefined,
        () => undefined,
      )
      const result = await waitForExecOutput(execSessionId, command)
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      return result
    } finally {
      if (connection) await closeSshSession(execSessionId)
    }
  })
  const lock = task.then(() => undefined, () => undefined)
  execLocks.set(info.sessionId, lock)
  try {
    return await task
  } finally {
    if (execLocks.get(info.sessionId) === lock) execLocks.delete(info.sessionId)
  }
}

export function getSshSession(sessionId: string): SshConnectionInfo | undefined {
  const session = sessions.get(sessionId)
  if (!session) return undefined
  return {
    sessionId: session.sessionId,
    host: session.host,
    port: session.port,
    username: session.username,
    password: session.password,
    streamId: session.streamId,
  }
}
