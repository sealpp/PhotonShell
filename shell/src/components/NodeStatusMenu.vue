<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { store } from '../stores/app'
import { menuRegistry } from '../services/commands'
import { NODE_MENU_ID } from '../services/nodeCommands'
import { usePortalTarget } from '../ui/portal'
import { wsUrl } from '../services/ws'

const triggerEl = ref<HTMLElement | null>(null)
const portalTarget = usePortalTarget(triggerEl)

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
  if (!store.token) return 'unpaired'
  return store.nodeConnected ? 'connected' : 'disconnected'
})

const items = computed(() => menuRegistry.resolve(NODE_MENU_ID, {
  area: 'node',
  hasToken: Boolean(store.token),
}))

function execute(item: typeof items.value[number]) {
  if (item.disabled || !item.action) return
  void item.action()
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <button
        ref="triggerEl"
        type="button"
        class="node-status"
        :class="nodeStatus"
        :title="store.token ? `Node: ${nodeHost} (${nodeStatus === 'connected' ? '已连接' : '未连接'})` : 'Node: 未配对，点击配对'"
      >
        <i class="codicon codicon-remote" />
        <span v-if="store.token" class="node-label">WS: {{ nodeHost }}</span>
        <span v-else class="node-label">未配对</span>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to="portalTarget">
      <DropdownMenuContent
        class="node-menu"
        side="top"
        align="start"
        :side-offset="4"
        :collision-padding="8"
        :avoid-collisions="true"
      >
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
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
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

.node-menu {
  min-width: 320px;
  max-width: 90vw;
  overflow: hidden;
  padding: var(--workbench-space-2) 0;
  background: var(--workbench-surface);
  border: 1px solid var(--workbench-border-muted);
  border-radius: var(--workbench-radius);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  color: var(--workbench-text);
  z-index: var(--workbench-layer-dropdown);
}

.menu-header,
.menu-footer {
  display: block;
  padding: var(--workbench-space-2) var(--workbench-space-3);
  color: var(--workbench-text-muted);
  font-size: 11px;
}

.menu-header {
  color: var(--workbench-text-strong);
  font-size: 12px;
  font-weight: 600;
}

.menu-footer {
  border-top: 1px solid var(--workbench-border-muted);
  word-break: break-all;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--workbench-space-2);
  width: 100%;
  padding: var(--workbench-space-2) var(--workbench-space-3);
  border: 0;
  background: transparent;
  color: var(--workbench-text);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}

.menu-item[data-highlighted] {
  background: var(--workbench-accent);
  color: var(--workbench-text-strong);
}

.menu-item[data-disabled] {
  color: var(--workbench-text-disabled);
  cursor: default;
}

.label {
  flex: 1;
}
</style>
