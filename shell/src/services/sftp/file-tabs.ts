import { randomId } from '../../utils/id'
import { loadCredentialRecord } from '../vault'
import { store, type FileEntry, type FileTab, type HostProfile } from '../../stores/app'
import { normalizeRemotePath, parentRemotePath, joinRemotePath } from './path'
import { listDirectory } from './operations'
import { copyEntry, moveEntry, targetNameForEntry } from './operations'
import { canPasteSftpClipboard, clearSftpClipboardAfterPaste, createSftpClipboardPayload } from './clipboard'
import { enqueueTransfer } from './transfer-runtime'
import { TransferCancelledError } from './transfer'
import { SftpWorkerClient } from './worker-client'
import { getRuntimePassword } from '../ssh'
import type { SftpBackend, SftpConnectionOptions } from './types'

const sessions = new Map<string, SftpBackend>()
let backendFactory: () => SftpBackend = () => new SftpWorkerClient()

export function setSftpBackendFactory(factory: () => SftpBackend): void {
  backendFactory = factory
}

export function getSftpBackend(tabId: string): SftpBackend | undefined {
  return sessions.get(tabId)
}

export function registerSftpSession(tabId: string, backend: SftpBackend): void {
  sessions.set(tabId, backend)
}

function createFileState(path: string) {
  const normalized = normalizeRemotePath(path)
  return {
    cwd: normalized,
    defaultPath: normalized,
    history: [normalized],
    historyIndex: 0,
    entries: [] as FileEntry[],
    selectedPaths: [] as string[],
    view: 'list' as const,
    sortKey: 'name' as const,
    sortDirection: 'asc' as const,
    showHidden: false,
    loading: true,
    error: '',
  }
}

export function createFileTab(host: HostProfile, sourceTabId: string, initialPath = '/'): FileTab {
  const sourceIndex = store.tabs.findIndex((tab) => tab.id === sourceTabId)
  const tab: FileTab = {
    id: randomId(),
    kind: 'file',
    hostId: host.id,
    label: `文件: ${normalizeRemotePath(initialPath)}`,
    state: 'connecting',
    error: '',
    sessionId: randomId(),
    terminalId: randomId(),
    telemetry: null,
    encoding: 'utf-8',
    cwd: normalizeRemotePath(initialPath),
    file: createFileState(initialPath),
    afterTabId: sourceTabId,
  }
  store.tabs.splice(sourceIndex >= 0 ? sourceIndex + 1 : store.tabs.length, 0, tab)
  store.activeTabId = tab.id
  store.view = 'shell'
  void startFileTab(tab, host)
  return tab
}

async function startFileTab(tab: FileTab, host: HostProfile): Promise<void> {
  const reactiveTab = store.tabs.find((candidate) => candidate.id === tab.id) as FileTab | undefined
  if (!reactiveTab) return
  try {
    const credential = await loadCredentialRecord(host.id)
    const options: SftpConnectionOptions = {
      sessionId: reactiveTab.sessionId,
      host: host.address,
      port: host.port,
      username: host.username,
      password: credential?.password ?? getRuntimePassword(host.address) ?? (() => { throw new Error('SFTP credentials are unavailable for this host') })(),
      defaultPath: reactiveTab.file.defaultPath,
    }
    const backend = backendFactory()
    await backend.connect(options)
    sessions.set(reactiveTab.id, backend)
    try {
      await backend.stat(reactiveTab.file.cwd)
    } catch {
      reactiveTab.file.cwd = '/'
      reactiveTab.file.defaultPath = '/'
      reactiveTab.file.history = ['/']
      reactiveTab.file.historyIndex = 0
      reactiveTab.cwd = '/'
    }
    reactiveTab.state = 'online'
    await refreshFileTab(reactiveTab.id)
  } catch (error) {
    reactiveTab.state = 'error'
    reactiveTab.error = error instanceof Error ? error.message : String(error)
    reactiveTab.file.loading = false
    reactiveTab.file.error = reactiveTab.error
  }
}

export async function refreshFileTab(tabId: string): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  const backend = sessions.get(tabId)
  if (!tab || !backend) return
  tab.file.loading = true
  tab.file.error = ''
  try {
    tab.file.entries = await listDirectory(backend, tab.file.cwd, {
      showHidden: tab.file.showHidden,
      sortKey: tab.file.sortKey,
      sortDirection: tab.file.sortDirection,
    })
    tab.label = `文件: ${tab.file.cwd}`
  } catch (error) {
    tab.file.error = error instanceof Error ? error.message : String(error)
  } finally {
    tab.file.loading = false
  }
}

