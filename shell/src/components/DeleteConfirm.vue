<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { deleteHosts } from '../services/ws'
import { IconX } from '@tabler/icons-vue'

const hostsToDelete = computed(() =>
  store.hosts.filter((h) => store.deleteConfirmIds.includes(h.id))
)

const isActive = computed(() =>
  store.view === 'shell' &&
  store.selectedHostId !== '' &&
  store.deleteConfirmIds.includes(store.selectedHostId)
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
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span class="title">
          删除 {{ hostsToDelete.length }} 个主机
        </span>
        <button type="button" class="close" @click="close">
          <IconX :size="16" />
        </button>
      </div>
      <div class="modal-body">
        <p class="warning" v-if="isActive">
          当前有连接中的主机，删除后会自动断开。
        </p>
        <ul class="host-list">
          <li v-for="h in hostsToDelete" :key="h.id">{{ h.address }}</li>
        </ul>
        <p class="hint">删除后不可恢复，是否继续？</p>
        <p v-if="store.error" class="error">{{ store.error }}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-default" @click="close">取消</button>
        <button type="button" class="btn-danger" @click="confirm">删除</button>
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
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 360px;
  max-width: 90vw;
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
}

.warning {
  color: #f59e0b;
  font-size: 12px;
  margin: 0 0 0.5rem;
}

.host-list {
  margin: 0 0 0.75rem;
  padding-left: 1.25rem;
  color: #ccc;
  font-size: 13px;
  max-height: 120px;
  overflow-y: auto;
}

.hint {
  color: #888;
  font-size: 12px;
  margin: 0;
}

.error {
  color: #f87171;
  font-size: 12px;
  margin: 0.5rem 0 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #3c3c3c;
}

.modal-actions button {
  padding: 0.4rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-danger {
  background: #c75450;
  color: #fff;
}

.btn-danger:hover {
  background: #d97370;
}

.btn-default {
  background: #3c3c3c;
  color: #ccc;
}

.btn-default:hover {
  background: #4a4a4a;
}
</style>
