<script setup lang="ts">
import { computed } from 'vue'
import { DropdownMenuItem, DropdownMenuLabel } from 'reka-ui'
import UiDropdownMenu from './UiDropdownMenu.vue'
import { store } from '../stores/app'
import { menuRegistry } from '../services/commands'
import { NODE_MENU_ID } from '../services/nodeCommands'
import { wsUrl } from '../services/ws'

const nodeHost = computed(() => {
  try {
    const url = new URL(wsUrl())
    const port = url.port
    if (port === '80' || port === '443' || !port) return url.hostname
    return `${url.hostname}:${port}`
  } catch {
    return wsUrl().replace(/^wss?:\/\//, '')
  }
})

const nodeStatus = computed(() => {
  if (!store.paired) return 'unpaired'
  return store.nodeConnected ? 'connected' : 'disconnected'
})

const items = computed(() => menuRegistry.resolve(NODE_MENU_ID, {
  area: 'node',
  isPaired: store.paired,
}))

function execute(item: typeof items.value[number]) {
  if (item.disabled || !item.action) return
  void item.action()
}
</script>

<template>
  <UiDropdownMenu content-class="node-menu" side="top" align="start">
    <template #trigger>
      <button
        type="button"
        class="node-status"
        :class="nodeStatus"
        :title="store.paired ? `Node: ${nodeHost} (${nodeStatus === 'connected' ? '已连接' : '未连接'})` : 'Node: 未配对，点击配对'"
      >
        <i class="codicon codicon-remote" />
        <span v-if="store.paired" class="node-label">WS: {{ nodeHost }}</span>
        <span v-else class="node-label">未配对</span>
      </button>
    </template>

    <DropdownMenuLabel class="menu-header">Node 操作</DropdownMenuLabel>
    <DropdownMenuItem
      v-for="item in items"
      :key="item.id"
      class="menu-item"
      :disabled="item.disabled"
      @select="execute(item)"
    >
      <component :is="item.icon" v-if="item.icon" :size="16" />
      <span class="label">{{ item.label }}</span>
    </DropdownMenuItem>
    <DropdownMenuLabel class="menu-footer">{{ wsUrl() }}</DropdownMenuLabel>
  </UiDropdownMenu>
</template>

<style scoped>
.node-status {
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--workbench-space-1);
  padding: 0 var(--workbench-space-3);
  border: 0;
  background: #3c3c3c;
  color: var(--workbench-text);
  cursor: pointer;
  user-select: none;
  font: inherit;
}

.node-status:hover {
  filter: brightness(1.1);
}

.node-status.connected {
  background: var(--workbench-accent);
  color: var(--workbench-text-strong);
}

.node-status.disconnected {
  background: var(--workbench-danger);
  color: var(--workbench-text-strong);
}

.node-status .codicon {
  font-size: 14px;
}

.node-label {
  font-size: 12px;
}

</style>
