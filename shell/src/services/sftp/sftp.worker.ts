import { createUnavailableSftpBackend } from './backend'
import { isSftpRequest, responseError, transferablesForResponse } from './worker-protocol'
import type { SftpBackend, SftpRequest, SftpResponse } from './types'

let backend: SftpBackend = createUnavailableSftpBackend()
const cancelled = new Set<string>()

export function installSftpWorkerBackend(next: SftpBackend): void {
  backend = next
}

async function handle(request: SftpRequest): Promise<SftpResponse> {
  try {
    if (request.type === 'cancel') {
      cancelled.add(request.requestId)
      return { version: 1, id: request.id, ok: true, type: 'cancelled' }
    }
    if (cancelled.has(request.id)) throw new Error('request cancelled')
    switch (request.type) {
      case 'connect': await backend.connect(request.options); return { version: 1, id: request.id, ok: true, type: 'connected' }
      case 'disconnect': await backend.disconnect(); return { version: 1, id: request.id, ok: true, type: 'disconnected' }
      case 'list': return { version: 1, id: request.id, ok: true, type: 'list', result: await backend.list(request.path, request.cursor) }
      case 'stat': return { version: 1, id: request.id, ok: true, type: 'stat', result: await backend.stat(request.path) }
      case 'read': return { version: 1, id: request.id, ok: true, type: 'read', result: await backend.read(request.path, request.offset, request.length) }
      case 'write': await backend.write(request.path, request.payload, request.offset); return { version: 1, id: request.id, ok: true, type: 'write' }
      case 'mkdir': await backend.mkdir(request.path); return { version: 1, id: request.id, ok: true, type: 'mkdir' }
      case 'remove': await backend.remove(request.path, request.recursive); return { version: 1, id: request.id, ok: true, type: 'remove' }
      case 'rename': return { version: 1, id: request.id, ok: true, type: 'rename', result: await backend.rename(request.source, request.target, request.overwrite) }
    }
  } catch (error) {
    return responseError(request.id, error instanceof Error && 'code' in error ? String((error as Error & { code?: unknown }).code) : 'SFTP_ERROR', error instanceof Error ? error.message : String(error))
  }
}

const workerScope = globalThis as unknown as { onmessage?: (event: MessageEvent) => void; postMessage?: (message: unknown, transfer?: Transferable[]) => void }
if (typeof workerScope.postMessage === 'function') {
  workerScope.onmessage = (event) => {
    if (!isSftpRequest(event.data)) return
    void handle(event.data).then((response) => workerScope.postMessage?.(response, transferablesForResponse(response)))
  }
}
