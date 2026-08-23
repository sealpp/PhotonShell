<script setup lang="ts">
import { store } from '../stores/app'
import { IconChartLine } from '@tabler/icons-vue'
</script>

<template>
  <div class="actions-toolbar" role="toolbar" aria-label="工作区操作">
    <button
      type="button"
      class="tool-icon"
      :class="{ active: store.panelOpen }"
      :aria-pressed="store.panelOpen"
      aria-label="系统监控"
      title="系统监控"
      @click="store.panelOpen = !store.panelOpen"
    >
      <IconChartLine :size="16" />
    </button>
  </div>
</template>

<style scoped>
.actions-toolbar {
  box-sizing: border-box;
  position: absolute;
  top: 0;
  right: 0;
  z-index: 20;
  width: var(--actions-toolbar-width, 44px);
  height: var(--dv-tabs-and-actions-container-height, 35px);
  min-width: var(--actions-toolbar-width, 44px);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 0.5rem;
  background: #252526;
  border-bottom: 1px solid #1f1f1f;
}

.tool-icon {
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  padding: 0;
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
