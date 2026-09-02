<script setup lang="ts">
import { store } from '../stores/app'
import UiDialog from './UiDialog.vue'

function close() {
  store.aboutModalOpen = false
}
</script>

<template>
  <UiDialog
    :open="store.aboutModalOpen"
    title="关于 PhotonShell"
    width="320px"
    :show-title="false"
    content-class="about-dialog-content"
    @close="close"
  >
    <div class="about-dialog-body">
      <img src="/icon.svg" class="about-dialog-logo" alt="PhotonShell" />
      <span>PhotonShell</span>
    </div>
  </UiDialog>
</template>
