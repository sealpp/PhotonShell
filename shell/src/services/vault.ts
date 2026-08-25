import {
  readCredential,
  readMeta,
  saveCredential,
  saveMeta,
  type EncryptedCredential,
} from './storage'
import { requireWebCrypto } from './webCrypto'

const VAULT_META_KEY = 'vault'
const VAULT_VERSION = 1
const PROFILE_KEY_ALGORITHM = 'AES-KW'
const VAULT_KEY_ALGORITHM = 'AES-GCM'
const NONCE_BYTES = 12
const PASSWORD_SALT_BYTES = 16
const ARGON2_MEMORY_KIB = 64 * 1024
const ARGON2_TIME_COST = 3
const ARGON2_PARALLELISM = 1
const VAULT_KEY_BYTES = 32
const textEncoder = new TextEncoder()

interface VaultMeta {
  key: typeof VAULT_META_KEY
  version: typeof VAULT_VERSION
  profileKey?: CryptoKey
  profileWrappedVaultKey: string
  passwordWrappedVaultKey?: string
  passwordSalt?: string
}

export interface CredentialPayload {
  password?: string
  privateKey?: string
  passphrase?: string
}

let meta: VaultMeta | undefined
let activeVaultKey: CryptoKey | undefined
let argon2Loader: Promise<Argon2Api> | undefined

type Argon2Api = {
  ArgonType: { Argon2id: number }
  hash: (options: {
    pass: string
    salt: Uint8Array
    time: number
    mem: number
    hashLen: number
    parallelism: number
    type: number
  }) => Promise<{ hash: Uint8Array }>
}

function loadArgon2(): Promise<Argon2Api> {
  const runtime = globalThis as typeof globalThis & { argon2?: Argon2Api; argon2WasmPath?: string }
  runtime.argon2WasmPath = '/argon2.wasm'
  if (runtime.argon2) return Promise.resolve(runtime.argon2)
  if (argon2Loader) return argon2Loader
  argon2Loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/argon2-bundled.min.js'
    script.async = true
    script.onload = () => {
      if (runtime.argon2) resolve(runtime.argon2)
      else reject(new Error('Argon2 runtime did not load'))
    }
    script.onerror = () => reject(new Error('failed to load Argon2 runtime'))
    document.head.appendChild(script)
  })
  return argon2Loader
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
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  requireWebCrypto().getRandomValues(bytes)
  return bytes
}

