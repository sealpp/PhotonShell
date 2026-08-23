<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { closeTab } from '../services/ws'
import CommandContextMenu from '../components/CommandContextMenu.vue'
import type { CommandContext } from '../services/context'
import { TAB_MENU_ID } from '../services/tabCommands'
import { IconX } from '@tabler/icons-vue'

const props = defineProps<{
  params: {
    params: { tabId: string; [key: string]: any }
    api: {
      id: string
      title: string | undefined
      close: () => void
      [key: string]: any
    }
    [key: string]: any
  }
}>()

const tabId = computed(() => props.params?.params?.tabId ?? '')
const tab = computed(() => store.tabs.find((t) => t.id === tabId.value))
const title = computed(() => props.params?.api?.title || tab.value?.label || tabId.value)

const dotClass = computed(() => {
  const state = tab.value?.state
  if (state === 'online') return 'dot online'
  if (state === 'connecting') return 'dot connecting'
  return 'dot offline'
})

function onClose() {
  if (tabId.value) {
    closeTab(tabId.value)
  } else {
    props.params.api.close()
  }
}

function tabGroupTabIds(): string[] {
  const panels = props.params?.api?.group?.panels as Array<{ id?: string }> | undefined
  if (!Array.isArray(panels)) return tabId.value ? [tabId.value] : []
  return panels.map((panel) => panel.id).filter((id): id is string => !!id)
}

function tabContext(): CommandContext {
  return {
    area: 'tab',
    tabId: tabId.value,
    tabGroupTabIds: tabGroupTabIds(),
  }
}

function onDoubleClick() {
  if (!tab.value) return
  const host = store.hosts.find((h) => h.id === tab.value!.hostId)
  if (!host) return
  store.editingHostId = host.id
  store.insertAfterTabId = tab.value!.id
  store.connectionModalOpen = true
}
</script>

<template>
  <CommandContextMenu
    v-if="tab"
    :menu-id="TAB_MENU_ID"
    :context="tabContext"
  >
    <div class="terminal-tab" @dblclick="onDoubleClick">
      <span :class="dotClass" />
      <span class="terminal-tab-label" :title="title">{{ title }}</span>
      <button
        type="button"
        class="terminal-tab-close"
        title="断开连接"
        @click.stop="onClose"
        @dblclick.stop
      >
        <IconX :size="14" />
      </button>
    </div>
  </CommandContextMenu>
</template>

<style scoped>
.terminal-tab {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  user-select: none;
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

.terminal-tab-label {
  flex: 1;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.terminal-tab-close {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.1rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
}

.terminal-tab-close:hover {
  background: #c75450;
  color: #fff;
  opacity: 1;
}
</style>
