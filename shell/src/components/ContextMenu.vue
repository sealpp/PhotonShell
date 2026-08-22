<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ResolvedCommand } from '../services/commands'

interface Props {
  items: ResolvedCommand[]
  x: number
  y: number
  autoFocus?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  keep: [keep: boolean]
}>()

const menuEl = ref<HTMLDivElement | null>(null)
const itemEls = ref<Map<number, HTMLElement>>(new Map())
const activeIndex = ref(-1)
const submenu = ref<{ item: ResolvedCommand; index: number; x: number; y: number; autoFocus: boolean } | null>(null)
const openTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const closeTimer = ref<ReturnType<typeof setTimeout> | null>(null)

function viewportWidth() { return window.innerWidth }
function viewportHeight() { return window.innerHeight }

const menuPosition = computed(() => {
  const rect = menuEl.value?.getBoundingClientRect()
  const width = rect?.width ?? 160
  const height = rect?.height ?? 200

  let left = props.x
  let top = props.y

  if (left + width > viewportWidth()) {
    left = Math.max(0, viewportWidth() - width)
  }
  if (top + height > viewportHeight()) {
    top = Math.max(0, top - height)
  }

  return { left, top }
})

onMounted(() => {
  nextTick(() => {
    menuEl.value?.focus()
    if (props.autoFocus) {
      activeIndex.value = 0
      focusItem(0)
    }
  })
})

onBeforeUnmount(() => {
  if (openTimer.value) clearTimeout(openTimer.value)
  if (closeTimer.value) clearTimeout(closeTimer.value)
})

function setItemRef(index: number, el: unknown) {
  if (el instanceof HTMLElement) {
    itemEls.value.set(index, el)
  } else if (!el) {
    itemEls.value.delete(index)
  }
}

function focusItem(index: number) {
  nextTick(() => {
    const el = itemEls.value.get(index)
    if (el && 'focus' in el) {
      (el as HTMLElement).focus()
    }
  })
}

function move(step: number) {
  if (!props.items.length) return
  if (activeIndex.value === -1) {
    activeIndex.value = step > 0 ? 0 : props.items.length - 1
  } else {
    activeIndex.value = (activeIndex.value + step + props.items.length) % props.items.length
  }
  focusItem(activeIndex.value)
}

function getItemRect(index: number): DOMRect | undefined {
  return itemEls.value.get(index)?.getBoundingClientRect()
}

function openSubmenu(item: ResolvedCommand, index: number, autoFocus: boolean) {
  if (closeTimer.value) clearTimeout(closeTimer.value)
  const rect = getItemRect(index)
  if (!rect) return
  const childX = rect.right + 2
  const childY = rect.top
  submenu.value = { item, index, x: childX, y: childY, autoFocus }
}

function closeSubmenu() {
  submenu.value = null
}

function execute(item: ResolvedCommand) {
  if (item.disabled || !item.action) return
  item.action()
  emit('close')
}

function onItemClick(item: ResolvedCommand, index: number) {
  if (item.disabled) return
  if (openTimer.value) clearTimeout(openTimer.value)
  if (item.children?.length) {
    openSubmenu(item, index, false)
  } else {
    execute(item)
  }
}

function onItemEnter(item: ResolvedCommand, index: number) {
  activeIndex.value = index
  if (openTimer.value) clearTimeout(openTimer.value)
  if (closeTimer.value) clearTimeout(closeTimer.value)
  if (item.children?.length) {
    openTimer.value = setTimeout(() => {
      openSubmenu(item, index, false)
    }, 180)
  }
}

function onMenuLeave() {
  if (openTimer.value) clearTimeout(openTimer.value)
  closeTimer.value = setTimeout(() => {
    closeSubmenu()
  }, 250)
}

function onSubmenuKeep(keep: boolean) {
  emit('keep', keep)
  if (keep) {
    if (closeTimer.value) clearTimeout(closeTimer.value)
  } else {
    closeTimer.value = setTimeout(() => {
      closeSubmenu()
    }, 250)
  }
}

function onChildClose() {
  closeSubmenu()
  nextTick(() => {
    if (activeIndex.value >= 0) {
      focusItem(activeIndex.value)
    } else {
      menuEl.value?.focus()
    }
  })
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    move(1)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    move(-1)
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    const item = props.items[activeIndex.value]
    if (item?.children?.length) {
      openSubmenu(item, activeIndex.value, true)
    }
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    if (submenu.value) {
      closeSubmenu()
    } else {
      emit('close')
    }
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    const item = props.items[activeIndex.value]
    if (!item) return
    if (item.children?.length) {
      openSubmenu(item, activeIndex.value, true)
    } else {
      execute(item)
    }
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    move(event.shiftKey ? -1 : 1)
    return
  }
}

function onOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <div
    class="context-menu-overlay"
    @click.self="onOverlayClick"
    @contextmenu.prevent
    @mouseenter="emit('keep', true)"
    @mouseleave="emit('keep', false)"
  >
    <div
      ref="menuEl"
      class="context-menu"
      :style="{ left: menuPosition.left + 'px', top: menuPosition.top + 'px' }"
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
      :items="submenu.item.children!"
      :x="submenu.x"
      :y="submenu.y"
      :auto-focus="submenu.autoFocus"
      @close="onChildClose"
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
  z-index: 120;
  background: transparent;
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
