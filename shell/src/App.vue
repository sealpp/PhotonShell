<script setup lang="ts">
import { store } from './stores/app'
import PairingView from './views/PairingView.vue'
import HostFormView from './views/HostFormView.vue'
import ShellView from './views/ShellView.vue'
</script>

<template>
  <div class="app">
    <PairingView v-if="store.view === 'pairing'" />
    <HostFormView v-else-if="store.view === 'host-form'" />
    <ShellView v-else-if="store.view === 'shell'" />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  height: 100%;
  background: #0f172a;
  color: #e2e8f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.app {
  height: 100%;
}
</style>
