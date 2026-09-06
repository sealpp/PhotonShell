import type { SftpBackend, SftpConnectionOptions } from './types'

export interface SftpSpikeResult {
  passed: boolean
  checks: Record<string, boolean>
  error?: string
  backend: string
}

export async function runSftpFeasibilitySpike(backend: SftpBackend, options: SftpConnectionOptions): Promise<SftpSpikeResult> {
  const checks: Record<string, boolean> = {}
  const first = { ...options, sessionId: `${options.sessionId}-a` }
  const second = { ...options, sessionId: `${options.sessionId}-b` }
  try {
    await Promise.all([backend.connect(first), backend.connect(second)])
    checks.independentSessions = true
    const root = options.defaultPath || '/'
    const listing = await backend.list(root)
    checks.directoryListing = Array.isArray(listing.entries)
    const probe = `${root.replace(/\/$/, '')}/.photonshell-spike-${Date.now()}`
    const bytes = new TextEncoder().encode('photon-shell-sftp-spike').buffer
    await backend.write(probe, bytes)
    const read = await backend.read(probe)
    checks.smallFileReadWrite = new TextDecoder().decode(read) === 'photon-shell-sftp-spike'
    await backend.remove(probe)
    checks.cleanup = true
    return { passed: Object.values(checks).every(Boolean), checks, backend: 'sftp-backend' }
  } catch (error) {
    return { passed: false, checks, error: error instanceof Error ? error.message : String(error), backend: 'sftp-backend' }
  } finally {
    await Promise.allSettled([backend.disconnect(), backend.disconnect()])
  }
}
