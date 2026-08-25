<script setup lang="ts">
import UiDialog from './UiDialog.vue'
import { store } from '../stores/app'
import { respondHostKeyApproval } from '../services/hostKey'

function respond(accepted: boolean) {
  respondHostKeyApproval(accepted)
}
</script>

<template>
  <UiDialog
    v-if="store.hostKeyPrompt"
    :open="true"
    title="确认远端主机密钥"
    description="首次连接前请确认远端主机指纹；指纹变化时连接会被阻止。"
    width="520px"
    @close="respond(false)"
  >
    <dl class="host-key-details">
      <div>
        <dt>地址</dt>
        <dd>{{ store.hostKeyPrompt.host }}:{{ store.hostKeyPrompt.port }}</dd>
      </div>
      <div>
        <dt>SHA-256 指纹</dt>
        <dd class="fingerprint">{{ store.hostKeyPrompt.fingerprint }}</dd>
      </div>
    </dl>

    <template #actions>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="respond(false)">拒绝</button>
      <button id="host-key-accept" type="button" class="workbench-dialog-button workbench-dialog-button--primary" @click="respond(true)">接受并保存</button>
    </template>
  </UiDialog>
</template>

<style scoped>
.host-key-details {
  margin: 0;
  display: grid;
  gap: var(--workbench-space-3);
}

.host-key-details div {
  display: grid;
  gap: var(--workbench-space-1);
}

.host-key-details dt {
  color: var(--workbench-text-muted);
  font-size: 12px;
}

.host-key-details dd {
  margin: 0;
  color: var(--workbench-text-strong);
  word-break: break-all;
}

.fingerprint {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
