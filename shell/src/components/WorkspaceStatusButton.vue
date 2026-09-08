<script setup lang="ts">
import { computed } from 'vue'
import { IconFolder } from '@tabler/icons-vue'
import { commandService } from '../services/commands'
import { store } from '../stores/app'

const open = computed(() => store.workspacePanelOpen)

function toggle(): void {
  void commandService.execute('workbench.toggleWorkspacePanel', { area: 'global' })
}
</script>

<template>
  <button
    type="button"
    class="workspace-status"
    :class="{ active: open }"
    :aria-pressed="open"
    :title="open ? '隐藏文件工作区' : '显示文件工作区'"
    @click="toggle"
  >
    <IconFolder :size="14" aria-hidden="true" />
    <span>文件</span>
  </button>
</template>

<style scoped>
.workspace-status {
  height: 100%;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}

.workspace-status:hover,
.workspace-status.active {
  background: #3c3c3c;
  color: #fff;
}
</style>
