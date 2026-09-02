import type { HostProfile } from '../stores/app'

const DB_NAME = 'photon-shell'
const DB_VERSION = 2

export type { HostProfile } from '../stores/app'

export interface StoredIdentity {
  key: 'identity'
  deviceId: string
  deviceName: string
  devicePrivateKey: CryptoKey
  devicePublicKey: ArrayBuffer
  nodeId?: string
  nodePublicKey?: ArrayBuffer
}

export interface EncryptedCredential {
  id: string
  version: 1
  nonce: string
  ciphertext: string
}

export interface KnownHostRecord {
  id: string
  host: string
  port: number
  publicKey: string
  fingerprint: string
}

export interface KeybindingPreferences {
  key: 'keybindingPreferences'
  version: 1
  overrides: Array<{ commandId: string; key: string | null }>
  disabled: string[]
}

let database: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (database) return database
  database = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error ?? new Error('failed to open PWA database'))
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('hosts')) {
        db.createObjectStore('hosts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('credentials')) {
        db.createObjectStore('credentials', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('knownHosts')) {
        db.createObjectStore('knownHosts', { keyPath: 'id' })
      }
    }
  })
  return database
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('PWA database request failed'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function getFromStore<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDatabase()
  return requestResult(db.transaction(storeName, 'readonly').objectStore(storeName).get(key)) as Promise<T | undefined>
}

async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDatabase()
  await requestResult(db.transaction(storeName, 'readwrite').objectStore(storeName).put(value))
}

async function deleteFromStore(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase()
  await requestResult(db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key))
}

export async function readIdentity(): Promise<StoredIdentity | undefined> {
  return getFromStore<StoredIdentity>('meta', 'identity')
}

export async function saveIdentity(identity: StoredIdentity): Promise<void> {
  await putInStore('meta', identity)
}

export async function clearIdentity(): Promise<void> {
  await deleteFromStore('meta', 'identity')
}

export async function readMeta<T extends { key: string }>(key: string): Promise<T | undefined> {
  return getFromStore<T>('meta', key)
}

export async function saveMeta<T extends { key: string }>(value: T): Promise<void> {
  await putInStore('meta', value)
}

export async function listHosts(): Promise<HostProfile[]> {
  const db = await openDatabase()
  return requestResult(db.transaction('hosts', 'readonly').objectStore('hosts').getAll())
}

export async function saveHost(host: HostProfile): Promise<void> {
  await putInStore('hosts', host)
}

export async function deleteHost(id: string): Promise<void> {
  await deleteFromStore('hosts', id)
  await deleteFromStore('credentials', id)
}

export async function deleteHosts(ids: string[]): Promise<void> {
  const db = await openDatabase()
  const transaction = db.transaction(['hosts', 'credentials'], 'readwrite')
  const hosts = transaction.objectStore('hosts')
  const credentials = transaction.objectStore('credentials')
  for (const id of ids) {
    hosts.delete(id)
    credentials.delete(id)
  }
  await new Promise<void>((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error ?? new Error('failed to delete hosts'))
    transaction.oncomplete = () => resolve()
  })
}

export async function readCredential(id: string): Promise<EncryptedCredential | undefined> {
  return getFromStore<EncryptedCredential>('credentials', id)
}

export async function saveCredential(credential: EncryptedCredential): Promise<void> {
  await putInStore('credentials', credential)
}

export async function clearCredential(id: string): Promise<void> {
  await deleteFromStore('credentials', id)
}

function knownHostId(host: string, port: number): string {
  return `${host}\u0000${port}`
}

export async function readKnownHost(host: string, port: number): Promise<KnownHostRecord | undefined> {
  return getFromStore<KnownHostRecord>('knownHosts', knownHostId(host, port))
}

export async function saveKnownHost(record: Omit<KnownHostRecord, 'id'>): Promise<void> {
  await putInStore('knownHosts', { ...record, id: knownHostId(record.host, record.port) })
}
