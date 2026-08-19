/** Fallback ID generator that does not require a secure context. */
export function randomId(): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2)
  return `${time}-${rand}`
}
