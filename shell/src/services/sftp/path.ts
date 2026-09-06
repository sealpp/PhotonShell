export function normalizeRemotePath(input: string, cwd = '/'): string {
  const base = cwd.startsWith('/') ? cwd : `/${cwd}`
  const raw = input.trim() || base
  const absolute = raw.startsWith('/') ? raw : `${base.replace(/\/$/, '')}/${raw}`
  const parts: string[] = []
  for (const part of absolute.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return `/${parts.join('/')}` || '/'
}

export function parentRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path)
  if (normalized === '/') return '/'
  const index = normalized.lastIndexOf('/')
  return index <= 0 ? '/' : normalized.slice(0, index)
}

export function joinRemotePath(parent: string, name: string): string {
  return normalizeRemotePath(`${parent.replace(/\/$/, '')}/${name}`)
}

export function basenameRemotePath(path: string): string {
  const normalized = normalizeRemotePath(path)
  return normalized === '/' ? '/' : normalized.slice(normalized.lastIndexOf('/') + 1)
}

export function isDescendantRemotePath(path: string, parent: string): boolean {
  const child = normalizeRemotePath(path)
  const ancestor = normalizeRemotePath(parent)
  return child !== ancestor && child.startsWith(`${ancestor === '/' ? '' : ancestor}/`)
}
