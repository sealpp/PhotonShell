<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { store } from '../stores/app'
import {
  closeTerminal,
  disconnectHost,
  openTerminal,
  resizeTerminal,
  sendTerminalInput,
  setTerminalOutputHandler,
  startTelemetry,
  stopTelemetry,
} from '../services/ws'
import { randomId } from '../utils/id'
import '@xterm/xterm/css/xterm.css'

const termEl = ref<HTMLDivElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
const terminalId = randomId()

const encoder = new TextEncoder()

function fitAndResize() {
  if (!terminal || !fitAddon) return
  fitAddon.fit()
  const { cols, rows } = terminal
  resizeTerminal(terminalId, cols, rows)
}

onMounted(() => {
  if (!termEl.value) return

  terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    theme: {
      background: '#0d0d0d',
      foreground: '#d4d4d4',
    },
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(termEl.value)
  fitAddon.fit()

  terminal.onData((data: string) => {
    if (store.streamId) {
      sendTerminalInput(store.streamId, encoder.encode(data))
    }
  })

  terminal.onResize(({ cols, rows }) => {
    resizeTerminal(terminalId, cols, rows)
  })

  setTerminalOutputHandler((data: Uint8Array) => {
    terminal?.write(data)
  })

  resizeObserver = new ResizeObserver(() => {
    fitAndResize()
  })
  resizeObserver.observe(termEl.value)

  const unwatch = watch(() => store.shellState, (state) => {
    if (state === 'online') {
      const { cols, rows } = terminal!
      openTerminal(terminalId, cols, rows)
      if (store.selectedHostId) {
        startTelemetry(store.selectedHostId, 2000)
      }
      unwatch()
    } else if (state === 'error') {
      terminal?.writeln(`\r\n[session error: ${store.shellError}]`)
      unwatch()
    }
  }, { immediate: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  setTerminalOutputHandler(null)
  if (store.view === 'shell') {
    if (store.selectedHostId) {
      stopTelemetry(store.selectedHostId)
    }
    closeTerminal(terminalId)
    disconnectHost()
  }
  terminal?.dispose()
  terminal = null
})

function disconnect() {
  if (store.selectedHostId) {
    stopTelemetry(store.selectedHostId)
  }
  closeTerminal(terminalId)
  disconnectHost()
  terminal?.dispose()
  terminal = null
  store.view = 'welcome'
}
</script>

<template>
  <div class="shell">
    <div class="terminal-toolbar">
      <div class="toolbar-left">
        <button
          type="button"
          class="tool-icon"
          :class="{ active: store.panelOpen }"
          title="系统监控"
          @click="store.panelOpen = !store.panelOpen"
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2,10 L6,7 L10,9 L12,3" />
          </svg>
        </button>
      </div>
      <div class="toolbar-right">
        <span class="latency">-- ms</span>
        <button type="button" class="tool-icon" title="断开连接" @click="disconnect">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 4l6 6M10 4l-6 6" />
          </svg>
        </button>
      </div>
    </div>
    <div ref="termEl" class="terminal" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.terminal-toolbar {
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  background: #0f0f0f;
  border-bottom: 1px solid #252526;
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tool-icon {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon:hover {
  color: #fff;
  background: #3c3c3c;
}

.tool-icon.active {
  color: #4aaaff;
  background: #1a1a1a;
}

.tool-icon svg {
  width: 14px;
  height: 14px;
}

.latency {
  color: #4ec9b0;
  font-size: 12px;
}

.terminal {
  flex: 1;
  padding: 0.5rem;
  overflow: hidden;
}
</style>
