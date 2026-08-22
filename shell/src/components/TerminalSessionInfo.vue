<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { IconX } from '@tabler/icons-vue'

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
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span class="title">终端会话信息</span>
        <button type="button" class="close" @click="close">
          <IconX :size="16" />
        </button>
      </div>
      <div v-if="tab" class="modal-body">
        <div class="info-row">
          <span class="info-label">地址</span>
          <span class="info-value">{{ host?.address ?? '-' }}</span>
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
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-primary" @click="close">确定</button>
      </div>
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
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 480px;
  max-width: 90vw;
  max-height: 90vh;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.modal-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  border-bottom: 1px solid #3c3c3c;
}

.title {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}

.close {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close:hover {
  color: #fff;
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.info-label {
  color: #999;
  flex-shrink: 0;
  min-width: 80px;
}

.info-value {
  color: #ccc;
  word-break: break-all;
  text-align: right;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #3c3c3c;
}

.btn-primary {
  background: #0e639c;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:hover {
  background: #1177bb;
}
</style>
