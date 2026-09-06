import { randomId } from '../../utils/id'
import { transferablesForRequest } from './worker-protocol'
import type { SftpBackend, SftpConnectionOptions, SftpDirectoryPage, SftpRequest, SftpRequestInput, SftpResponse, SftpStat } from './types'

export class SftpWorkerClient implements SftpBackend {
  private readonly worker: Worker
  private readonly pending = new Map<string, { resolve: (response: SftpResponse) => void; reject: (error: Error) => void }>()

  constructor(worker = new Worker(new URL('./sftp.worker.ts', import.meta.url), { type: 'module' })) {
    this.worker = worker
    this.worker.onmessage = (event) => {
      const response = event.data as SftpResponse
      const request = this.pending.get(response.id)
      if (!request) return
      this.pending.delete(response.id)
      request.resolve(response)
    }
    this.worker.onerror = (event) => {
      for (const { reject } of this.pending.values()) reject(new Error(event.message || 'SFTP worker failed'))
      this.pending.clear()
    }
  }

  private async request<T = SftpResponse>(request: SftpRequestInput): Promise<T> {
    const message = { ...request, version: 1 as const, id: randomId() } as SftpRequest
    const response = await new Promise<SftpResponse>((resolve, reject) => {
      this.pending.set(message.id, { resolve, reject })
      this.worker.postMessage(message, transferablesForRequest(message))
    })
    if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`)
    return response as unknown as T
  }

  async connect(options: SftpConnectionOptions): Promise<void> { await this.request({ type: 'connect', options }) }
  async disconnect(): Promise<void> { await this.request({ type: 'disconnect' }); this.worker.terminate() }
  async list(path: string, cursor?: string): Promise<SftpDirectoryPage> { return (await this.request<{ result: SftpDirectoryPage }>({ type: 'list', path, cursor })).result }
  async stat(path: string): Promise<SftpStat> { return (await this.request<{ result: SftpStat }>({ type: 'stat', path })).result }
  async read(path: string, offset?: number, length?: number): Promise<ArrayBuffer> { return (await this.request<{ result: ArrayBuffer }>({ type: 'read', path, offset, length })).result }
  async write(path: string, payload: ArrayBuffer, offset?: number): Promise<void> { await this.request({ type: 'write', path, payload, offset }) }
  async mkdir(path: string): Promise<void> { await this.request({ type: 'mkdir', path }) }
  async remove(path: string, recursive?: boolean): Promise<void> { await this.request({ type: 'remove', path, recursive }) }
  async rename(source: string, target: string, overwrite?: boolean): Promise<{ atomic: boolean }> { return (await this.request<{ result: { atomic: boolean } }>({ type: 'rename', source, target, overwrite })).result }

  async cancel(requestId: string): Promise<void> { await this.request({ type: 'cancel', requestId }) }
}
