import { randomId } from '../../utils/id'
import { basenameRemotePath, joinRemotePath, normalizeRemotePath } from './path'
import type { SftpBackend } from './types'

const CHUNK_SIZE = 256 * 1024
const POSIX_RENAME = 'posix-rename@openssh.com'

export interface TransferResult {
  sourcePath: string
  targetPath: string
  bytes: number
  atomic: boolean
  metadataApplied: boolean
  orphanPath?: string
}

export interface TransferOptions {
  signal?: AbortSignal
  onProgress?: (bytes: number, total: number) => void
}

export class TransferCancelledError extends Error {
  readonly code = 'TRANSFER_CANCELLED'
  readonly orphanPath?: string

  constructor(orphanPath?: string) {
    super('Transfer cancelled')
    this.name = 'TransferCancelledError'
    this.orphanPath = orphanPath
  }
}

export class TransferOrphanError extends Error {
  readonly code = 'TRANSFER_ORPHAN'
  readonly orphanPath: string

  constructor(orphanPath: string, _cause: unknown) {
    super(`Transfer failed and temporary file was retained: ${orphanPath}`)
    this.name = 'TransferOrphanError'
    this.orphanPath = orphanPath
  }
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new TransferCancelledError()
}

async function bestEffortRemove(backend: SftpBackend, path: string): Promise<void> {
  await backend.remove(path, false)
}

async function applyMetadata(backend: SftpBackend, path: string, stat: { mode?: number; modifiedAt: number }): Promise<boolean> {
  let applied = true
  try {
    if (stat.mode !== undefined && backend.chmod) await backend.chmod(path, stat.mode)
  } catch {
    applied = false
  }
  try {
    if (backend.utimes) await backend.utimes(path, stat.modifiedAt)
  } catch {
    applied = false
  }
  return applied
}

async function commitTemporary(backend: SftpBackend, temporary: string, target: string): Promise<boolean> {
  if (backend.supports?.(POSIX_RENAME)) {
    const result = await backend.rename(temporary, target, true)
    return result.atomic
  }
  let targetExists = false
  try {
    await backend.stat(target)
    targetExists = true
  } catch {
    targetExists = false
  }
  if (targetExists) await backend.remove(target, true)
  await backend.rename(temporary, target, false)
  return false
}

export async function transferFile(
  source: SftpBackend,
  target: SftpBackend,
  sourcePath: string,
  targetPath: string,
  options: TransferOptions = {},
): Promise<TransferResult> {
  const normalizedSource = normalizeRemotePath(sourcePath)
  const normalizedTarget = normalizeRemotePath(targetPath)
  const sourceStat = await source.stat(normalizedSource)
  if (sourceStat.kind !== 'file') throw new Error(`Only regular files can use the file transfer pipeline: ${normalizedSource}`)
  const temporary = joinRemotePath(normalizedTarget.slice(0, normalizedTarget.lastIndexOf('/')) || '/', `.${basenameRemotePath(normalizedTarget)}.photonshell-${randomId()}.tmp`)
  let bytes = 0
  try {
    if (sourceStat.size === 0) await target.write(temporary, new ArrayBuffer(0), 0)
    for (let offset = 0; offset < sourceStat.size;) {
      assertNotCancelled(options.signal)
      const chunk = await source.read(normalizedSource, offset, Math.min(CHUNK_SIZE, sourceStat.size - offset))
      if (chunk.byteLength === 0) throw new Error('SFTP source returned an empty chunk before EOF')
      await target.write(temporary, chunk, offset)
      offset += chunk.byteLength
      bytes = offset
      options.onProgress?.(bytes, sourceStat.size)
    }
    assertNotCancelled(options.signal)
    const temporaryStat = await target.stat(temporary)
    if (bytes !== sourceStat.size || temporaryStat.size !== sourceStat.size) {
      throw new Error(`SFTP byte validation failed (source=${sourceStat.size}, read=${bytes}, temporary=${temporaryStat.size})`)
    }
    const metadataApplied = await applyMetadata(target, temporary, sourceStat)
    const atomic = await commitTemporary(target, temporary, normalizedTarget)
    return { sourcePath: normalizedSource, targetPath: normalizedTarget, bytes, atomic, metadataApplied }
  } catch (error) {
    try {
      await bestEffortRemove(target, temporary)
    } catch (cleanupError) {
      if (error instanceof TransferCancelledError) throw new TransferCancelledError(temporary)
      throw new TransferOrphanError(temporary, cleanupError)
    }
    if (error instanceof TransferCancelledError || options.signal?.aborted) throw new TransferCancelledError()
    throw error
  }
}

