<script setup lang="ts">
import { store } from '../stores/app'
import UiDialog from './UiDialog.vue'

function close() {
  store.settingsModalOpen = false
}
</script>

<template>
  <UiDialog
    :open="store.settingsModalOpen"
    title="设置"
    width="80vw"
    height="80vh"
    content-class="settings-dialog-content"
    @close="close"
  />
</template>
