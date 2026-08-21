<script setup lang="ts">
import { store } from '../stores/app'
import { IconChartLine } from '@tabler/icons-vue'
</script>

<template>
  <button
    type="button"
    class="tool-icon"
    :class="{ active: store.panelOpen }"
    title="系统监控"
    @click="store.panelOpen = !store.panelOpen"
  >
    <IconChartLine :size="16" />
  </button>
</template>

<style scoped>
.tool-icon {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon:hover {
  color: #fff;
  background: #3c3c3c;
}

.tool-icon.active {
  color: #4aaaff;
  background: #1a1a1a;
}
</style>
