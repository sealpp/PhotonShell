<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { store } from '../stores/app'
import {
  openTerminal,
  resizeTerminal,
  sendTerminalInput,
  setTerminalOutputHandler,
  startTelemetry,
  stopTelemetry,
} from '../services/ws'
import CommandContextMenu from '../components/CommandContextMenu.vue'
import { TERMINAL_MENU_ID } from '../services/terminalCommands'
import type { CommandContext } from '../services/context'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{ tabId: string }>()

const termEl = ref<HTMLDivElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let decoder = new TextDecoder('utf-8', { fatal: false })
const unwatchState = ref<() => void>()
const unwatchStream = ref<() => void>()
const unwatchActive = ref<() => void>()
const unwatchEncoding = ref<() => void>()

const tab = computed(() => store.tabs.find((t) => t.id === props.tabId))
const isActive = computed(() => store.activeTabId === props.tabId)
const encoder = new TextEncoder()

const activeState = computed(() => {
  const t = tab.value
  if (!t) return 'no-tab'
  if (!isActive.value) return 'inactive'
  if (t.state !== 'online') return 'not-online'
  if (!t.streamId) return 'online-no-terminal'
  return 'online'
})

function fitAndResize() {
  if (!terminal || !fitAddon) return
  fitAddon.fit()
}

function openTabTerminal() {
  if (!terminal || !fitAddon || !tab.value || tab.value.state !== 'online' || tab.value.streamId || !isActive.value) return
  fitAddon.fit()
  const { cols, rows } = terminal
  openTerminal(tab.value.sessionId, tab.value.terminalId, cols || 80, rows || 24)
}

function resetDecoder(encoding: string) {
  if (!terminal) return
  const flushed = decoder.decode()
  if (flushed) terminal.write(flushed)
  decoder = new TextDecoder(encoding, { fatal: false })
}

function writeOutput(data: Uint8Array) {
  if (!terminal) return
  try {
    const text = decoder.decode(data, { stream: true })
    terminal.write(text)
  } catch {
    terminal.write(data)
  }
}

function terminalContext(): CommandContext {
  const currentTab = tab.value
  return {
    area: 'terminal',
    tabId: props.tabId,
    terminal: terminal ?? undefined,
    hasSelection: terminal?.hasSelection() ?? false,
    isOnline: currentTab?.state === 'online',
    canPaste: !!(navigator.clipboard && navigator.clipboard.readText),
    tabEncoding: currentTab?.encoding,
  }
}

function isTerminalCanvasTarget(event: MouseEvent): boolean {
  const target = event.target
  return target instanceof HTMLCanvasElement && target.closest('.xterm-screen') !== null
}

onMounted(() => {
  if (!termEl.value || !tab.value) return

  terminal = new Terminal({
    cursorBlink: true,
    rightClickSelectsWord: false,
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

  terminal.onData((data: string) => {
    if (tab.value?.streamId) {
      sendTerminalInput(tab.value.streamId, encoder.encode(data))
    }
  })

  terminal.onResize(({ cols, rows }) => {
    if (tab.value?.streamId) {
      resizeTerminal(tab.value.terminalId, cols, rows)
    }
  })

  resizeObserver = new ResizeObserver(() => {
    if (isActive.value) {
      fitAndResize()
    }
  })
  resizeObserver.observe(termEl.value)

  unwatchState.value = watch(
    () => tab.value?.state,
    (state) => {
      if (state === 'error') {
        terminal?.writeln(`\r\n[session error: ${tab.value?.error}]`)
      }
    },
  )

  unwatchStream.value = watch(
    () => tab.value?.streamId,
    (streamId) => {
      if (streamId && tab.value) {
        setTerminalOutputHandler(streamId, (data: Uint8Array) => {
          writeOutput(data)
        })
      }
    },
  )

  unwatchActive.value = watch(
    activeState,
    (state, prev) => {
      if (!tab.value) return
      if (state !== 'inactive') {
        store.telemetry = tab.value.telemetry
        fitAndResize()
      }
      if (state === 'online-no-terminal') {
        openTabTerminal()
      } else if (state === 'online') {
        startTelemetry(tab.value.sessionId, 2000)
      } else if (prev === 'online' && tab.value.sessionId) {
        stopTelemetry(tab.value.sessionId)
      }
    },
    { immediate: true },
  )

  unwatchEncoding.value = watch(
    () => tab.value?.encoding,
    (enc, prev) => {
      if (enc && enc !== prev) {
        resetDecoder(enc)
      }
    },
  )

})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  unwatchState.value?.()
  unwatchStream.value?.()
  unwatchActive.value?.()
  unwatchEncoding.value?.()
  if (tab.value?.streamId) {
    setTerminalOutputHandler(tab.value.streamId, null)
  }
  if (tab.value?.sessionId) {
    stopTelemetry(tab.value.sessionId)
  }
  terminal?.dispose()
  terminal = null
})
</script>

<template>
  <CommandContextMenu
    v-if="tab"
    :menu-id="TERMINAL_MENU_ID"
    :context="terminalContext"
    :can-open="isTerminalCanvasTarget"
  >
    <div ref="termEl" class="shell-terminal" />
  </CommandContextMenu>
</template>

<style scoped>
.shell-terminal {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
