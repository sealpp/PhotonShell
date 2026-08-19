<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
import { IconChartLine, IconX } from '@tabler/icons-vue'
import '@xterm/xterm/css/xterm.css'

const termEl = ref<HTMLDivElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
const terminalId = randomId()

const selectedHost = computed(() => store.hosts.find((h) => h.id === store.selectedHostId))
const tabLabel = computed(() => selectedHost.value ? `${selectedHost.value.username}@${selectedHost.value.address}` : '未连接')

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
      <div class="tabs">
        <div class="tab active">
          <span class="tab-label">{{ tabLabel }}</span>
          <button type="button" class="tab-close" title="断开连接" @click.stop="disconnect">
            <IconX :size="14" />
          </button>
        </div>
      </div>
      <div class="actions">
        <button
          type="button"
          class="tool-icon"
          :class="{ active: store.panelOpen }"
          title="系统监控"
          @click="store.panelOpen = !store.panelOpen"
        >
          <IconChartLine :size="16" />
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

.tabs {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 0;
  overflow: hidden;
}

.tab {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  background: #1e1e1e;
  color: #cccccc;
  border-right: 1px solid #252526;
  cursor: default;
  user-select: none;
  min-width: 0;
}

.tab.active {
  background: #1a1a1a;
  border-top: 2px solid #0e639c;
}

.tab-label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-close {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
}

.tab-close:hover {
  color: #fff;
  background: #c75450;
  opacity: 1;
}

.actions {
  display: flex;
  align-items: center;
  margin-left: auto;
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

.terminal {
  flex: 1;
  padding: 0.5rem;
  overflow: hidden;
}
</style>
