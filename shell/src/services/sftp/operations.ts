import { basenameRemotePath, joinRemotePath, normalizeRemotePath } from './path'
import { isVisibleFileEntry, sortFileEntries } from './sort'
import type { FileEntry, FileSortDirection, FileSortKey } from '../../stores/app'
import type { SftpBackend, SftpDirectoryPage } from './types'
import { transferFile, type TransferResult } from './transfer'

export async function listDirectory(
  backend: SftpBackend,
  path: string,
  options: { showHidden?: boolean; sortKey?: FileSortKey; sortDirection?: FileSortDirection } = {},
): Promise<FileEntry[]> {
  const entries: FileEntry[] = []
  let cursor: string | undefined
  do {
    const page: SftpDirectoryPage = await backend.list(normalizeRemotePath(path), cursor)
    entries.push(...page.entries)
    cursor = page.nextCursor
  } while (cursor)
  const visible = entries.filter((entry) => isVisibleFileEntry(entry, options.showHidden ?? false))
  return sortFileEntries(visible, options.sortKey ?? 'name', options.sortDirection ?? 'asc')
}

export async function copyEntry(
  source: SftpBackend,
  target: SftpBackend,
  sourcePath: string,
  targetPath: string,
  signal?: AbortSignal,
): Promise<TransferResult[]> {
  if (signal?.aborted) throw new DOMException('The transfer was cancelled', 'AbortError')
  const stat = await source.stat(sourcePath)
  if (stat.kind === 'directory') {
    await target.mkdir(targetPath)
    const entries = await listDirectory(source, sourcePath, { showHidden: true })
    const results: TransferResult[] = []
    for (const entry of entries) {
      results.push(...await copyEntry(source, target, entry.path, joinRemotePath(targetPath, entry.name), signal))
    }
    return results
  }
  if (stat.kind === 'symlink') {
    if (!source.readlink || !target.symlink) throw new Error(`Cannot copy symlink ${sourcePath}: backend lacks symlink support`)
    const linkTarget = await source.readlink(sourcePath)
    await target.symlink(linkTarget, targetPath)
    return [{ sourcePath, targetPath, bytes: 0, atomic: true, metadataApplied: false }]
  }
  return [await transferFile(source, target, sourcePath, targetPath, { signal })]
}

export async function moveEntry(backend: SftpBackend, sourcePath: string, targetPath: string, overwrite = false): Promise<{ atomic: boolean }> {
  return backend.rename(normalizeRemotePath(sourcePath), normalizeRemotePath(targetPath), overwrite)
}

export function targetNameForEntry(sourcePath: string, targetDirectory: string): string {
  return joinRemotePath(targetDirectory, basenameRemotePath(sourcePath))
}
