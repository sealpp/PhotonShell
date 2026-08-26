<script setup lang="ts">
import { computed, ref } from 'vue'
import UiDialog from './UiDialog.vue'
import { store } from '../stores/app'
import {
  hasMasterPassword,
  setMasterPassword,
  unlockWithMasterPassword,
} from '../services/vault'
import { estimateStrength } from '../services/passwordStrength'

const password = ref('')
const confirmation = ref('')
const error = ref('')
const unlockMode = computed(() => hasMasterPassword() && !store.vaultUnlocked)
const strength = computed(() => {
  if (unlockMode.value || password.value.length === 0) {
    return undefined
  }
  return estimateStrength(password.value)
})

async function submit() {
  error.value = ''
  if (!unlockMode.value && password.value !== confirmation.value) {
    error.value = '两次输入的主密码不一致'
    return
  }
  try {
    if (unlockMode.value) await unlockWithMasterPassword(password.value)
    else await setMasterPassword(password.value)
    store.vaultUnlocked = true
    close()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}

function close() {
  password.value = ''
  confirmation.value = ''
  error.value = ''
  store.vaultDialogOpen = false
}
</script>

<template>
  <UiDialog
    :open="true"
    :title="unlockMode ? '解锁 PWA 凭据' : '设置 PWA 主密码'"
    description="主密码用于恢复 PWA 本地加密凭据；忘记后无法恢复。"
    width="420px"
    @close="close"
  >
    <div class="form-group">
      <label for="vault-password">主密码</label>
      <input id="vault-password" v-model="password" type="password" autocomplete="current-password" />
      <div v-if="strength" class="strength-hint">
        <p class="strength-label" :class="`strength-label--${strength.variant}`">
          密码强度：{{ strength.label }}
        </p>
        <p v-if="strength.warning" class="strength-warning">{{ strength.warning }}</p>
        <ul v-if="strength.suggestions.length" class="strength-suggestions">
          <li v-for="(suggestion, index) in strength.suggestions" :key="index">{{ suggestion }}</li>
        </ul>
      </div>
    </div>
    <div v-if="!unlockMode" class="form-group">
      <label for="vault-password-confirm">确认主密码</label>
      <input id="vault-password-confirm" v-model="confirmation" type="password" autocomplete="new-password" @keyup.enter="submit" />
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <template #actions>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="close">取消</button>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--primary" @click="submit">{{ unlockMode ? '解锁' : '保存' }}</button>
    </template>
  </UiDialog>
</template>

<style scoped>
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

.strength-hint {
  margin-top: var(--workbench-space-1);
  font-size: 12px;
}

.strength-label {
  margin: 0;
}

.strength-label--weak {
  color: #f87171;
}

.strength-label--medium {
  color: #facc15;
}

.strength-label--strong {
  color: #4ade80;
}

.strength-warning,
.strength-suggestions {
  margin: var(--workbench-space-1) 0 0;
  color: var(--workbench-text-muted);
  padding-left: var(--workbench-space-4);
}

.strength-suggestions {
  list-style: disc;
}

.strength-suggestions li {
  margin: 0;
}
</style>