export type TransferTaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface TransferTaskSnapshot {
  id: string
  label: string
  state: TransferTaskState
  progress: number
  error?: string
  result?: TransferResult
  orphanPath?: string
}

export class TransferQueue {
  private concurrency = 2
  private running = 0
  private readonly queue: Array<{ snapshot: TransferTaskSnapshot; run: (signal: AbortSignal) => Promise<TransferResult>; controller: AbortController; resolve: (result: TransferResult) => void; reject: (error: unknown) => void }> = []
  private readonly snapshots = new Map<string, TransferTaskSnapshot>()
  private readonly listeners = new Set<(snapshot: TransferTaskSnapshot) => void>()

  constructor(concurrency = 2) {
    this.setConcurrency(concurrency)
  }

  setConcurrency(value: number): number {
    this.concurrency = Math.max(1, Math.min(4, Math.floor(value) || 2))
    this.pump()
    return this.concurrency
  }

  getConcurrency(): number { return this.concurrency }
  list(): TransferTaskSnapshot[] { return Array.from(this.snapshots.values()) }
  subscribe(listener: (snapshot: TransferTaskSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener) }

  enqueue(label: string, run: (signal: AbortSignal) => Promise<TransferResult>): { id: string; promise: Promise<TransferResult> } {
    const snapshot: TransferTaskSnapshot = { id: randomId(), label, state: 'queued', progress: 0 }
    this.snapshots.set(snapshot.id, snapshot)
    let resolve!: (result: TransferResult) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<TransferResult>((res, rej) => { resolve = res; reject = rej })
    this.queue.push({ snapshot, run, controller: new AbortController(), resolve, reject })
    this.emit(snapshot)
    this.pump()
    return { id: snapshot.id, promise }
  }

  cancel(id: string): boolean {
    const item = this.queue.find((candidate) => candidate.snapshot.id === id)
    if (!item || !['queued', 'running'].includes(item.snapshot.state)) return false
    item.controller.abort()
    if (item.snapshot.state === 'queued') {
      item.snapshot.state = 'cancelled'
      item.reject(new TransferCancelledError())
      this.emit(item.snapshot)
    }
    return true
  }

  retry(id: string): boolean {
    const item = this.queue.find((candidate) => candidate.snapshot.id === id)
    if (!item || !['failed', 'cancelled'].includes(item.snapshot.state)) return false
      item.snapshot.state = 'queued'
      item.snapshot.error = undefined
      item.controller = new AbortController()
    item.snapshot.progress = 0
    this.emit(item.snapshot)
    this.pump()
    return true
  }

  private emit(snapshot: TransferTaskSnapshot): void {
    for (const listener of this.listeners) listener({ ...snapshot })
  }

  private pump(): void {
    while (this.running < this.concurrency) {
      const item = this.queue.find((candidate) => candidate.snapshot.state === 'queued')
      if (!item) return
      this.running += 1
      item.snapshot.state = 'running'
      this.emit(item.snapshot)
      void item.run(item.controller.signal).then((result) => {
        item.snapshot.state = 'completed'
        item.snapshot.progress = 1
        item.snapshot.result = result
        item.resolve(result)
      }, (error: unknown) => {
        item.snapshot.state = error instanceof TransferCancelledError ? 'cancelled' : 'failed'
        item.snapshot.error = error instanceof Error ? error.message : String(error)
        if (error instanceof TransferOrphanError) item.snapshot.orphanPath = error.orphanPath
        item.reject(error)
      }).finally(() => {
        this.running -= 1
        this.emit(item.snapshot)
        this.pump()
      })
    }
  }
}
