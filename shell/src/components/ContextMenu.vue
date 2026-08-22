<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ResolvedCommand } from '../services/commands'

interface Props {
  items: ResolvedCommand[]
  x: number
  y: number
  autoFocus?: boolean
  isRoot?: boolean
}

const SUBMENU_DELAY = 180

interface ContextMenuExposed {
  contains: (target: Node) => boolean
  handleKey: (key: string, shift: boolean) => void
}

const props = withDefaults(defineProps<Props>(), { isRoot: true })
const emit = defineEmits<{ close: []; dismiss: []; keep: [keep: boolean] }>()

const menuEl = ref<HTMLDivElement | null>(null)
const itemEls = ref<Map<number, HTMLElement>>(new Map())
const activeIndex = ref(-1)
const submenu = ref<{ item: ResolvedCommand; index: number; x: number; y: number; autoFocus: boolean } | null>(null)
const openTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const closeTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const submenuRef = ref<ContextMenuExposed | null>(null)

const menuPosition = computed(() => {
  const rect = menuEl.value?.getBoundingClientRect()
  const width = rect?.width ?? 160
  const height = rect?.height ?? 200

  let left = props.x
  let top = props.y

  if (left + width > window.innerWidth) {
    left = Math.max(0, window.innerWidth - width)
  }
  if (top + height > window.innerHeight) {
    top = Math.max(0, top - height)
  }

  return { left, top }
})

onMounted(() => {
  nextTick(() => {
    if (props.autoFocus) {
      focusBoundary(1)
    } else {
      menuEl.value?.focus()
    }
  })
  if (props.isRoot) {
    document.addEventListener('mousedown', onDocumentClick, true)
  }
})

onBeforeUnmount(() => {
  clearTimers()
  if (props.isRoot) {
    document.removeEventListener('mousedown', onDocumentClick, true)
  }
})

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (target && !contains(target)) {
    emit('close')
  }
}

function clearTimers() {
  clearOpenTimer()
  clearCloseTimer()
}

function clearOpenTimer() {
  if (openTimer.value) {
    clearTimeout(openTimer.value)
    openTimer.value = null
  }
}

function startCloseTimer() {
  if (closeTimer.value || !submenu.value) return
  closeTimer.value = setTimeout(() => {
    closeTimer.value = null
    closeSubmenu(true)
  }, SUBMENU_DELAY)
}

function clearCloseTimer() {
  if (closeTimer.value) {
    clearTimeout(closeTimer.value)
    closeTimer.value = null
  }
}

function setItemRef(index: number, el: unknown) {
  if (el instanceof HTMLElement) {
    itemEls.value.set(index, el)
  } else if (!el) {
    itemEls.value.delete(index)
  }
}

function focusItem(index: number) {
  nextTick(() => {
    itemEls.value.get(index)?.focus()
  })
}

function findEnabledIndex(start: number, step: number): number {
  for (let offset = 0; offset < props.items.length; offset++) {
    const index = (start + offset * step + props.items.length) % props.items.length
    if (!props.items[index].disabled) return index
  }
  return -1
}

function focusBoundary(step: number) {
  if (!props.items.length) return
  const start = step > 0 ? 0 : props.items.length - 1
  const index = findEnabledIndex(start, step)
  if (index === -1) return
  activeIndex.value = index
  focusItem(index)
}

function move(step: number) {
  if (!props.items.length) return
  if (activeIndex.value === -1) {
    focusBoundary(step)
    return
  }
  const index = findEnabledIndex(activeIndex.value + step, step)
  if (index === -1) return
  activeIndex.value = index
  focusItem(index)
}

function getItemRect(index: number): DOMRect | undefined {
  return itemEls.value.get(index)?.getBoundingClientRect()
}

function openSubmenu(item: ResolvedCommand, index: number, autoFocus: boolean) {
  closeSubmenu(false)
  const rect = getItemRect(index)
  if (!rect) return
  activeIndex.value = index
  submenu.value = {
    item,
    index,
    x: rect.right + 2,
    y: rect.top,
    autoFocus,
  }
}

function closeSubmenu(restoreFocus: boolean) {
  const hadSubmenu = !!submenu.value
  clearCloseTimer()
  submenu.value = null
  if (restoreFocus && hadSubmenu) {
    nextTick(() => {
      if (activeIndex.value >= 0 && !props.items[activeIndex.value]?.disabled) {
        focusItem(activeIndex.value)
      } else {
        menuEl.value?.focus()
      }
    })
  }
}

function contains(target: Node): boolean {
  if (!target) return false
  if (menuEl.value?.contains(target)) return true
  if (submenuRef.value?.contains?.(target)) return true
  return false
}

function dismissTree() {
  if (props.isRoot) emit('close')
  else emit('dismiss')
}

function execute(item: ResolvedCommand) {
  if (item.disabled || !item.action) return
  item.action()
  dismissTree()
}

function onItemClick(item: ResolvedCommand, index: number) {
  if (item.disabled) return
  clearOpenTimer()
  if (item.children?.length) {
    clearCloseTimer()
    openSubmenu(item, index, false)
  } else {
    execute(item)
  }
}

