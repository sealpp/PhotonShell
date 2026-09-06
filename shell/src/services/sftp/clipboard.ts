import type { FileEntry, SftpClipboardState } from '../../stores/app'

export type SftpClipboardMode = 'copy' | 'cut'

export type SftpClipboardPayload = SftpClipboardState

export function createSftpClipboardPayload(mode: SftpClipboardMode, sourceTabId: string, sourceSessionId: string, entries: FileEntry[]): SftpClipboardPayload {
  return {
    version: 1,
    mode,
    sourceTabId,
    sourceSessionId,
    entries: entries.map(({ path, name, kind, size }) => ({ path, name, kind, size })),
    createdAt: Date.now(),
  }
}

export function canPasteSftpClipboard(payload: SftpClipboardPayload | null, targetSessionId: string): boolean {
  return !!payload?.entries.length && payload.version === 1 && !!targetSessionId
}

export function clearSftpClipboardAfterPaste(_payload: SftpClipboardPayload, targetSessionId: string): SftpClipboardPayload | null {
  void targetSessionId
  return null
}
