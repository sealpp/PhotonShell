<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IconFile, IconFolder } from '@tabler/icons-vue'
import { store, type WorkspaceCategory } from '../stores/app'
import WorkspaceDock from './WorkspaceDock.vue'

const MIN_HEIGHT = 220
const MAX_HEIGHT_RATIO = 0.6
const DEFAULT_HEIGHT_RATIO = 0.35
const MIN_LIST_WIDTH = 160
const MAX_LIST_WIDTH = 420

const panelEl = ref<HTMLElement | null>(null)
const resizing = ref(false)
let activePointerId: number | null = null
let startPointerY = 0
let startHeight = 0
let listResizing = false
let listPointerId: number | null = null
let listStartX = 0
let listStartWidth = 0

const visible = computed(() => store.view === 'shell' && store.workspacePanelOpen)
const heightStyle = computed(() => ({ height: `${store.workspacePanelHeight}px` }))

function clampHeight(value: number): number {
  const viewportHeight = window.innerHeight || 900
  const maxHeight = Math.max(MIN_HEIGHT, Math.round(viewportHeight * MAX_HEIGHT_RATIO))
  return Math.min(maxHeight, Math.max(MIN_HEIGHT, Math.round(value)))
}

function initializeHeight(): void {
  if (store.workspacePanelHeight === 320) {
    store.workspacePanelHeight = clampHeight(window.innerHeight * DEFAULT_HEIGHT_RATIO)
  } else {
    store.workspacePanelHeight = clampHeight(store.workspacePanelHeight)
  }
}

function selectCategory(category: WorkspaceCategory): void {
  store.workspaceCategory = category
  store.focusedDock = 'workspace'
}

function startResize(event: PointerEvent): void {
  if (event.button !== 0 || resizing.value) return
  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return
  event.preventDefault()
  resizing.value = true
  activePointerId = event.pointerId
  startPointerY = event.clientY
  startHeight = store.workspacePanelHeight
  target.setPointerCapture(event.pointerId)
}

function moveResize(event: PointerEvent): void {
  if (!resizing.value || activePointerId !== event.pointerId) return
  event.preventDefault()
  store.workspacePanelHeight = clampHeight(startHeight + startPointerY - event.clientY)
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
  if (visible.value) store.workspacePanelHeight = clampHeight(store.workspacePanelHeight)
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
  listStartWidth = store.workspaceInstanceListWidth
  target.setPointerCapture(event.pointerId)
}

function moveListResize(event: PointerEvent): void {
  if (!listResizing || listPointerId !== event.pointerId) return
  event.preventDefault()
  store.workspaceInstanceListWidth = clampListWidth(listStartWidth - (event.clientX - listStartX))
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
  initializeHeight()
  window.addEventListener('resize', onViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
  endResize()
  endListResize()
})
</script>

<template>
  <section v-show="visible" ref="panelEl" class="workspace-panel" :style="heightStyle" aria-label="文件工作区">
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
        :class="{ active: store.workspaceCategory === 'files' }"
        :aria-selected="store.workspaceCategory === 'files'"
        @click="selectCategory('files')"
      >
        <IconFolder :size="14" aria-hidden="true" />
        <span>文件列表</span>
      </button>
      <button
        type="button"
        role="tab"
        class="workspace-category"
        :class="{ active: store.workspaceCategory === 'editors' }"
        :aria-selected="store.workspaceCategory === 'editors'"
        @click="selectCategory('editors')"
      >
        <IconFile :size="14" aria-hidden="true" />
        <span>文件</span>
      </button>
    </nav>
    <div class="workspace-content">
      <div class="workspace-category-view" :class="{ active: store.workspaceCategory === 'files' }">
        <WorkspaceDock category="files" />
      </div>
      <div class="workspace-category-view" :class="{ active: store.workspaceCategory === 'editors' }">
        <WorkspaceDock category="editors" />
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
  --workspace-instance-list-width: v-bind('store.workspaceInstanceListWidth + "px"');
}

.workspace-category-view.active {
  display: flex;
}

.workspace-list-resizer {
  position: absolute;
  top: 35px;
  right: calc(v-bind('store.workspaceInstanceListWidth + "px"') - 4px);
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
