<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { DockviewVue, themeAbyss } from 'dockview-vue'
import type { DockviewApi, DockviewReadyEvent } from 'dockview-vue'
import ConnectionsPanel from './ConnectionsPanel.vue'

const api = ref<DockviewApi | null>(null)
let unsubs: (() => void)[] = []

const components = { connections: ConnectionsPanel }

function onReady(event: DockviewReadyEvent) {
  api.value = event.api
  if (!event.api.getPanel('connections')) {
    event.api.addPanel({
      id: 'connections',
      title: '当前连接',
      component: 'connections',
    })
  }
  unsubs.push(() => event.api.dispose())
}

onBeforeUnmount(() => {
  unsubs.forEach((u) => u())
  unsubs = []
  api.value = null
})
</script>

<template>
  <DockviewVue
    class="sidebar-dock"
    :theme="themeAbyss"
    :components="(components as any)"
    @ready="onReady"
  />
</template>

<style>
.sidebar-dock {
  width: 100%;
  height: 100%;
}

.sidebar-dock .dv-dockview {
  --dv-group-view-background-color: #252526;
  --dv-tabs-and-actions-container-background-color: #2d2d2d;
  --dv-activegroup-visiblepanel-tab-background-color: #252526;
  --dv-inactivegroup-visiblepanel-tab-background-color: #2d2d2d;
  --dv-activegroup-visiblepanel-tab-color: #fff;
}
</style>
