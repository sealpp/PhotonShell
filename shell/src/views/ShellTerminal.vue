<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { store } from '../stores/app'
import {
  resizeTerminal,
  sendTerminalInput,
  setTerminalOutputHandler,
} from '../services/ws'
import CommandContextMenu from '../components/CommandContextMenu.vue'
import { TERMINAL_MENU_ID } from '../services/actions/menuIds'
import type { CommandContext } from '../services/context'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{ tabId: string }>()

const FIT_DEBOUNCE_MS = 100
const BACKEND_RESIZE_DEBOUNCE_MS = 80

const termEl = ref<HTMLDivElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let fitTimer: number | null = null
let backendResizeTimer: number | null = null
let pendingBackendResize: { terminalId: string; columns: number; rows: number } | null = null
let decoder = new TextDecoder('utf-8', { fatal: false })
const unwatchState = ref<() => void>()
const unwatchStream = ref<() => void>()
const unwatchActive = ref<() => void>()
const unwatchEncoding = ref<() => void>()
const unwatchTerminalMount = ref<() => void>()

let pendingStreamId: number | null = null

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

function scheduleFit() {
  if (fitTimer !== null) {
    window.clearTimeout(fitTimer)
  }

  fitTimer = window.setTimeout(() => {
    fitTimer = null
    fitAndResize()
  }, FIT_DEBOUNCE_MS)
}

function flushBackendResize() {
  backendResizeTimer = null
  const pending = pendingBackendResize
  pendingBackendResize = null
  if (!pending || !tab.value?.streamId) return

  resizeTerminal(pending.terminalId, pending.columns, pending.rows)
}

function scheduleBackendResize(columns: number, rows: number) {
  const currentTab = tab.value
  if (!currentTab?.streamId) return

  pendingBackendResize = {
    terminalId: currentTab.terminalId,
    columns,
    rows,
  }
  if (backendResizeTimer !== null) {
    window.clearTimeout(backendResizeTimer)
  }
  backendResizeTimer = window.setTimeout(flushBackendResize, BACKEND_RESIZE_DEBOUNCE_MS)
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

function isTerminalScreenTarget(event: MouseEvent): boolean {
  const target = event.target
  return target instanceof Element && target.closest('.xterm-screen') !== null
}

function getTerminalColor(name: string, fallback: string): string {
  if (!termEl.value) return fallback
  return getComputedStyle(termEl.value).getPropertyValue(name).trim() || fallback
}

function bindOutput() {
  const streamId = tab.value?.streamId ?? pendingStreamId
  if (!streamId || !terminal) return
  setTerminalOutputHandler(streamId, writeOutput)

  // Ensure the remote PTY receives the initial window size as soon as the
  // output handler is bound; xterm's onResize may not fire by itself.
  fitAddon?.fit()
  const currentTab = tab.value
  if (currentTab && currentTab.streamId) {
    resizeTerminal(currentTab.terminalId, terminal.cols, terminal.rows)
  }
}

function initTerminal() {
  if (terminal || !termEl.value || !tab.value) return

  terminal = new Terminal({
    cursorBlink: true,
    rightClickSelectsWord: false,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: 13,
    theme: {
      background: getTerminalColor('--terminal-background', '#0d0d0d'),
      foreground: getTerminalColor('--terminal-foreground', '#d4d4d4'),
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
    scheduleBackendResize(cols, rows)
  })

  resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect
    if (rect && rect.width > 0 && rect.height > 0) {
      scheduleFit()
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

  unwatchActive.value = watch(
    activeState,
    (state) => {
      if (!tab.value) return
      if (state !== 'inactive') {
        scheduleFit()
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

  bindOutput()
}

onMounted(() => {
  unwatchStream.value = watch(
    () => tab.value?.streamId,
    (streamId) => {
      if (streamId) {
        pendingStreamId = streamId
        bindOutput()
      }
    },
    { immediate: true },
  )

  unwatchTerminalMount.value = watch(
    [() => tab.value, () => termEl.value],
    () => initTerminal(),
    { flush: 'post', immediate: true },
  )
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  if (fitTimer !== null) {
    window.clearTimeout(fitTimer)
  }
  if (backendResizeTimer !== null) {
    window.clearTimeout(backendResizeTimer)
  }
  fitTimer = null
  backendResizeTimer = null
  pendingBackendResize = null
  unwatchState.value?.()
  unwatchStream.value?.()
  unwatchActive.value?.()
  unwatchEncoding.value?.()
  unwatchTerminalMount.value?.()
  if (tab.value?.streamId) {
    setTerminalOutputHandler(tab.value.streamId, null)
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
    :can-open="isTerminalScreenTarget"
  >
    <div class="shell-terminal">
      <div ref="termEl" class="shell-terminal-content" />
    </div>
  </CommandContextMenu>
</template>

<style scoped>
.shell-terminal {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--terminal-background, #0d0d0d);
}

.shell-terminal-content {
  width: 100%;
  height: 100%;
}

.shell-terminal :deep(.xterm .xterm-viewport) {
  background-color: var(--terminal-background, #0d0d0d);
}
</style>
