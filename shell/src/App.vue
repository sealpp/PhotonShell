<script setup lang="ts">
import { onMounted } from 'vue'
import { store } from './stores/app'
import { connect } from './services/ws'
import PairingView from './views/PairingView.vue'
import HostFormView from './views/HostFormView.vue'
import MainDock from './views/MainDock.vue'
import ActionsToolbar from './views/ActionsToolbar.vue'
import PrimarySidebar from './views/PrimarySidebar.vue'
import SecondarySidebar from './views/SecondarySidebar.vue'
import DeleteConfirm from './components/DeleteConfirm.vue'
import TerminalSessionInfo from './components/TerminalSessionInfo.vue'
import ManualPasteDialog from './components/ManualPasteDialog.vue'
import { IconList } from '@tabler/icons-vue'
import NodeStatusMenu from './components/NodeStatusMenu.vue'

function toggleConnections() {
  if (store.sidebarOpen && store.sidebarView === 'connections') {
    store.sidebarOpen = false
  } else {
    store.sidebarOpen = true
    store.sidebarView = 'connections'
  }
}

onMounted(() => {
  if (!store.token) {
    store.pairingModalOpen = true
  } else {
    connect(store.token)
  }
})


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
      </div>
      <aside class="sidebar primary-sidebar" :class="{ collapsed: !store.sidebarOpen || store.sidebarView !== 'connections' }">
        <PrimarySidebar />
      </aside>
      <div class="terminal-area">
        <div v-if="store.view === 'shell'" class="shell-workspace">
          <div class="main-dock-container">
            <MainDock />
            <ActionsToolbar />
          </div>
        </div>
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
      <NodeStatusMenu />
    </div>
    <PairingView v-if="store.pairingModalOpen" />
    <HostFormView v-if="store.connectionModalOpen" />
    <TerminalSessionInfo v-if="store.terminalSessionInfo?.open" />
    <ManualPasteDialog v-if="store.manualPaste?.open" />
    <DeleteConfirm v-if="store.deleteConfirmOpen" />
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

.shell-workspace {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-dock-container {
  --actions-toolbar-width: 44px;
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
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

</style>
