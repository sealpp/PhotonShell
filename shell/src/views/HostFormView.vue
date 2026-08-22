<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { create } from '@bufbuild/protobuf'
import { HostProfileSchema } from '../proto/photon_pb'
import { store } from '../stores/app'
import { addTab, createHost } from '../services/ws'
import { randomId } from '../utils/id'
import UiDialog from '../components/UiDialog.vue'

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
  <UiDialog
    :open="true"
    :title="store.editingHostId ? '连接' : '新建连接'"
    description="输入 SSH 主机连接信息；密码不会保存。"
    width="520px"
    @close="close"
  >
    <div class="form-row">
      <div class="form-group">
        <label for="host-address">地址</label>
        <input id="host-address" v-model="address" placeholder="address" required />
      </div>
      <div class="form-group">
        <label for="host-port">端口</label>
        <input id="host-port" v-model.number="port" type="number" placeholder="port" required />
      </div>
    </div>
    <div class="form-group">
      <label for="host-username">用户名</label>
      <input id="host-username" v-model="username" placeholder="username" required />
    </div>
    <div class="form-group">
      <label for="host-password">密码</label>
      <input id="host-password" v-model="password" type="password" placeholder="password" required />
    </div>
    <p v-if="localError || store.error" class="error">{{ localError || store.error }}</p>

    <template #actions>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="close">取消</button>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--primary" @click="submit">登录</button>
    </template>
  </UiDialog>
</template>

<style scoped>
.form-row {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: var(--workbench-space-3);
}

.form-group {
  margin-bottom: var(--workbench-space-3);
}

.form-group label {
  display: block;
  margin-bottom: var(--workbench-space-1);
  color: var(--workbench-text-muted);
  font-size: 12px;
}

input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--workbench-space-2);
  border: 1px solid var(--workbench-border);
  border-radius: 4px;
  background: var(--workbench-input-bg);
  color: var(--workbench-text);
  font-size: 13px;
}

.error {
  margin: 0;
  color: #f87171;
  font-size: 12px;
}
</style>
