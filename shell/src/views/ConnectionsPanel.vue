<script setup lang="ts">
import { store } from '../stores/app'
import CommandContextMenu from '../components/CommandContextMenu.vue'
import type { CommandContext } from '../services/context'
import { HOST_MENU_ID } from '../services/hostCommands'
import { connectHost } from '../services/ws'
import { IconPlus, IconPlug } from '@tabler/icons-vue'

function isSelected(hostId: string): boolean {
  return store.selectedHostIds.has(hostId)
}

function toggleSelection(hostId: string) {
  const next = new Set(store.selectedHostIds)
  if (next.has(hostId)) {
    next.delete(hostId)
  } else {
    next.add(hostId)
  }
  store.selectedHostIds = next
}

function rangeSelection(targetId: string) {
  const ids = store.hosts.map((h) => h.id)
  const anchor = store.selectionAnchor
  const anchorIndex = anchor ? ids.indexOf(anchor) : -1
  const targetIndex = ids.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) {
    store.selectedHostIds = new Set([targetId])
    store.selectionAnchor = targetId
    return
  }
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  const next = new Set<string>()
  for (let i = start; i <= end; i++) {
    next.add(ids[i])
  }
  store.selectedHostIds = next
}

function onItemClick(host: typeof store.hosts[0], event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    toggleSelection(host.id)
    store.selectionAnchor = host.id
  } else if (event.shiftKey) {
    rangeSelection(host.id)
  } else {
    store.selectedHostIds = new Set([host.id])
    store.selectionAnchor = host.id
  }
}

function hostContext(host: typeof store.hosts[0]): CommandContext {
  if (!store.selectedHostIds.has(host.id)) {
    store.selectedHostIds = new Set([host.id])
    store.selectionAnchor = host.id
  }
  return {
    area: 'host',
    selectedIds: Array.from(store.selectedHostIds),
    selectedCount: store.selectedHostIds.size,
  }
}

function openNewConnection() {
  store.editingHostId = ''
  store.connectionModalOpen = true
}

function openConnect(host: typeof store.hosts[0]) {
  void connectHost(host)
}
</script>

<template>
  <div class="connections-panel">
    <div class="connections-header">
      <span>当前连接</span>
      <button type="button" class="new-btn" @click="openNewConnection">
        <IconPlus :size="12" />
        新建连接
      </button>
    </div>
    <div class="conn-list">
      <CommandContextMenu
        v-for="h in store.hosts"
        :key="h.id"
        :menu-id="HOST_MENU_ID"
        :context="() => hostContext(h)"
      >
        <div
          class="conn-item"
          :class="{ selected: isSelected(h.id) }"
          @click="onItemClick(h, $event)"
        >
          <div class="conn-info">
            <div class="name">{{ h.name }}</div>
            <div class="meta">{{ h.username }} · {{ h.port }}</div>
          </div>
          <button type="button" class="conn-btn" title="连接" @click.stop="openConnect(h)">
            <IconPlug :size="14" />
          </button>
        </div>
      </CommandContextMenu>
      <p v-if="!store.hosts.length" class="empty">暂无保存的主机</p>
    </div>
  </div>
</template>

<style scoped>
.connections-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #252526;
}

.connections-header {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  background: #2d2d2d;
  border-bottom: 1px solid #1f1f1f;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.new-btn {
  background: transparent;
  border: none;
  color: #4aaaff;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.new-btn:hover {
  color: #fff;
}

.conn-list {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.conn-item {
  display: flex;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border-left: 2px solid transparent;
  cursor: pointer;
  user-select: none;
}

.conn-item:hover {
  background: #2a2d2e;
}

.conn-item.selected {
  background: #37373d;
  border-left-color: #fff;
}

.conn-info {
  flex: 1;
  min-width: 0;
}

.conn-info .name {
  color: #fff;
  font-size: 12px;
}

.conn-info .meta {
  color: #858585;
  font-size: 11px;
  margin-top: 0.1rem;
}

.conn-btn {
  background: transparent;
  border: none;
  color: #858585;
  padding: 0.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.conn-btn:hover {
  color: #fff;
}

.empty {
  color: #888;
  font-size: 12px;
  text-align: center;
  padding: 1rem 0;
  margin: 0;
}
</style>