function onItemEnter(item: ResolvedCommand, index: number) {
  activeIndex.value = index
  clearOpenTimer()

  if (submenu.value) {
    if (submenu.value.index === index) {
      clearCloseTimer()
    } else {
      startCloseTimer()
      if (item.children?.length) {
        openTimer.value = setTimeout(() => {
          openTimer.value = null
          openSubmenu(item, index, false)
        }, SUBMENU_DELAY)
      }
    }
  } else if (item.children?.length) {
    openTimer.value = setTimeout(() => {
      openTimer.value = null
      openSubmenu(item, index, false)
    }, SUBMENU_DELAY)
  }
}

function onItemLeave(index: number) {
  clearOpenTimer()
  if (submenu.value?.index === index) {
    startCloseTimer()
  }
}

function onMenuEnter() {
  clearCloseTimer()
  emit('keep', true)
}

function onMenuLeave() {
  clearOpenTimer()
  startCloseTimer()
  emit('keep', false)
}

function onSubmenuKeep(keep: boolean) {
  if (keep) {
    clearOpenTimer()
    clearCloseTimer()
  } else {
    startCloseTimer()
  }
  emit('keep', keep)
}

function onChildClose() {
  closeSubmenu(true)
}

function handleOwnKey(key: string, shift: boolean) {
  if (key === 'Escape' || key === 'ArrowLeft') {
    emit('close')
    return
  }

  if (key === 'ArrowDown') {
    move(1)
    return
  }

  if (key === 'ArrowUp') {
    move(-1)
    return
  }

  if (key === 'ArrowRight') {
    const item = props.items[activeIndex.value]
    if (item?.children?.length) {
      openSubmenu(item, activeIndex.value, true)
    }
    return
  }

  if (key === 'Enter') {
    const item = props.items[activeIndex.value]
    if (!item) return
    if (item.children?.length) {
      openSubmenu(item, activeIndex.value, true)
    } else {
      execute(item)
    }
    return
  }

  if (key === 'Tab') {
    move(shift ? -1 : 1)
  }
}

function handleKey(key: string, shift: boolean) {
  if (submenu.value && submenuRef.value) {
    submenuRef.value.handleKey(key, shift)
  } else {
    handleOwnKey(key, shift)
  }
}

function onKeyDown(event: KeyboardEvent) {
  const handledKeys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Enter', 'Tab', 'Escape']
  if (!handledKeys.includes(event.key)) return
  event.preventDefault()
  event.stopPropagation()
  handleKey(event.key, event.shiftKey)
}

defineExpose({ handleKey, contains })
</script>

<template>
  <div class="context-menu-overlay" @contextmenu.prevent>
    <div
      ref="menuEl"
      class="context-menu"
      :style="{ left: menuPosition.left + 'px', top: menuPosition.top + 'px' }"
      @mouseenter="onMenuEnter"
      @mouseleave="onMenuLeave"
      @keydown="onKeyDown"
      tabindex="-1"
    >
      <button
        v-for="(item, index) in props.items"
        :key="item.id"
        type="button"
        class="context-menu-item"
        :class="{ active: activeIndex === index, disabled: item.disabled, checked: item.checked }"
        :disabled="item.disabled"
        :ref="(el) => setItemRef(index, el)"
        @mouseenter="onItemEnter(item, index)"
        @mouseleave="onItemLeave(index)"
        @click="onItemClick(item, index)"
      >
        <span class="context-menu-check">{{ item.checked ? '✓' : '' }}</span>
        <span class="context-menu-label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="context-menu-shortcut">{{ item.shortcut }}</span>
        <span v-if="item.children?.length" class="context-menu-chevron">›</span>
      </button>
    </div>

    <ContextMenu
      v-if="submenu"
      ref="submenuRef"
      :items="submenu.item.children!"
      :x="submenu.x"
      :y="submenu.y"
      :auto-focus="submenu.autoFocus"
      :is-root="false"
      @close="onChildClose"
      @dismiss="dismissTree"
      @keep="onSubmenuKeep"
    />
  </div>
</template>

<style scoped>
.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 119;
  pointer-events: none;
}

.context-menu {
  position: fixed;
  min-width: 160px;
  max-height: 80vh;
  overflow-y: auto;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
  box-sizing: border-box;
  outline: none;
  pointer-events: auto;
  z-index: 120;
}

.context-menu-item {
  background: transparent;
  border: none;
  color: #cccccc;
  padding: 0.5rem 0.75rem;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  user-select: none;
  outline: none;
  min-height: 28px;
  box-sizing: border-box;
}

.context-menu-item:hover:not(:disabled),
.context-menu-item:focus:not(:disabled),
.context-menu-item.active:not(:disabled) {
  background: #0e639c;
  color: #fff;
}

.context-menu-item:disabled,
.context-menu-item.disabled {
  color: #666;
  cursor: default;
}

.context-menu-item.active:disabled,
.context-menu-item.active.disabled {
  background: #252526;
}

.context-menu-check {
  width: 14px;
  flex-shrink: 0;
  text-align: center;
}

.context-menu-label {
  flex: 1;
  white-space: nowrap;
}

.context-menu-shortcut {
  color: #888;
  font-size: 11px;
  margin-left: auto;
  padding-left: 1rem;
}

.context-menu-item:hover:not(:disabled) .context-menu-shortcut,
.context-menu-item:focus:not(:disabled) .context-menu-shortcut,
.context-menu-item.active:not(:disabled) .context-menu-shortcut {
  color: #ccc;
}

.context-menu-chevron {
  margin-left: auto;
  font-size: 14px;
  padding-left: 0.5rem;
}
</style>
