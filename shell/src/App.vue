<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { store } from './stores/app'
import { wsUrl, connect, loadWorkspace, saveWorkspace } from './services/ws'
import PairingView from './views/PairingView.vue'
import HostFormView from './views/HostFormView.vue'
import MainDock from './views/MainDock.vue'
import PrimarySidebar from './views/PrimarySidebar.vue'
import SecondarySidebar from './views/SecondarySidebar.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import HostContextMenu from './components/HostContextMenu.vue'
import DeleteConfirm from './components/DeleteConfirm.vue'
import { IconList, IconSettings } from '@tabler/icons-vue'
import NodeStatusMenu from './components/NodeStatusMenu.vue'

function parseNodeHost() {
  try {
    const url = new URL(wsUrl())
    const host = url.hostname
    const port = url.port
    if (port === '80' || port === '443' || !port) return host
    return `${host}:${port}`
  } catch {
    return wsUrl().replace(/^wss?:\/\//, '')
  }
}

const nodeHost = computed(() => parseNodeHost())
const nodeStatus = computed(() => {
  if (!store.token) return 'unpaired'
  return store.nodeConnected ? 'connected' : 'disconnected'
})

function toggleConnections() {
  if (store.sidebarOpen && store.sidebarView === 'connections') {
    store.sidebarOpen = false
  } else {
    store.sidebarOpen = true
    store.sidebarView = 'connections'
  }
}

onMounted(() => {
  loadWorkspace()
  if (!store.token) {
    store.pairingModalOpen = true
  } else {
    connect(store.token)
  }
})

watch(
  () => store.tabs.map((t) => `${t.id}:${t.hostId}:${t.label}`),
  () => saveWorkspace(),
)

watch(
  () => store.activeTabId,
  () => saveWorkspace(),
)

watch(
  () => store.view,
  () => saveWorkspace(),
)

watch(
  () => store.panelOpen,
  () => saveWorkspace(),
)

watch(
  () => store.sidebarOpen,
  () => saveWorkspace(),
)
</script>

<template>
  <div class="app">
    <div class="main">
      <div class="activity">
        <div class="top-icons">
          <div
            class="icon"
            :class="{ active: store.sidebarOpen && store.sidebarView === 'connections' }"
            title="当前连接"
            @click="toggleConnections"
          >
            <IconList :size="24" />
          </div>

        </div>
        <div class="bottom-icons">
          <div
            class="icon"
            title="设置"
            @click="store.settingsMenuOpen = true"
          >
            <IconSettings :size="24" />
          </div>
        </div>
      </div>
      <aside class="sidebar primary-sidebar" :class="{ collapsed: !store.sidebarOpen || store.sidebarView !== 'connections' }">
        <PrimarySidebar />
      </aside>
      <div class="terminal-area">
        <MainDock v-if="store.view === 'shell'" />
        <div v-else class="welcome">
          <div class="welcome-logo">
            <img src="/icon.svg" class="logo-img" alt="PhotonShell" />
          </div>
          <h2>PhotonShell</h2>
          <p v-if="!store.token">请点击左下角 Node 状态按钮，选择「配对」。</p>
          <p v-else-if="!store.hosts.length">暂无保存的主机，点击侧边栏「+ 新建连接」添加。</p>
          <p v-else>选择左侧主机（支持 Ctrl/Shift 多选），或右键批量操作。</p>
        </div>
      </div>
      <aside class="panel secondary-sidebar" :class="{ collapsed: !store.panelOpen }">
        <SecondarySidebar />
      </aside>
    </div>
    <div class="statusbar">
      <div class="node-status"
        :class="[nodeStatus]"
        :title="store.token ? `Node: ${nodeHost} (${nodeStatus === 'connected' ? '已连接' : '未连接'})` : 'Node: 未配对，点击配对'"
        @click="store.nodeMenuOpen = true"
      >
        <i class="codicon codicon-remote" />
        <span v-if="store.token" class="node-label">WS: {{ nodeHost }}</span>
        <span v-else class="node-label">未配对</span>
      </div>
    </div>
    <PairingView v-if="store.pairingModalOpen" />
    <HostFormView v-if="store.connectionModalOpen" />
    <SettingsMenu v-if="store.settingsMenuOpen" />
    <HostContextMenu v-if="store.contextMenuOpen" />
    <DeleteConfirm v-if="store.deleteConfirmOpen" />
    <NodeStatusMenu v-if="store.nodeMenuOpen" />
  </div>
</template>

<style>
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: #1e1e1e;
  color: #cccccc;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
}

button, input {
  font-family: inherit;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}

::-webkit-scrollbar-corner {
  background: #1e1e1e;
}

* {
  scrollbar-width: thin;
  scrollbar-color: #424242 #1e1e1e;
}
</style>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.activity {
  width: 48px;
  background: #333333;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-right: 1px solid #252526;
  flex-shrink: 0;
  gap: 0;
}

.top-icons {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  align-items: center;
}

.bottom-icons {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  align-items: center;
  margin-top: auto;
}

.activity .icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #858585;
  cursor: pointer;
  user-select: none;
}

.activity .icon:hover {
  color: #fff;
}

.activity .icon.active {
  color: #fff;
  background: #37373d;
  border-left: 2px solid #fff;
}

.sidebar {
  width: 220px;
  background: #252526;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1f1f1f;
  flex-shrink: 0;
  transition: width 0.15s ease;
  overflow: hidden;
}

.sidebar.collapsed {
  width: 0;
  border-right: none;
}

.sidebar.collapsed > * {
  display: none;
}

.terminal-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #1e1e1e;
  overflow: hidden;
}

.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #888;
  gap: 0.5rem;
}

.welcome-logo {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 12px;
  overflow: hidden;
}

.welcome-logo img {
  width: 100%;
  height: 100%;
  display: block;
}

.welcome h2 {
  margin: 0;
  color: #4aaaff;
  font-weight: 600;
}

.welcome p {
  margin: 0;
  font-size: 13px;
  text-align: center;
  max-width: 320px;
}

.panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #252526;
  border-left: 1px solid #1f1f1f;
  transition: width 0.15s ease;
  overflow: hidden;
}

.panel.collapsed {
  width: 0;
  border-left: none;
}

.statusbar {
  height: 24px;
  background: #1e1e1e;
  border-top: 1px solid #1f1f1f;
  display: flex;
  align-items: center;
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}

.node-status {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.75rem;
  background: #3c3c3c;
  color: #ccc;
  cursor: pointer;
  user-select: none;
}

.node-status:hover {
  filter: brightness(1.1);
}

.node-status.connected {
  background: #0e639c;
  color: #fff;
}

.node-status.disconnected {
  background: #a31515;
  color: #fff;
}

.node-status .codicon {
  font-size: 14px;
}

.node-label {
  font-size: 12px;
}
</style>
