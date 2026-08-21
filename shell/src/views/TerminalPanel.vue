<script setup lang="ts">
import { computed } from 'vue'
import ShellTerminal from './ShellTerminal.vue'

const props = defineProps<{
  params: {
    params: { tabId: string; [key: string]: any }
    [key: string]: any
  }
}>()

const tabId = computed(() => props.params?.params?.tabId ?? '')
</script>

<template>
  <div class="terminal-panel">
    <ShellTerminal v-if="tabId" :tab-id="tabId" />
  </div>
</template>

<style scoped>
.terminal-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>
