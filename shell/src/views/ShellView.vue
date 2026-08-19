<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
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
    theme: {
      background: '#0f172a',
      foreground: '#e2e8f0',
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

onUnmounted(() => {
  resizeObserver?.disconnect()
  setTerminalOutputHandler(null)
  if (store.selectedHostId) {
    stopTelemetry(store.selectedHostId)
  }
  closeTerminal(terminalId)
  disconnectHost()
  terminal?.dispose()
  terminal = null
})

function goBack() {
  stopTelemetry(store.selectedHostId)
  closeTerminal(terminalId)
  disconnectHost()
  terminal?.dispose()
  terminal = null
  store.view = 'host-form'
}
</script>

<template>
  <div class="shell">
    <div class="header">
      <button type="button" class="back" @click="goBack">Back</button>
      <div class="state" :class="store.shellState">{{ store.shellState }}</div>
      <div v-if="store.telemetry" class="telemetry">
        <span>CPU {{ store.telemetry.cpu.toFixed(1) }}%</span>
        <span>MEM {{ store.telemetry.mem.toFixed(1) }}%</span>
        <span>DISK {{ store.telemetry.disk.toFixed(1) }}%</span>
        <span>PROCS {{ store.telemetry.procs }}</span>
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
}

.header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.back {
  background: #475569;
  color: #e2e8f0;
}

.state {
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
}

.state.online {
  color: #22c55e;
}

.state.connecting {
  color: #f59e0b;
}

.state.error {
  color: #f87171;
}

.state.idle {
  color: #94a3b8;
}

.telemetry {
  display: flex;
  gap: 1rem;
  margin-left: auto;
  font-size: 0.8rem;
  color: #94a3b8;
}

.telemetry span {
  min-width: 6rem;
}

.terminal {
  flex: 1;
  padding: 0.5rem;
  overflow: hidden;
}
</style>
