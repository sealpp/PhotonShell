<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { IconPlug, IconTrash } from '@tabler/icons-vue'

const selectedCount = computed(() => store.selectedHostIds.size)

function close() {
  store.contextMenuOpen = false
}

function openConnect() {
  if (selectedCount.value !== 1) return
  const id = Array.from(store.selectedHostIds)[0]
  store.editingHostId = id
  store.connectionModalOpen = true
  close()
}

function openDelete() {
  store.deleteConfirmIds = Array.from(store.selectedHostIds)
  store.deleteConfirmOpen = true
  close()
}
</script>

<template>
  <div class="overlay" @click.self="close" @contextmenu.prevent>
    <div class="menu" :style="{ left: store.contextMenuX + 'px', top: store.contextMenuY + 'px' }">
      <button
        type="button"
        class="menu-item"
        :disabled="selectedCount !== 1"
        @click="openConnect"
      >
        <IconPlug :size="16" />
        <span>连接</span>
      </button>
      <button type="button" class="menu-item" @click="openDelete">
        <IconTrash :size="16" />
        <span>删除 <span v-if="selectedCount > 1" class="count">({{ selectedCount }})</span></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 110;
  background: transparent;
}

.menu {
  position: absolute;
  min-width: 140px;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  padding: 0.25rem 0;
}

.menu-item {
  background: transparent;
  border: none;
  color: #cccccc;
  padding: 0.5rem 0.75rem;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.menu-item:hover:not(:disabled) {
  background: #0e639c;
  color: #fff;
}

.menu-item:disabled {
  color: #666;
  cursor: default;
}

.count {
  color: #888;
  font-size: 11px;
}
</style>
