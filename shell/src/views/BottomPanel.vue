<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { IconFile, IconFolder } from '@tabler/icons-vue'
import { store, type BottomPanelCategory } from '../stores/app'
import BottomPanelDock from './BottomPanelDock.vue'

const MIN_HEIGHT = 220
const DEFAULT_HEIGHT_RATIO = 0.35
const COLLAPSE_THRESHOLD = 160
const RESTORE_DRAG_THRESHOLD = 8
const MIN_LIST_WIDTH = 160
const MAX_LIST_WIDTH = 420

const panelEl = ref<HTMLElement | null>(null)
const resizing = ref(false)
const shellWorkspaceHeight = ref(0)
const terminalHeaderBottom = ref<number | null>(null)
const terminalHeaderHeight = ref(0)
let activePointerId: number | null = null
let startPointerY = 0
let startHeight = 0
let listResizing = false
let listPointerId: number | null = null
let listStartX = 0
let listStartWidth = 0
let resizeObserver: ResizeObserver | null = null
let observedHeader: Element | null = null

const visible = computed(() => store.view === 'shell' && store.bottomPanelOpen)
const heightStyle = computed(() => ({ height: store.bottomPanelMaximized ? '100%' : `${clampNormalHeight(store.bottomPanelHeight)}px` }))

function getShellWorkspace(): HTMLElement | null {
  const parent = panelEl.value?.parentElement
  return parent instanceof HTMLElement ? parent : null
}

function getNormalMaxHeight(): number {
  const availableHeight = shellWorkspaceHeight.value || getShellWorkspace()?.clientHeight || window.innerHeight || 900
  const shell = getShellWorkspace()
  if (!shell || terminalHeaderBottom.value === null) return Math.max(MIN_HEIGHT, Math.round(availableHeight))
  const shellRect = shell.getBoundingClientRect()
  const reservedTop = terminalHeaderBottom.value - shellRect.top + terminalHeaderHeight.value * 2
  return Math.max(MIN_HEIGHT, Math.round(availableHeight - reservedTop))
}

function clampNormalHeight(value: number): number {
  return Math.min(getNormalMaxHeight(), Math.max(MIN_HEIGHT, Math.round(value)))
}

function initializeHeight(): void {
  if (store.bottomPanelHeight === 320) {
    store.bottomPanelHeight = clampNormalHeight((shellWorkspaceHeight.value || window.innerHeight || 900) * DEFAULT_HEIGHT_RATIO)
  } else {
    store.bottomPanelHeight = clampNormalHeight(store.bottomPanelHeight)
  }
}

function measureLayout(): void {
  const shell = getShellWorkspace()
  if (!shell) return
  shellWorkspaceHeight.value = shell.clientHeight

  const hasTerminal = store.tabs.some((tab) => tab.kind === 'terminal')
  const header = hasTerminal ? shell.querySelector('.main-dock .dv-tabs-and-actions-container') : null
  if (header instanceof HTMLElement) {
    const rect = header.getBoundingClientRect()
    terminalHeaderBottom.value = rect.bottom
    terminalHeaderHeight.value = rect.height
  } else {
    terminalHeaderBottom.value = null
    terminalHeaderHeight.value = 0
  }

  if (observedHeader !== header) {
    if (observedHeader) resizeObserver?.unobserve(observedHeader)
    observedHeader = header
    if (header) resizeObserver?.observe(header)
  }
}

function enterMaximized(): void {
  if (store.bottomPanelMaximized) return
  store.bottomPanelRestoreHeight = startHeight
  store.bottomPanelHeight = clampNormalHeight(startHeight)
  store.bottomPanelMaximized = true
}

function restoreFromMaximized(): void {
  if (!store.bottomPanelMaximized) return
  store.bottomPanelMaximized = false
  store.bottomPanelHeight = clampNormalHeight(store.bottomPanelRestoreHeight)
}

