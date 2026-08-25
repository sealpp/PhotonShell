<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { DockviewVue, themeAbyss } from 'dockview-vue'
import type { DockviewApi, DockviewReadyEvent } from 'dockview-vue'
import type { Tab } from '../stores/app'
import { store } from '../stores/app'
import TerminalPanel from './TerminalPanel.vue'
import TerminalTab from './TerminalTab.vue'

const api = ref<DockviewApi | null>(null)
let unsubs: (() => void)[] = []
let ignoreStoreActive = false
let ignoreDockviewActive = false

const components = { terminal: TerminalPanel }
const tabComponents = { terminalTab: TerminalTab }

function onReady(event: DockviewReadyEvent) {
  api.value = event.api

  // When Dockview active panel changes, update store.activeTabId.
  const activeSub = event.api.onDidActivePanelChange(({ panel }) => {
    if (ignoreDockviewActive) return
    ignoreStoreActive = true
    store.activeTabId = panel?.id ?? ''
    nextTick(() => {
      ignoreStoreActive = false
    })
  })
  unsubs.push(() => activeSub.dispose())

  // Sync any existing tabs to panels.
  for (const tab of store.tabs) {
    addPanel(tab)
  }

  // Set active panel from store without triggering the reactive sync.
  if (store.activeTabId && api.value) {
    const panel = api.value.getPanel(store.activeTabId)
    if (panel) {
      ignoreDockviewActive = true
      panel.api.setActive()
      nextTick(() => {
        ignoreDockviewActive = false
      })
    }
  }
}

function addPanel(tab: Tab) {
  if (!api.value) return
  if (api.value.getPanel(tab.id)) return
  const host = store.hosts.find((h) => h.id === tab.hostId)
  const title = host ? `${host.address}:${host.port}` : tab.label || tab.id
  api.value.addPanel({
    id: tab.id,
    title,
    component: 'terminal',
    tabComponent: 'terminalTab',
    params: { tabId: tab.id },
    renderer: 'always',
  })

  if (store.activeTabId === tab.id) {
    nextTick(() => {
      if (store.activeTabId === tab.id) {
        api.value?.getPanel(tab.id)?.api.setActive()
      }
    })
  }
}

function removePanel(tabId: string) {
  if (!api.value) return
  const panel = api.value.getPanel(tabId)
  if (panel) {
    api.value.removePanel(panel)
  }
}

// Watch store.tabs to add/remove panels.
watch(
  () => store.tabs.map((t) => t.id),
  (newIds, oldIds) => {
    if (!api.value) return
    const old = oldIds || []
    const added = newIds.filter((id) => !old.includes(id))
    const removed = old.filter((id) => !newIds.includes(id))

    for (const id of removed) {
      removePanel(id)
    }
    for (const id of added) {
      const tab = store.tabs.find((t) => t.id === id)
      if (tab) addPanel(tab)
    }
  },
  { flush: 'post' },
)

// Watch store.activeTabId to sync active panel.
watch(
  () => store.activeTabId,
  (id) => {
    if (ignoreStoreActive || !id || !api.value) return
    const panel = api.value.getPanel(id)
    if (panel) {
      ignoreDockviewActive = true
      panel.api.setActive()
      nextTick(() => {
        ignoreDockviewActive = false
      })
    }
  },
)

onBeforeUnmount(() => {
  unsubs.forEach((u) => u())
  unsubs = []
  api.value = null
})
</script>

<template>
  <DockviewVue
    class="main-dock"
    :theme="themeAbyss"
    :components="(components as any)"
    :tab-components="(tabComponents as any)"
    :default-tab-component="(TerminalTab as any)"
    @ready="onReady"
  />
</template>

<style>
.main-dock {
  width: 100%;
  height: 100%;
}

.main-dock .dv-tabs-and-actions-container {
  box-sizing: border-box;
  padding-right: var(--actions-toolbar-width, 0px);
}

.main-dock .dv-dockview {
  --dv-group-view-background-color: var(--terminal-background, #0d0d0d);
  --dv-tabs-and-actions-container-background-color: #252526;
  --dv-tabs-and-actions-container-height: 35px;
  --dv-activegroup-visiblepanel-tab-background-color: var(--terminal-background, #0d0d0d);
  --dv-inactivegroup-visiblepanel-tab-background-color: #2d2d2d;
  --dv-activegroup-hiddenpanel-tab-background-color: #2d2d2d;
  --dv-inactivegroup-hiddenpanel-tab-background-color: #2d2d2d;
  --dv-activegroup-visiblepanel-tab-color: #ffffff;
  --dv-inactivegroup-visiblepanel-tab-color: rgba(255, 255, 255, 0.5);
  --dv-tab-divider-color: #1f1f1f;
}
</style>
