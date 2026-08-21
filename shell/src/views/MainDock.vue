<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { DockviewVue, themeAbyss } from 'dockview-vue'
import type { DockviewApi, DockviewReadyEvent } from 'dockview-vue'
import type { Tab } from '../stores/app'
import { store } from '../stores/app'
import TerminalPanel from './TerminalPanel.vue'
import TerminalTab from './TerminalTab.vue'
import DockHeaderActions from './DockHeaderActions.vue'

const api = ref<DockviewApi | null>(null)
let unsubs: (() => void)[] = []
let ignoreStoreActive = false
let ignoreDockviewActive = false

const components = { terminal: TerminalPanel }
const tabComponents = { terminalTab: TerminalTab }

function onReady(event: DockviewReadyEvent) {
  api.value = event.api

  // Sync existing tabs to panels.
  for (const tab of store.tabs) {
    addPanel(tab)
  }

  // Set active panel from store.
  if (store.activeTabId) {
    const panel = api.value.getPanel(store.activeTabId)
    panel?.api.setActive()
  }

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

  // Track layout changes for persistence.
  const layoutSub = event.api.onDidLayoutChange(() => {
    saveLayout()
  })
  unsubs.push(() => layoutSub.dispose())

  // Restore layout if available.
  restoreLayout()
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
}

function removePanel(tabId: string) {
  if (!api.value) return
  const panel = api.value.getPanel(tabId)
  if (panel) {
    api.value.removePanel(panel)
  }
}

function saveLayout() {
  if (!api.value) return
  const layout = api.value.toJSON()
  localStorage.setItem('photon-main-layout', JSON.stringify(layout))
}

function restoreLayout() {
  if (!api.value) return
  const raw = localStorage.getItem('photon-main-layout')
  if (!raw) return
  try {
    const layout = JSON.parse(raw)
    if (layout && Object.keys(layout.panels || {}).length > 0) {
      api.value.fromJSON(layout)
    }
  } catch {
    localStorage.removeItem('photon-main-layout')
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
    :right-header-actions-component="(DockHeaderActions as any)"
    @ready="onReady"
  />
</template>

<style>
.main-dock {
  width: 100%;
  height: 100%;
}

.main-dock .dv-dockview {
  --dv-group-view-background-color: #0d0d0d;
  --dv-tabs-and-actions-container-background-color: #252526;
  --dv-tabs-and-actions-container-height: 35px;
  --dv-activegroup-visiblepanel-tab-background-color: #0d0d0d;
  --dv-inactivegroup-visiblepanel-tab-background-color: #2d2d2d;
  --dv-activegroup-hiddenpanel-tab-background-color: #2d2d2d;
  --dv-inactivegroup-hiddenpanel-tab-background-color: #2d2d2d;
  --dv-activegroup-visiblepanel-tab-color: #ffffff;
  --dv-inactivegroup-visiblepanel-tab-color: rgba(255, 255, 255, 0.5);
  --dv-tab-divider-color: #1f1f1f;
}
</style>