function selectCategory(category: BottomPanelCategory): void {
  store.bottomPanelCategory = category
  store.focusedDock = 'bottomPanel'
}

function startResize(event: PointerEvent): void {
  if (event.button !== 0 || resizing.value) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  event.preventDefault()
  resizing.value = true
  activePointerId = event.pointerId
  startPointerY = event.clientY
  startHeight = store.bottomPanelMaximized ? store.bottomPanelRestoreHeight : store.bottomPanelHeight
  target.setPointerCapture(event.pointerId)
}

function moveResize(event: PointerEvent): void {
  if (!resizing.value || activePointerId !== event.pointerId) return
  event.preventDefault()
  if (store.bottomPanelMaximized) {
    if (event.clientY - startPointerY > RESTORE_DRAG_THRESHOLD) {
      restoreFromMaximized()
      endResize(event)
    }
    return
  }

  const requestedHeight = startHeight + startPointerY - event.clientY
  if (requestedHeight < COLLAPSE_THRESHOLD) {
    store.bottomPanelOpen = false
    store.bottomPanelMaximized = false
    endResize(event)
    return
  }

  const shell = getShellWorkspace()
  const shellTop = shell?.getBoundingClientRect().top ?? 0
  const maximizeBoundary = terminalHeaderBottom.value ?? shellTop
  if (event.clientY <= maximizeBoundary && requestedHeight > getNormalMaxHeight()) {
    enterMaximized()
    return
  }

  store.bottomPanelHeight = clampNormalHeight(requestedHeight)
}

function endResize(event?: PointerEvent): void {
  if (activePointerId === null) return
  if (event && event.pointerId !== activePointerId) return
  const target = event?.currentTarget
  const pointerId = activePointerId
  activePointerId = null
  resizing.value = false
  if (target instanceof HTMLElement && target.hasPointerCapture(pointerId)) {
    target.releasePointerCapture(pointerId)
  }
}

function onViewportResize(): void {
  measureLayout()
  if (visible.value && !store.bottomPanelMaximized) store.bottomPanelHeight = clampNormalHeight(store.bottomPanelHeight)
}

function clampListWidth(value: number): number {
  return Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, Math.round(value)))
}

function startListResize(event: PointerEvent): void {
  if (event.button !== 0 || listResizing) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  event.preventDefault()
  listResizing = true
  listPointerId = event.pointerId
  listStartX = event.clientX
  listStartWidth = store.bottomPanelInstanceListWidth
  target.setPointerCapture(event.pointerId)
}

function moveListResize(event: PointerEvent): void {
  if (!listResizing || listPointerId !== event.pointerId) return
  event.preventDefault()
  store.bottomPanelInstanceListWidth = clampListWidth(listStartWidth - (event.clientX - listStartX))
}

function endListResize(event?: PointerEvent): void {
  if (listPointerId === null) return
  if (event && event.pointerId !== listPointerId) return
  const target = event?.currentTarget
  const pointerId = listPointerId
  listPointerId = null
  listResizing = false
  if (target instanceof HTMLElement && target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') {
    initializeHeight()
    window.addEventListener('resize', onViewportResize)
    return
  }
  resizeObserver = new ResizeObserver(() => {
    measureLayout()
    if (visible.value && !store.bottomPanelMaximized) store.bottomPanelHeight = clampNormalHeight(store.bottomPanelHeight)
  })
  const shell = getShellWorkspace()
  if (shell) resizeObserver.observe(shell)
  void nextTick(() => {
    measureLayout()
    initializeHeight()
  })
  window.addEventListener('resize', onViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  observedHeader = null
  endResize()
  endListResize()
})

watch(
  () => [store.tabs.length, store.view, store.bottomPanelOpen],
  () => void nextTick(measureLayout),
)
</script>

