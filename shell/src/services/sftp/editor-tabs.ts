import { randomId } from '../../utils/id'
import { loadCredentialRecord } from '../vault'
import { store, type EditorTab, type FileEntry, type FileTab } from '../../stores/app'
import { getSftpBackend, registerSftpSession } from './file-tabs'
import { SftpWorkerClient } from './worker-client'
import type { SftpBackend, SftpConnectionOptions } from './types'
import { getRuntimePassword } from '../ssh'
import { transferFile } from './transfer'

const MAX_EDIT_SIZE = 10 * 1024 * 1024

function detectLanguage(name: string): string {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  return ({ ts: 'typescript', js: 'javascript', json: 'json', md: 'markdown', py: 'python', sh: 'shell' } as Record<string, string>)[extension] ?? 'text'
}

function decodeFile(buffer: ArrayBuffer): Pick<EditorTab['editor'], 'content' | 'encoding' | 'bom' | 'lineEnding'> {
  const bytes = new Uint8Array(buffer)
  let encoding: EditorTab['editor']['encoding'] = 'utf-8'
  let offset = 0
  let bom = false
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { bom = true; offset = 3 }
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { bom = true; offset = 2; encoding = 'utf-16le' }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { bom = true; offset = 2; encoding = 'utf-16be' }
  const content = new TextDecoder(encoding).decode(bytes.slice(offset))
  const crlf = (content.match(/\r\n/g) ?? []).length
  const cr = (content.match(/\r(?!\n)/g) ?? []).length
  const lf = (content.match(/(?<!\r)\n/g) ?? []).length
  const lineEnding: EditorTab['editor']['lineEnding'] = crlf >= lf && crlf >= cr ? '\r\n' : cr > lf ? '\r' : '\n'
  return { content, encoding, bom, lineEnding }
}

function encodeFile(editor: EditorTab['editor']): ArrayBuffer {
  const normalized = editor.content.replace(/\r\n|\r|\n/g, editor.lineEnding)
  let body: Uint8Array
  if (editor.encoding === 'utf-8') body = new TextEncoder().encode(normalized)
  else {
    body = new Uint8Array(normalized.length * 2)
    for (let index = 0; index < normalized.length; index += 1) {
      const code = normalized.charCodeAt(index)
      if (editor.encoding === 'utf-16le') { body[index * 2] = code & 0xff; body[index * 2 + 1] = code >> 8 }
      else { body[index * 2] = code >> 8; body[index * 2 + 1] = code & 0xff }
    }
  }
  if (!editor.bom) return body.buffer as ArrayBuffer
  const prefix = editor.encoding === 'utf-8' ? new Uint8Array([0xef, 0xbb, 0xbf]) : editor.encoding === 'utf-16le' ? new Uint8Array([0xff, 0xfe]) : new Uint8Array([0xfe, 0xff])
  const merged = new Uint8Array(prefix.length + body.length)
  merged.set(prefix)
  merged.set(body, prefix.length)
  return merged.buffer as ArrayBuffer
}

export async function openEditorTab(fileTabId: string, entry: FileEntry): Promise<EditorTab | undefined> {
  const source = store.tabs.find((candidate) => candidate.id === fileTabId) as FileTab | undefined
  if (!source || source.kind !== 'file') return undefined
  const host = store.hosts.find((candidate) => candidate.id === source.hostId)
  if (!host) return undefined
  const editor: EditorTab = {
    id: randomId(),
    kind: 'editor',
    hostId: source.hostId,
    label: entry.name,
    state: 'connecting',
    error: '',
    sessionId: randomId(),
    terminalId: randomId(),
    telemetry: null,
    encoding: 'utf-8',
    cwd: source.file.cwd,
    afterTabId: source.id,
    editor: {
      path: entry.path,
      language: detectLanguage(entry.name),
      dirty: false,
      encoding: 'utf-8',
      bom: false,
      lineEnding: '\n',
      content: '',
      size: entry.size,
      largeFileConfirmed: false,
    },
  }
  const index = store.tabs.findIndex((candidate) => candidate.id === source.id)
  store.tabs.splice(index + 1, 0, editor)
  store.activeTabId = editor.id
  try {
    if (entry.size > MAX_EDIT_SIZE && !window.confirm(`${entry.name} 大小超过 10 MiB，仍要打开吗？`)) throw new Error('Opening large file was cancelled')
    const credential = await loadCredentialRecord(host.id)
    const backend = new SftpWorkerClient()
    const options: SftpConnectionOptions = { sessionId: editor.sessionId, host: host.address, port: host.port, username: host.username, password: credential?.password ?? getRuntimePassword(host.address) ?? (() => { throw new Error('SFTP credentials are unavailable for this host') })(), defaultPath: source.file.cwd }
    await backend.connect(options)
    registerSftpSession(editor.id, backend)
    const stat = await backend.stat(entry.path)
    const content = decodeFile(await backend.read(entry.path, 0, stat.size))
    const reactive = store.tabs.find((candidate) => candidate.id === editor.id) as EditorTab | undefined
    if (!reactive) return editor
    reactive.state = 'online'
    reactive.editor = { ...reactive.editor, ...content, size: stat.size, largeFileConfirmed: stat.size > MAX_EDIT_SIZE }
    return reactive
  } catch (error) {
    editor.state = 'error'
    editor.error = error instanceof Error ? error.message : String(error)
    return editor
  }
}

export async function saveEditorTab(tabId: string): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as EditorTab | undefined
  const backend = getSftpBackend(tabId)
  if (!tab || !backend) throw new Error('Editor session is unavailable')
  const payload = encodeFile(tab.editor)
  const memorySource: SftpBackend = {
    connect: async () => undefined,
    disconnect: async () => undefined,
    list: async () => ({ path: '/', entries: [] }),
    stat: async () => ({ name: tab.editor.path, path: tab.editor.path, kind: 'file', size: payload.byteLength, modifiedAt: Date.now() }),
    read: async (_path, offset = 0, length = payload.byteLength) => payload.slice(offset, offset + length),
    write: async () => undefined,
    mkdir: async () => undefined,
    remove: async () => undefined,
    rename: async () => ({ atomic: true }),
  }
  await transferFile(memorySource, backend, tab.editor.path, tab.editor.path, { })
  tab.editor.dirty = false
  tab.editor.size = payload.byteLength
}
