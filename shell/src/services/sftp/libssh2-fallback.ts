import type { SftpBackend } from './types'
import { SftpCapabilityError } from './types'

/**
 * The source release is pinned for reproducible fallback builds. The WASM
 * artifact hash is part of this pin; a missing or mismatching hash fails
 * closed before any remote connection.
 */
export const LIBSSH2_FALLBACK_PIN = {
  version: '1.11.1',
  sourceSha256: 'd9ec76cbe34db98eec3539fe2c899d26b0c837cb3eb466a56b0f109cabf658f7',
  package: '@verdigris/libssh2.js@0.1.9',
  packageSha256: '4cf65d589782c3eaa79f275dace2240c5aa59e7f866fb8f23c980ee371747622',
  wasmSha256: '84865009d568e3233a4037d2fcdb96c83a3cbda44fe2a124e36214e4a11565e5',
} as const

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

export async function verifyPinnedLibssh2Wasm(bytes: ArrayBuffer, expectedSha256: string): Promise<void> {
  if (!/^[a-f0-9]{64}$/i.test(expectedSha256)) throw new SftpCapabilityError('libssh2 WASM SHA-256 pin is missing')
  const actual = await sha256Hex(bytes)
  if (actual.toLowerCase() !== expectedSha256.toLowerCase()) throw new SftpCapabilityError(`libssh2 WASM SHA-256 mismatch (expected ${expectedSha256}, got ${actual})`)
}

export interface PinnedLibssh2Loader {
  load(): Promise<{ wasm: ArrayBuffer; backend: SftpBackend }>
  sha256: string
}

export async function createPinnedLibssh2Backend(loader: PinnedLibssh2Loader): Promise<SftpBackend> {
  if (loader.sha256.toLowerCase() !== LIBSSH2_FALLBACK_PIN.wasmSha256) throw new SftpCapabilityError('libssh2 WASM loader does not match the pinned artifact')
  const artifact = await loader.load()
  await verifyPinnedLibssh2Wasm(artifact.wasm, loader.sha256)
  return artifact.backend
}
