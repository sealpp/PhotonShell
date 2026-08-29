<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { store, type HostProfile } from '../stores/app'
import { addTab, createHost } from '../services/ws'
import { loadCredentialRecord, saveCredentialRecord } from '../services/vault'
import { randomId } from '../utils/id'
import UiDialog from '../components/UiDialog.vue'

const address = ref('127.0.0.1')
const port = ref(22)
const username = ref('root')
const password = ref('')
const localError = ref('')
const saving = ref(false)
const showUnsavedConfirm = ref(false)

const savedHostId = ref('')
const savedAddress = ref('')
const savedPort = ref(22)
const savedUsername = ref('root')
const savedPassword = ref<string | null>(null)

onMounted(init)

watch(() => store.editingHostId, init)

const isNew = computed(() => !store.editingHostId)

const isDirty = computed(() => {
  if (isNew.value) return true
  if (address.value !== savedAddress.value) return true
  if (port.value !== savedPort.value) return true
  if (username.value !== savedUsername.value) return true
  const currentPassword = password.value
  const storedPassword = savedPassword.value ?? ''
  return currentPassword !== storedPassword
})

const title = computed(() => (isNew.value ? '新建连接' : '编辑主机'))

function init() {
  localError.value = ''
  store.error = ''
  saving.value = false
  showUnsavedConfirm.value = false

  const h = store.hosts.find((host) => host.id === store.editingHostId)
  if (h) {
    address.value = h.address
    port.value = h.port
    username.value = h.username
    savedHostId.value = h.id
    savedAddress.value = h.address
    savedPort.value = h.port
    savedUsername.value = h.username
  } else {
    address.value = '127.0.0.1'
    port.value = 22
    username.value = 'root'
    savedHostId.value = ''
    savedAddress.value = '127.0.0.1'
    savedPort.value = 22
    savedUsername.value = 'root'
  }
  password.value = ''
  savedPassword.value = null
  loadSavedPassword()
}

async function loadSavedPassword() {
  if (!store.editingHostId) {
    savedPassword.value = ''
    return
  }
  try {
    const saved = await loadCredentialRecord(store.editingHostId)
    savedPassword.value = saved?.password ?? ''
  } catch (reason) {
    savedPassword.value = ''
    localError.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function hostFromForm(): HostProfile {
  const id = store.editingHostId || randomId()
  return {
    id,
    address: address.value,
    port: port.value,
    username: username.value,
  }
}

async function saveCredential() {
  if (!password.value) return
  await saveCredentialRecord(store.editingHostId, { password: password.value })
  savedPassword.value = password.value
}

async function save() {
  localError.value = ''
  store.error = ''
  saving.value = true

  try {
    const host = hostFromForm()
    await createHost(host)
    store.editingHostId = host.id
    savedHostId.value = host.id
    savedAddress.value = host.address
    savedPort.value = host.port
    savedUsername.value = host.username

    await saveCredential()

    saving.value = false
  } catch (reason) {
    saving.value = false
    const message = reason instanceof Error ? reason.message : String(reason)
    localError.value = message
  }
}

function login() {
  localError.value = ''
  store.error = ''

  if (isDirty.value) {
    showUnsavedConfirm.value = true
    return
  }

  const host = hostFromForm()
  const insertAfterTabId = store.insertAfterTabId
  store.insertAfterTabId = ''
  addTab(host, password.value, insertAfterTabId, { allowLoginDialog: false })
  close()
}

function confirmLoginWithoutSave() {
  showUnsavedConfirm.value = false
  const host = hostFromForm()
  const insertAfterTabId = store.insertAfterTabId
  store.insertAfterTabId = ''
  addTab(host, password.value, insertAfterTabId, { allowLoginDialog: false })
  close()
}

function cancelLoginConfirm() {
  showUnsavedConfirm.value = false
}

function close() {
  store.connectionModalOpen = false
  store.editingHostId = ''
  store.insertAfterTabId = ''
  localError.value = ''
  saving.value = false
  showUnsavedConfirm.value = false
}
</script>

<template>
  <UiDialog
    :open="true"
    :title="title"
    description="输入 SSH 主机连接信息；凭据会在 PWA 本地加密保存。"
    width="520px"
    @close="close"
  >
    <div class="form-row">
      <div class="form-group">
        <label for="host-address">地址</label>
        <input id="host-address" v-model="address" placeholder="address" />
      </div>
      <div class="form-group">
        <label for="host-port">端口</label>
        <input id="host-port" v-model.number="port" type="number" placeholder="port" />
      </div>
    </div>
    <div class="form-group">
      <label for="host-username">用户名</label>
      <input id="host-username" v-model="username" placeholder="username" />
    </div>
    <div class="form-group">
      <label for="host-password">密码</label>
      <input id="host-password" v-model="password" type="password" placeholder="password" />
    </div>
    <p v-if="localError || store.error" class="error">{{ localError || store.error }}</p>

    <template #actions>
      <div v-if="showUnsavedConfirm" class="unsaved-confirm">
        <span class="unsaved-message">当前内容未保存，继续登录将不会保存。</span>
        <div class="unsaved-actions">
          <button
            type="button"
            class="workbench-dialog-button workbench-dialog-button--default"
            @click="cancelLoginConfirm"
          >
            取消
          </button>
          <button
            type="button"
            class="workbench-dialog-button workbench-dialog-button--primary"
            @click="confirmLoginWithoutSave"
          >
            继续登录（不保存）
          </button>
        </div>
      </div>
      <template v-else>
        <button
          type="button"
          class="workbench-dialog-button workbench-dialog-button--default"
          @click="close"
        >
          取消
        </button>
        <button
          type="button"
          class="workbench-dialog-button"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? '保存中…' : '保存' }}
        </button>
        <button
          type="button"
          class="workbench-dialog-button workbench-dialog-button--primary"
          @click="login"
        >
          登录
        </button>
      </template>
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

.unsaved-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--workbench-space-3);
  width: 100%;
}

.unsaved-message {
  font-size: 13px;
  color: var(--workbench-text, #cccccc);
}

.unsaved-actions {
  display: flex;
  gap: var(--workbench-space-2);
  flex-shrink: 0;
}
</style>
