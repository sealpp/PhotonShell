import type { FileEntry, FileSortDirection, FileSortKey } from '../../stores/app'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function compareFileEntries(left: FileEntry, right: FileEntry, key: FileSortKey, direction: FileSortDirection): number {
  const directoryOrder = Number(right.kind === 'directory') - Number(left.kind === 'directory')
  if (directoryOrder) return directoryOrder
  let result = 0
  if (key === 'name') result = collator.compare(left.name, right.name)
  else if (key === 'modified') result = left.modifiedAt - right.modifiedAt || collator.compare(left.name, right.name)
  else if (key === 'size') result = left.size - right.size || collator.compare(left.name, right.name)
  else result = collator.compare(left.kind, right.kind) || collator.compare(left.name, right.name)
  return direction === 'asc' ? result : -result
}

export function sortFileEntries(entries: readonly FileEntry[], key: FileSortKey, direction: FileSortDirection): FileEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => compareFileEntries(a.entry, b.entry, key, direction) || a.index - b.index)
    .map(({ entry }) => entry)
}

export function isVisibleFileEntry(entry: FileEntry, showHidden: boolean): boolean {
  return showHidden || !entry.hidden && !entry.name.startsWith('.') && !entry.temporary
}
