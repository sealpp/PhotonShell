import { describe, expect, it } from 'vitest'
import { ENCODINGS, encodingDecoder, encodingLabel, encodingShort } from './encodings'
import { fuzzyScore } from '../utils/fuzzy'

describe('encodings catalog', () => {
  it('pins UTF-8 first and keeps language-alphabetical order', () => {
    expect(ENCODINGS[0].id).toBe('utf-8')
    const languages = ENCODINGS.slice(1).map((entry) => entry.label.split(' (')[0])
    const sorted = [...languages].sort((a, b) => a.localeCompare(b, 'en'))
    expect(languages).toEqual(sorted)
  })

  it('resolves every entry to a decodable TextDecoder label', () => {
    for (const entry of ENCODINGS) {
      expect(() => new TextDecoder(entry.id)).not.toThrow()
    }
  })

  it('looks up labels and falls back gracefully for unknown ids', () => {
    expect(encodingLabel('gbk')).toBe('Chinese Simplified (GBK)')
    expect(encodingShort('gbk')).toBe('GBK')
    expect(encodingShort('utf-16le')).toBe('UTF-16LE')
    expect(encodingDecoder('cp864')).toBe('utf-8')
    expect(encodingDecoder('gb2312')).toBe('gbk')
  })
})

describe('fuzzyScore', () => {
  it('rejects non-subsequence queries and accepts exact substrings', () => {
    expect(fuzzyScore('xyz', 'Chinese Simplified (GBK)')).toBeNull()
    expect(fuzzyScore('gbk', 'Chinese Simplified (GBK) gbk')).not.toBeNull()
  })

  it('prefers consecutive and boundary matches over scattered ones', () => {
    const exact = fuzzyScore('iso', 'Baltic (ISO)')!
    const scattered = fuzzyScore('iso', 'Vietnamese (Windows) Turkish')!
    expect(exact).toBeGreaterThan(scattered)
    expect(fuzzyScore('utf', 'Unicode (UTF-8)')).not.toBeNull()
  })
})
