<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { create } from '@bufbuild/protobuf'
import { HostProfileSchema } from '../proto/photon_pb'
import { store } from '../stores/app'
import { addTab, createHost } from '../services/ws'
import { randomId } from '../utils/id'
import { IconX } from '@tabler/icons-vue'

const address = ref('127.0.0.1')
const port = ref(22)
const username = ref('root')
const password = ref('')
const localError = ref('')

onMounted(() => {
  localError.value = ''
  store.error = ''
  const h = store.hosts.find((h) => h.id === store.editingHostId)
  if (h) {
    address.value = h.address
    port.value = h.port
    username.value = h.username
  } else {
    address.value = '127.0.0.1'
    port.value = 22
    username.value = 'root'
  }
  password.value = ''
})

function submit() {
  localError.value = ''
  store.error = ''
  if (!password.value) {
    localError.value = '请输入 SSH 密码'
    return
  }
  const hostId = store.editingHostId || randomId()
  const host = create(HostProfileSchema, {
    id: hostId,
    address: address.value,
    port: port.value,
    username: username.value,
  })
  createHost(host)
  const insertAfterTabId = store.insertAfterTabId
  store.insertAfterTabId = ''
  addTab(host, password.value, insertAfterTabId)
}

function close() {
  store.connectionModalOpen = false
  store.editingHostId = ''
  store.insertAfterTabId = ''
  localError.value = ''
}
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span class="title">{{ store.editingHostId ? '连接' : '新建连接' }}</span>
        <button type="button" class="close" @click="close">
          <IconX :size="16" />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>地址</label>
            <input v-model="address" placeholder="address" required />
          </div>
          <div class="form-group">
            <label>端口</label>
            <input v-model.number="port" type="number" placeholder="port" required />
          </div>
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" placeholder="username" required />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="password" required />
        </div>
        <p class="hint">v0 安全模型：密码不落盘，每次连接都需输入。</p>
        <p v-if="localError || store.error" class="error">{{ localError || store.error }}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-default" @click="close">取消</button>
        <button type="button" class="btn-primary" @click="submit">登录</button>
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
  width: 520px;
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
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  color: #999;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

.form-row {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 0.75rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #ccc;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.hint {
  color: #888;
  font-size: 11px;
  margin: -0.25rem 0 0.75rem;
}

.error {
  color: #f87171;
  font-size: 12px;
  margin: 0;
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

.btn-primary {
  background: #0e639c;
  color: #fff;
}

.btn-primary:hover {
  background: #1177bb;
}

.btn-default {
  background: #3c3c3c;
  color: #ccc;
}

.btn-default:hover {
  background: #4a4a4a;
}
</style>
