<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { deleteHosts } from '../services/ws'
import UiAlertDialog from './UiAlertDialog.vue'

const hostsToDelete = computed(() =>
  store.hosts.filter((h) => store.deleteConfirmIds.includes(h.id))
)

const hasOpenTabs = computed(() =>
  store.tabs.some((t) => store.deleteConfirmIds.includes(t.hostId))
)

function close() {
  store.deleteConfirmOpen = false
  store.deleteConfirmIds = []
}

function confirm() {
  deleteHosts(store.deleteConfirmIds)
  close()
}
</script>

<template>
  <UiAlertDialog
    :open="true"
    :title="`删除 ${hostsToDelete.length} 个主机`"
    width="360px"
    action-label="删除"
    @close="close"
    @confirm="confirm"
  >
    <p v-if="hasOpenTabs" class="warning">
      这些主机已有打开的标签，删除配置不影响已打开的标签。
    </p>
    <ul class="host-list">
      <li v-for="h in hostsToDelete" :key="h.id">{{ h.name }}</li>
    </ul>
    <p class="hint">删除后不可恢复，是否继续？</p>
    <p v-if="store.error" class="error">{{ store.error }}</p>
  </UiAlertDialog>
</template>

<style scoped>
.warning {
  margin: 0 0 var(--workbench-space-2);
  color: #f59e0b;
  font-size: 12px;
}

.host-list {
  max-height: 120px;
  margin: 0 0 var(--workbench-space-3);
  padding-left: 1.25rem;
  overflow-y: auto;
  color: var(--workbench-text);
  font-size: 13px;
}

.hint {
  margin: 0;
  color: var(--workbench-text-muted);
  font-size: 12px;
}

.error {
  margin: var(--workbench-space-2) 0 0;
  color: #f87171;
  font-size: 12px;
}
</style>