export async function navigateFileTab(tabId: string, path: string, pushHistory = true): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (!tab) return
  const next = normalizeRemotePath(path, tab.file.cwd)
  if (pushHistory) {
    tab.file.history = tab.file.history.slice(0, tab.file.historyIndex + 1).concat(next)
    tab.file.historyIndex = tab.file.history.length - 1
  }
  tab.file.cwd = next
  tab.cwd = next
  tab.file.selectedPaths = []
  await refreshFileTab(tabId)
}

export async function navigateParentFileTab(tabId: string): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (tab) await navigateFileTab(tabId, parentRemotePath(tab.file.cwd))
}

export async function closeFileTabSession(tabId: string): Promise<void> {
  const backend = sessions.get(tabId)
  sessions.delete(tabId)
  await backend?.disconnect().catch(() => undefined)
}

export async function goBackFileTab(tabId: string): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (!tab || tab.file.historyIndex <= 0) return
  tab.file.historyIndex -= 1
  tab.file.cwd = tab.file.history[tab.file.historyIndex]
  await refreshFileTab(tabId)
}

export async function goForwardFileTab(tabId: string): Promise<void> {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (!tab || tab.file.historyIndex >= tab.file.history.length - 1) return
  tab.file.historyIndex += 1
  tab.file.cwd = tab.file.history[tab.file.historyIndex]
  await refreshFileTab(tabId)
}

export function copySelectedFileEntries(tabId: string, mode: 'copy' | 'cut'): void {
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (!tab) return
  const entries = tab.file.entries.filter((entry) => tab.file.selectedPaths.includes(entry.path))
  store.sftpClipboard = createSftpClipboardPayload(mode, tab.id, tab.sessionId, entries)
}

export async function pasteFileTab(tabId: string): Promise<void> {
  const targetTab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  const clipboard = store.sftpClipboard
  if (!targetTab || !clipboard || !canPasteSftpClipboard(clipboard, targetTab.sessionId)) return
  const targetBackend = sessions.get(targetTab.id)
  const sourceBackend = sessions.get(clipboard.sourceTabId)
  if (!targetBackend || !sourceBackend) throw new Error('SFTP source or target session is unavailable')
  const sameSession = clipboard.sourceSessionId === targetTab.sessionId
  const task = enqueueTransfer(`粘贴到 ${targetTab.file.cwd}`, async (signal) => {
    let lastResult = { sourcePath: clipboard.entries[0]?.path ?? '', targetPath: targetTab.file.cwd, bytes: 0, atomic: sameSession, metadataApplied: false }
    for (const entry of clipboard.entries) {
      if (signal.aborted) throw new TransferCancelledError()
      const destination = targetNameForEntry(entry.path, targetTab.file.cwd)
      if (clipboard.mode === 'cut' && sameSession) {
        const moved = await moveEntry(targetBackend, entry.path, destination)
        lastResult = { ...lastResult, sourcePath: entry.path, targetPath: destination, atomic: moved.atomic }
      } else {
        const results = await copyEntry(sourceBackend, targetBackend, entry.path, destination, signal)
        lastResult = results[results.length - 1] ?? lastResult
      }
    }
    return lastResult
  })
  await task.promise
  store.sftpClipboard = clearSftpClipboardAfterPaste(clipboard, targetTab.sessionId)
  await refreshFileTab(targetTab.id)
}

export async function deleteFileEntries(tabId: string, paths: string[]): Promise<void> {
  const backend = sessions.get(tabId)
  if (!backend) throw new Error('SFTP session is unavailable')
  for (const path of paths) await backend.remove(path, true)
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (tab) tab.file.selectedPaths = []
  await refreshFileTab(tabId)
}

export async function renameFileEntry(tabId: string, path: string, name: string): Promise<void> {
  const backend = sessions.get(tabId)
  const tab = store.tabs.find((candidate) => candidate.id === tabId) as FileTab | undefined
  if (!backend || !tab) throw new Error('SFTP session is unavailable')
  const trimmed = name.trim()
  if (!trimmed || trimmed === '.' || trimmed === '..' || /[\\/\u0000]/.test(trimmed)) throw new Error('Invalid remote file name')
  await moveEntry(backend, path, joinRemotePath(parentRemotePath(path), trimmed))
  await refreshFileTab(tabId)
}
