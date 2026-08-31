<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import UiDialog from './UiDialog.vue'

const tab = computed(() => {
  const id = store.terminalSessionInfo?.tabId
  return id ? store.tabs.find((t) => t.id === id) : undefined
})

const host = computed(() => {
  if (!tab.value) return undefined
  return store.hosts.find((h) => h.id === tab.value!.hostId)
})

function close() {
  store.terminalSessionInfo = null
}
</script>

<template>
  <UiDialog
    :open="true"
    title="终端会话信息"
    description="当前终端会话的连接和运行状态。"
    width="480px"
    @close="close"
  >
    <template v-if="tab">
      <div class="info-row">
        <span class="info-label">名称</span>
        <span class="info-value">{{ host?.name }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">端口</span>
        <span class="info-value">{{ host?.port ?? '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">用户名</span>
        <span class="info-value">{{ host?.username ?? '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">状态</span>
        <span class="info-value">{{ tab.state }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">sessionId</span>
        <span class="info-value">{{ tab.sessionId }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">terminalId</span>
        <span class="info-value">{{ tab.terminalId }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">streamId</span>
        <span class="info-value">{{ tab.streamId || '-' }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">编码</span>
        <span class="info-value">{{ tab.encoding }}</span>
      </div>
    </template>

    <template #actions>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--primary" @click="close">确定</button>
    </template>
  </UiDialog>
</template>

<style scoped>
.info-row {
  display: flex;
  justify-content: space-between;
  gap: var(--workbench-space-3);
  margin-bottom: var(--workbench-space-2);
  font-size: 13px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-label {
  flex-shrink: 0;
  min-width: 80px;
  color: var(--workbench-text-muted);
}

.info-value {
  color: var(--workbench-text);
  word-break: break-all;
  text-align: right;
}
</style>