async function generateProfileKey(): Promise<CryptoKey> {
  return requireWebCrypto().subtle.generateKey(
    { name: PROFILE_KEY_ALGORITHM, length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  ) as Promise<CryptoKey>
}

async function generateVaultKey(): Promise<CryptoKey> {
  return requireWebCrypto().subtle.generateKey(
    { name: VAULT_KEY_ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKey>
}

async function wrapVaultKey(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const wrapped = await requireWebCrypto().subtle.wrapKey('raw', vaultKey, wrappingKey, PROFILE_KEY_ALGORITHM)
  return bytesToBase64(new Uint8Array(wrapped))
}

async function unwrapVaultKey(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  return requireWebCrypto().subtle.unwrapKey(
    'raw',
    arrayBuffer(base64ToBytes(wrapped)),
    wrappingKey,
    PROFILE_KEY_ALGORITHM,
    { name: VAULT_KEY_ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function derivePasswordKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const argon2 = await loadArgon2()
  const result = await argon2.hash({
    pass: password,
    salt,
    time: ARGON2_TIME_COST,
    mem: ARGON2_MEMORY_KIB,
    hashLen: VAULT_KEY_BYTES,
    parallelism: ARGON2_PARALLELISM,
    type: argon2.ArgonType.Argon2id,
  })
  return requireWebCrypto().subtle.importKey(
    'raw',
    arrayBuffer(result.hash),
    { name: PROFILE_KEY_ALGORITHM },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

export async function initializeVault(): Promise<void> {
  requireWebCrypto()
  meta = await readMeta<VaultMeta>(VAULT_META_KEY)
  if (!meta) {
    const profileKey = await generateProfileKey()
    const vaultKey = await generateVaultKey()
    meta = {
      key: VAULT_META_KEY,
      version: VAULT_VERSION,
      profileKey,
      profileWrappedVaultKey: await wrapVaultKey(vaultKey, profileKey),
    }
    await saveMeta(meta)
    activeVaultKey = vaultKey
    return
  }

  if (meta.version !== VAULT_VERSION) {
    throw new Error('unsupported PWA vault version')
  }

  if (!meta.profileKey) {
    activeVaultKey = undefined
    return
  }
  try {
    activeVaultKey = await unwrapVaultKey(meta.profileWrappedVaultKey, meta.profileKey)
  } catch {
    activeVaultKey = undefined
  }
}

export function isVaultUnlocked(): boolean {
  return activeVaultKey !== undefined
}

export function hasMasterPassword(): boolean {
  return Boolean(meta?.passwordWrappedVaultKey && meta.passwordSalt)
}

export async function setMasterPassword(password: string): Promise<void> {
  if (password.length < 8) {
    throw new Error('主密码至少需要 8 个字符')
  }
  if (!activeVaultKey || !meta) {
    throw new Error('PWA vault 尚未解锁')
  }

  const salt = randomBytes(PASSWORD_SALT_BYTES)
  const passwordKey = await derivePasswordKey(password, salt)
  meta = {
    ...meta,
    passwordSalt: bytesToBase64(salt),
    passwordWrappedVaultKey: await wrapVaultKey(activeVaultKey, passwordKey),
  }
  await saveMeta(meta)
}

export async function unlockWithMasterPassword(password: string): Promise<void> {
  if (!meta?.passwordSalt || !meta.passwordWrappedVaultKey) {
    throw new Error('尚未设置 PWA 主密码')
  }

  const passwordKey = await derivePasswordKey(password, base64ToBytes(meta.passwordSalt))
  const vaultKey = await unwrapVaultKey(meta.passwordWrappedVaultKey, passwordKey)
  activeVaultKey = vaultKey

  if (!meta.profileKey) {
    meta.profileKey = await generateProfileKey()
  }
  meta.profileWrappedVaultKey = await wrapVaultKey(vaultKey, meta.profileKey)
  await saveMeta(meta)
}

export function lockVault(): void {
  activeVaultKey = undefined
}

export async function saveCredentialRecord(id: string, value: CredentialPayload): Promise<void> {
  if (!activeVaultKey) {
    throw new Error('PWA vault is locked')
  }
  const nonce = randomBytes(NONCE_BYTES)
  const plaintext = textEncoder.encode(JSON.stringify(value))
  const ciphertext = await requireWebCrypto().subtle.encrypt(
    {
      name: VAULT_KEY_ALGORITHM,
      iv: arrayBuffer(nonce),
      additionalData: arrayBuffer(textEncoder.encode(`credential:${id}:v${VAULT_VERSION}`)),
    },
    activeVaultKey,
    arrayBuffer(plaintext),
  )
  const record: EncryptedCredential = {
    id,
    version: VAULT_VERSION,
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
  await saveCredential(record)
}

export async function loadCredentialRecord(id: string): Promise<CredentialPayload | undefined> {
  if (!activeVaultKey) {
    throw new Error('PWA vault is locked')
  }
  const record = await readCredential(id)
  if (!record) return undefined
  if (record.version !== VAULT_VERSION) {
    throw new Error('unsupported PWA credential version')
  }
  const plaintext = await requireWebCrypto().subtle.decrypt(
    {
      name: VAULT_KEY_ALGORITHM,
      iv: arrayBuffer(base64ToBytes(record.nonce)),
      additionalData: arrayBuffer(textEncoder.encode(`credential:${id}:v${VAULT_VERSION}`)),
    },
    activeVaultKey,
    arrayBuffer(base64ToBytes(record.ciphertext)),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as CredentialPayload
}