<template>
  <section v-show="visible" ref="panelEl" class="workspace-panel" :class="{ maximized: store.bottomPanelMaximized }" :style="heightStyle" aria-label="文件工作区">
    <div
      class="workspace-resizer"
      :class="{ dragging: resizing }"
      role="separator"
      aria-label="调整文件工作区高度"
      @pointerdown="startResize"
      @pointermove="moveResize"
      @pointerup="endResize"
      @pointercancel="endResize"
      @lostpointercapture="endResize"
    ></div>
    <nav class="workspace-categories" role="tablist" aria-label="文件工作区功能">
      <button
        type="button"
        role="tab"
        class="workspace-category"
        :class="{ active: store.bottomPanelCategory === 'files' }"
        :aria-selected="store.bottomPanelCategory === 'files'"
        @click="selectCategory('files')"
      >
        <IconFolder :size="14" aria-hidden="true" />
        <span>文件列表</span>
      </button>
      <button
        type="button"
        role="tab"
        class="workspace-category"
        :class="{ active: store.bottomPanelCategory === 'editors' }"
        :aria-selected="store.bottomPanelCategory === 'editors'"
        @click="selectCategory('editors')"
      >
        <IconFile :size="14" aria-hidden="true" />
        <span>文件</span>
      </button>
    </nav>
    <div class="workspace-content">
      <div class="workspace-category-view" :class="{ active: store.bottomPanelCategory === 'files' }">
        <BottomPanelDock category="files" />
      </div>
      <div class="workspace-category-view" :class="{ active: store.bottomPanelCategory === 'editors' }">
        <BottomPanelDock category="editors" />
      </div>
    </div>
    <div
      class="workspace-list-resizer"
      :class="{ dragging: listResizing }"
      role="separator"
      aria-label="调整实例列表宽度"
      @pointerdown="startListResize"
      @pointermove="moveListResize"
      @pointerup="endListResize"
      @pointercancel="endListResize"
      @lostpointercapture="endListResize"
    ></div>
  </section>
</template>

<style scoped>
.workspace-panel {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  min-height: 0;
  min-width: 0;
  background: #1e1e1e;
  border-top: 1px solid #111;
  color: #ccc;
}

.workspace-panel.maximized {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100% !important;
  z-index: 20;
}

.workspace-resizer {
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  z-index: 25;
  height: 8px;
  cursor: row-resize;
  touch-action: none;
  user-select: none;
}

.workspace-resizer::before {
  content: '';
  position: absolute;
  inset: 2px 0;
  background: transparent;
  transition: background 0.12s ease;
}

.workspace-resizer:hover::before,
.workspace-resizer.dragging::before {
  background: rgba(74, 170, 255, 0.42);
}

.workspace-categories {
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  flex: 0 0 35px;
  min-height: 35px;
  padding-left: 8px;
  background: #252526;
  border-bottom: 1px solid #333;
}

.workspace-category {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 96px;
  padding: 0 13px;
  border: 0;
  border-top: 2px solid transparent;
  background: transparent;
  color: #999;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.workspace-category:hover {
  color: #fff;
  background: #2d2d2d;
}

.workspace-category.active {
  border-top-color: #3794ff;
  background: #1e1e1e;
  color: #fff;
}

.workspace-content {
  position: relative;
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.workspace-category-view {
  position: absolute;
  inset: 0;
  display: none;
  min-width: 0;
  min-height: 0;
  --workspace-instance-list-width: v-bind('store.bottomPanelInstanceListWidth + "px"');
}

.workspace-category-view.active {
  display: flex;
}

.workspace-list-resizer {
  position: absolute;
  top: 35px;
  right: calc(v-bind('store.bottomPanelInstanceListWidth + "px"') - 4px);
  bottom: 0;
  z-index: 20;
  width: 8px;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}

.workspace-list-resizer::before {
  content: '';
  position: absolute;
  inset: 0 3px;
  background: transparent;
}

.workspace-list-resizer:hover::before,
.workspace-list-resizer.dragging::before {
  background: rgba(74, 170, 255, 0.42);
}
</style>
