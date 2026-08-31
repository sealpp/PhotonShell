<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { store } from '../stores/app'
import { saveCredentialRecord } from '../services/vault'
import { addTab, reconnectTab } from '../services/ws'
import UiDialog from './UiDialog.vue'

const password = ref('')
const rememberPassword = ref(false)
const localError = ref('')
const saving = ref(false)

const host = () => store.hosts.find((h) => h.id === store.loginDialogHostId)

onMounted(() => {
  password.value = ''
  rememberPassword.value = false
  localError.value = store.loginDialogError
  saving.value = false
})

watch(
  () => store.loginDialogOpen,
  (open) => {
    if (!open) return
    password.value = ''
    rememberPassword.value = false
    localError.value = store.loginDialogError
    saving.value = false
  },
)

async function login() {
  const h = host()
  if (!h) return
  if (!password.value) {
    localError.value = '请输入 SSH 密码'
    return
  }

  localError.value = ''
  store.loginDialogError = ''
  saving.value = true

  try {
    if (rememberPassword.value) {
      await saveCredentialRecord(h.id, { password: password.value })
    }
    saving.value = false
  } catch (reason) {
    saving.value = false
    const message = reason instanceof Error ? reason.message : String(reason)
    localError.value = message
    return
  }

  if (store.loginDialogTabId) {
    const tab = store.tabs.find((t) => t.id === store.loginDialogTabId)
    if (!tab) {
      localError.value = 'tab not found'
      return
    }
    reconnectTab(tab, h, password.value, { allowLoginDialog: false })
  } else {
    addTab(h, password.value, store.loginDialogInsertAfterTabId, { allowLoginDialog: false })
  }
}

function close() {
  store.loginDialogOpen = false
  store.loginDialogHostId = ''
  store.loginDialogTabId = ''
  store.loginDialogError = ''
  store.loginDialogInsertAfterTabId = ''
  password.value = ''
  rememberPassword.value = false
  localError.value = ''
  saving.value = false
}
</script>

<template>
  <UiDialog
    :open="true"
    :title="host() ? `登录到 ${host()!.address}` : '登录'"
    description="输入 SSH 密码以连接。"
    width="420px"
    @close="close"
  >
    <div v-if="host()" class="host-info">
      <div class="info-row">
        <span class="info-label">地址</span>
        <span class="info-value">{{ host()!.address }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">端口</span>
        <span class="info-value">{{ host()!.port }}</span>
      </div>
      <div class="info-row">
        <span class="info-label">用户名</span>
        <span class="info-value">{{ host()!.username }}</span>
      </div>
    </div>
    <div v-else class="error">主机不存在</div>

    <div class="form-group">
      <label for="login-password">密码</label>
      <input
        id="login-password"
        v-model="password"
        type="password"
        placeholder="password"
        @keyup.enter="login"
      />
    </div>

    <div class="form-group remember">
      <label class="checkbox">
        <input v-model="rememberPassword" type="checkbox" />
        <span>记住密码</span>
      </label>
    </div>

    <p v-if="localError || store.loginDialogError" class="error">
      {{ localError || store.loginDialogError }}
    </p>

    <template #actions>
      <button
        type="button"
        class="workbench-dialog-button workbench-dialog-button--default"
        @click="close"
      >
        取消
      </button>
      <button
        type="button"
        class="workbench-dialog-button workbench-dialog-button--primary"
        :disabled="saving"
        @click="login"
      >
        {{ saving ? '保存中…' : '登录' }}
      </button>
    </template>
  </UiDialog>
</template>

<style scoped>
.host-info {
  margin-bottom: var(--workbench-space-3);
  padding: var(--workbench-space-2);
  background: var(--workbench-input-bg, #1e1e1e);
  border-radius: 4px;
  border: 1px solid var(--workbench-border, #333);
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 2px 0;
}

.info-label {
  color: var(--workbench-text-muted, #858585);
}

.info-value {
  color: var(--workbench-text, #cccccc);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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

.remember {
  margin-bottom: 0;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--workbench-space-1);
  color: var(--workbench-text, #cccccc);
  font-size: 13px;
  cursor: pointer;
}

.checkbox input {
  width: auto;
  margin: 0;
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
  margin: 0 0 var(--workbench-space-2) 0;
  color: #f87171;
  font-size: 12px;
}
</style>
