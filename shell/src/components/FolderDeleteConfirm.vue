<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { collectFolderDescendants, collectFolderHostIds } from '../services/connectionTree'
import { confirmFolderDeletion } from '../services/folderCommands'
import UiAlertDialog from './UiAlertDialog.vue'

const folderIds = computed(() => collectFolderDescendants(store.deleteFolderIds, store.folders))
const hostIds = computed(() => collectFolderHostIds(folderIds.value, store.hosts))
const folders = computed(() => store.folders.filter((folder) => folderIds.value.has(folder.id)))

function close() {
  store.deleteFolderConfirmOpen = false
  store.deleteFolderIds = []
}

async function confirm() {
  const ids = [...store.deleteFolderIds]
  await confirmFolderDeletion(ids)
  close()
}
</script>

<template>
  <UiAlertDialog
    :open="true"
    :title="`删除 ${folders.length} 个文件夹`"
    width="390px"
    action-label="删除"
    @close="close"
    @confirm="confirm"
  >
    <p class="warning">将同时删除其中的 {{ hostIds.length }} 个主机配置和凭据，已经打开的终端标签不会关闭。</p>
    <ul class="folder-list">
      <li v-for="folder in folders" :key="folder.id">{{ folder.name }}</li>
    </ul>
    <p class="hint">删除后不可恢复，是否继续？</p>
  </UiAlertDialog>
</template>

<style scoped>
.warning {
  margin: 0 0 var(--workbench-space-2);
  color: #f59e0b;
  font-size: 12px;
}

.folder-list {
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
</style>
