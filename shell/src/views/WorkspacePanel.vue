<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IconFile, IconFolder } from '@tabler/icons-vue'
import { store, type WorkspaceCategory } from '../stores/app'

const MIN_HEIGHT = 220
const MAX_HEIGHT_RATIO = 0.6
const DEFAULT_HEIGHT_RATIO = 0.35

const panelEl = ref<HTMLElement | null>(null)
const resizing = ref(false)
let activePointerId: number | null = null
let startPointerY = 0
let startHeight = 0

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

onMounted(() => {
  initializeHeight()
  window.addEventListener('resize', onViewportResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
  endResize()
})
</script>

<template>
  <section v-if="visible" ref="panelEl" class="workspace-panel" :style="heightStyle" aria-label="文件工作区">
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
      <div v-if="store.workspaceCategory === 'files'" class="workspace-empty">
        <IconFolder :size="22" aria-hidden="true" />
        <span>暂无文件列表</span>
      </div>
      <div v-else class="workspace-empty">
        <IconFile :size="22" aria-hidden="true" />
        <span>暂无打开的文件</span>
      </div>
    </div>
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
  min-height: 0;
  min-width: 0;
  flex: 1;
  overflow: hidden;
}

.workspace-empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #777;
}
</style>
