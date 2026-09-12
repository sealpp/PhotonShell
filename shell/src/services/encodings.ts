// Single source of truth for the supported encoding catalog.
// `id` is a WHATWG encoding label usable directly with `new TextDecoder(id)`.
// Entries mirror the Xshell encoding list minus items browsers cannot decode
// (IBM864/CP862 DOS pages, bare "Korean") — UTF-8 pinned first, the rest in
// alphabetical order by language.
export interface EncodingEntry {
  id: string
  label: string
  short: string
}

export const DEFAULT_ENCODING = 'utf-8'

export const ENCODINGS: EncodingEntry[] = [
  { id: 'utf-8', label: 'Unicode (UTF-8)', short: 'UTF-8' },
  { id: 'asmo-708', label: 'Arabic (ASMO 708)', short: 'ASMO 708' },
  { id: 'iso-8859-6', label: 'Arabic (ISO)', short: 'ISO 8859-6' },
  { id: 'windows-1256', label: 'Arabic (Windows)', short: 'Windows 1256' },
  { id: 'iso-8859-4', label: 'Baltic (ISO)', short: 'ISO 8859-4' },
  { id: 'windows-1257', label: 'Baltic (Windows)', short: 'Windows 1257' },
  { id: 'iso-8859-2', label: 'Central European (ISO)', short: 'ISO 8859-2' },
  { id: 'windows-1250', label: 'Central European (Windows)', short: 'Windows 1250' },
  { id: 'gbk', label: 'Chinese Simplified (GBK)', short: 'GBK' },
  { id: 'gb18030', label: 'Chinese Simplified (GB18030)', short: 'GB18030' },
  { id: 'gb2312', label: 'Chinese Simplified (GB2312)', short: 'GB 2312' },
  { id: 'big5', label: 'Chinese Traditional (Big5)', short: 'Big5' },
  { id: 'iso-8859-5', label: 'Cyrillic (ISO)', short: 'ISO 8859-5' },
  { id: 'koi8-r', label: 'Cyrillic (KOI8-R)', short: 'KOI8-R' },
  { id: 'koi8-u', label: 'Cyrillic (KOI8-U)', short: 'KOI8-U' },
  { id: 'windows-1251', label: 'Cyrillic (Windows)', short: 'Windows 1251' },
  { id: 'ibm866', label: 'Cyrillic (IBM-866)', short: 'IBM866' },
  { id: 'iso-8859-7', label: 'Greek (ISO)', short: 'ISO 8859-7' },
  { id: 'windows-1253', label: 'Greek (Windows)', short: 'Windows 1253' },
  { id: 'iso-8859-8', label: 'Hebrew (ISO-Visual)', short: 'ISO 8859-8' },
  { id: 'iso-8859-8-i', label: 'Hebrew (ISO-Logical)', short: 'ISO 8859-8-I' },
  { id: 'windows-1255', label: 'Hebrew (Windows)', short: 'Windows 1255' },
  { id: 'euc-jp', label: 'Japanese (EUC)', short: 'EUC-JP' },
  { id: 'shift_jis', label: 'Japanese (Shift-JIS)', short: 'Shift JIS' },
  { id: 'euc-kr', label: 'Korean (EUC)', short: 'EUC-KR' },
  { id: 'windows-874', label: 'Thai (Windows)', short: 'Windows 874' },
  { id: 'iso-8859-9', label: 'Turkish (ISO)', short: 'ISO 8859-9' },
  { id: 'windows-1254', label: 'Turkish (Windows)', short: 'Windows 1254' },
  { id: 'windows-1258', label: 'Vietnamese (Windows)', short: 'Windows 1258' },
  { id: 'iso-8859-1', label: 'Western European (ISO)', short: 'ISO 8859-1' },
  { id: 'windows-1252', label: 'Western European (Windows)', short: 'Windows 1252' },
]

const byId = new Map(ENCODINGS.map((entry) => [entry.id, entry]))

export function encodingEntry(id: string | undefined): EncodingEntry | undefined {
  return id ? byId.get(id) : undefined
}

export function encodingLabel(id: string | undefined): string {
  return encodingEntry(id)?.label ?? id ?? ''
}

export function encodingShort(id: string | undefined): string {
  if (!id) return ''
  return encodingEntry(id)?.short ?? id.toUpperCase()
}

// Resolve a stored encoding id to a usable TextDecoder label, falling back to
// UTF-8 for values outside the catalog (e.g. BOM-detected utf-16 stays valid).
export function encodingDecoder(id: string | undefined): string {
  const value = id || DEFAULT_ENCODING
  try {
    return new TextDecoder(value).encoding
  } catch {
    return DEFAULT_ENCODING
  }
}
