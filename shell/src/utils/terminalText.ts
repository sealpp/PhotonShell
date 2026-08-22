import type { Terminal } from '@xterm/xterm'

export function getSelectedText(terminal: Terminal): string {
  return terminal.getSelection() ?? ''
}

export function getScreenText(terminal: Terminal): string {
  const buffer = terminal.buffer.active
  const start = buffer.viewportY
  const end = Math.min(buffer.length, start + terminal.rows)
  return extractLines(buffer, start, end)
}

export function getBufferText(terminal: Terminal): string {
  const buffer = terminal.buffer.active
  return extractLines(buffer, 0, buffer.length)
}

function extractLines(buffer: any, start: number, end: number): string {
  let text = ''
  for (let y = start; y < end; y++) {
    const line = buffer.getLine(y)
    if (!line) continue
    if (y > start && !line.isWrapped) {
      text += '\n'
    }
    text += line.translateToString(true)
  }
  return text
}
