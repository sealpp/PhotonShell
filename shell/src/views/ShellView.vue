<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { store, type Tab } from '../stores/app'
import { closeTab } from '../services/ws'
import ShellTerminal from './ShellTerminal.vue'
import { IconChartLine, IconX } from '@tabler/icons-vue'

const tabsEl = ref<HTMLDivElement | null>(null)
let wheelHandler: ((e: WheelEvent) => void) | null = null

const draggedTabId = ref('')
const dropIndicatorVisible = ref(false)
const dropIndicatorLeft = ref(0)
let dragImageEl: HTMLElement | null = null

function activateTab(tab: Tab) {
  store.activeTabId = tab.id
}

function getTabEls(): HTMLElement[] {
  return Array.from(tabsEl.value?.querySelectorAll('.tab') ?? [])
}

function getRawDropIndex(clientX: number): number {
  const tabs = getTabEls()
  for (let i = 0; i < tabs.length; i++) {
    const rect = tabs[i].getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2) {
      return i
    }
  }
  return tabs.length
}

function updateDropIndicator(rawIndex: number) {
  if (!tabsEl.value) return
  const tabs = getTabEls()
  const containerRect = tabsEl.value.getBoundingClientRect()
  const scrollLeft = tabsEl.value.scrollLeft
  let left: number
  if (rawIndex >= tabs.length) {
    const last = tabs[tabs.length - 1]
    if (!last) return
    left = last.getBoundingClientRect().right - containerRect.left + scrollLeft
  } else {
    left = tabs[rawIndex].getBoundingClientRect().left - containerRect.left + scrollLeft
  }
  dropIndicatorLeft.value = left
  dropIndicatorVisible.value = true
}

function reorderTabs(rawDropIndex: number) {
  if (!draggedTabId.value) return
  const fromIndex = store.tabs.findIndex((t) => t.id === draggedTabId.value)
  if (fromIndex === -1) return
  let toIndex = rawDropIndex
  if (fromIndex < toIndex) toIndex--
  const [tab] = store.tabs.splice(fromIndex, 1)
  store.tabs.splice(toIndex, 0, tab)
}

function onDragStart(e: DragEvent, tab: Tab) {
  if (!e.dataTransfer) return
  if ((e.target as HTMLElement).closest('.tab-close')) {
    e.preventDefault()
    return
  }
  const el = e.currentTarget as HTMLElement
  draggedTabId.value = tab.id
  activateTab(tab)
  el.classList.add('dragging')

  e.dataTransfer.setData('text/plain', tab.id)
  e.dataTransfer.effectAllowed = 'move'

  const ghost = el.cloneNode(true) as HTMLElement
  ghost.style.opacity = '1'
  const wrapper = document.createElement('div')
  wrapper.style.cssText =
    'position: fixed; top: -1000px; left: -1000px; padding: 20px 0 0 20px; opacity: 0.5; pointer-events: none; z-index: -1;'
  wrapper.appendChild(ghost)
  document.body.appendChild(wrapper)
  dragImageEl = wrapper
  e.dataTransfer.setDragImage(wrapper, 0, 0)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (!draggedTabId.value || !tabsEl.value) return
  e.dataTransfer!.dropEffect = 'move'
  const rawIndex = getRawDropIndex(e.clientX)
  updateDropIndicator(rawIndex)
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  if (!draggedTabId.value || !tabsEl.value) return
  const rawIndex = getRawDropIndex(e.clientX)
  reorderTabs(rawIndex)
}

function onDragEnd(e: DragEvent) {
  const el = e.currentTarget as HTMLElement
  el.classList.remove('dragging')
  draggedTabId.value = ''
  dropIndicatorVisible.value = false
  if (dragImageEl) {
    document.body.removeChild(dragImageEl)
    dragImageEl = null
  }
}

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
      <div
        ref="tabsEl"
        class="tabs"
        @dragover.prevent="onDragOver($event)"
        @drop.prevent="onDrop($event)"
      >
        <div
          v-for="(tab, index) in store.tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: tab.id === store.activeTabId, dragging: tab.id === draggedTabId }"
          :data-tab-id="tab.id"
          draggable="true"
          @mousedown="activateTab(tab)"
          @dragstart="onDragStart($event, tab)"
          @dragend="onDragEnd"
          @dblclick="duplicateTab(tab)"
        >
          <span :class="tabDotClass(tab.state)" />
          <span class="tab-index">{{ index + 1 }}</span>
          <span class="tab-label">{{ tab.label }}</span>
          <button
            type="button"
            class="tab-close"
            title="断开连接"
            draggable="false"
            @mousedown.stop
            @click.stop="closeTab(tab.id)"
            @dblclick.stop
          >
            <IconX :size="16" />
          </button>
        </div>
        <div
          v-show="dropIndicatorVisible"
          class="drop-indicator"
          :style="{ left: dropIndicatorLeft + 'px' }"
        />
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
  position: relative;
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

.drop-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #ffffff;
  pointer-events: none;
  z-index: 1;
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

.tab.dragging {
  opacity: 0.5;
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
