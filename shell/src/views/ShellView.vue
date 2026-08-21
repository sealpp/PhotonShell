<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { store, type Tab } from '../stores/app'
import { closeTab } from '../services/ws'
import ShellTerminal from './ShellTerminal.vue'
import { IconChartLine, IconX } from '@tabler/icons-vue'

const tabsEl = ref<HTMLDivElement | null>(null)
let wheelHandler: ((e: WheelEvent) => void) | null = null

function tabDotClass(state: string): string {
  if (state === 'online') return 'dot online'
  if (state === 'connecting') return 'dot connecting'
  return 'dot offline'
}

function duplicateTab(tab: Tab) {
  const host = store.hosts.find((h) => h.id === tab.hostId)
  if (!host) return
  store.editingHostId = host.id
  store.insertAfterTabId = tab.id
  store.connectionModalOpen = true
}

onMounted(() => {
  wheelHandler = (e: WheelEvent) => {
    if (!tabsEl.value) return
    if (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0) {
      tabsEl.value.scrollLeft += e.deltaX || e.deltaY
      e.preventDefault()
    }
  }
  tabsEl.value?.addEventListener('wheel', wheelHandler, { passive: false })
})

onBeforeUnmount(() => {
  if (wheelHandler && tabsEl.value) {
    tabsEl.value.removeEventListener('wheel', wheelHandler)
    wheelHandler = null
  }
})
</script>

<template>
  <div class="shell">
    <div class="terminal-toolbar">
      <div ref="tabsEl" class="tabs">
        <div
          v-for="(tab, index) in store.tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === store.activeTabId }"
          @click="store.activeTabId = tab.id"
          @dblclick="duplicateTab(tab)"
        >
          <span :class="tabDotClass(tab.state)" />
          <span class="tab-index">{{ index + 1 }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <button type="button" class="tab-close" title="断开连接" @click.stop="closeTab(tab.id)" @dblclick.stop>
            <IconX :size="16" />
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
    <div class="terminals">
      <ShellTerminal
        v-for="tab in store.tabs"
        :key="tab.id"
        :tab-id="tab.id"
        v-show="tab.id === store.activeTabId"
      />
    </div>
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
  height: 35px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  padding: 0;
  background: #252526;
  border-bottom: none;
  flex-shrink: 0;
}

.tabs {
  display: flex;
  align-items: stretch;
  flex: 1;
  gap: 0;
  overflow-x: auto;
  overflow-y: hidden;
  flex-wrap: nowrap;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.tabs:hover {
  scrollbar-color: #424242 transparent;
}

.tabs::-webkit-scrollbar {
  height: 3px;
}

.tabs::-webkit-scrollbar-track {
  background: transparent;
}

.tabs::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 2px;
}

.tabs:hover::-webkit-scrollbar-thumb {
  background: #424242;
}

.tab {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  background: #2d2d2d;
  color: rgba(255, 255, 255, 0.5);
  border: none;
  cursor: pointer;
  user-select: none;
  min-width: 0;
  flex-shrink: 0;
}

.tab:hover:not(.active) {
  background: #37373d;
  color: #ffffff;
}

.tab.active,
.tab.active:hover {
  background: #0d0d0d;
  color: #ffffff;
}

.tab-index {
  font-size: 11px;
  color: inherit;
  min-width: 1.2em;
  text-align: right;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot.online {
  background: #4ec9b0;
}

.dot.connecting {
  background: #ffcc00;
}

.dot.offline {
  background: #f44336;
}

.tab-label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 35px;
}

.tab-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
}

.tab:hover .tab-close,
.tab.active .tab-close {
  opacity: 1;
  pointer-events: auto;
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
  padding: 0 0.5rem;
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

.terminals {
  flex: 1;
  overflow: hidden;
}
</style>
