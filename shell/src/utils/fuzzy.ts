// Subsequence fuzzy match with VS Code-style scoring: consecutive matches and
// word/camelCase boundaries score higher. Returns null when `query` is not a
// subsequence of `target`.
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0
  const lowerQuery = query.toLowerCase()
  const lowerTarget = target.toLowerCase()
  let score = 0
  let position = 0
  let previous = -2
  for (const char of lowerQuery) {
    const found = lowerTarget.indexOf(char, position)
    if (found === -1) return null
    score += found === previous + 1 ? 8 : isBoundary(target, found) ? 4 : 1
    previous = found
    position = found + 1
  }
  return score
}

function isBoundary(target: string, index: number): boolean {
  if (index === 0) return true
  const previous = target[index - 1]
  if (' -_().'.includes(previous)) return true
  return /[a-z]/.test(previous) && /[A-Z]/.test(target[index])
}
