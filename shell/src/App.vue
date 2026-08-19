<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { store } from './stores/app'
import { wsUrl, listHosts } from './services/ws'
import PairingView from './views/PairingView.vue'
import HostFormView from './views/HostFormView.vue'
import ShellView from './views/ShellView.vue'
import SettingsMenu from './components/SettingsMenu.vue'
import HostContextMenu from './components/HostContextMenu.vue'
import DeleteConfirm from './components/DeleteConfirm.vue'

const selectedHost = computed(() => store.hosts.find((h) => h.id === store.selectedHostId))

const connectionStatus = computed(() => {
  if (store.view === 'shell') {
    if (store.shellState === 'online') return '已连接'
    if (store.shellState === 'connecting') return '连接中'
    if (store.shellState === 'error') return '错误'
  }
  return store.token ? '已配对' : '未配对'
})

const nodeStatusText = computed(() => (store.token ? '已配对' : '未配对'))

const nodeUrl = computed(() => wsUrl())

const metrics = computed(() => {
  const t = store.telemetry
  return [
    { name: 'CPU 使用率 (%)', value: t ? `${t.cpu.toFixed(1)}%` : '--', percent: t ? t.cpu : 0, label: '核心使用' },
    { name: '内存使用量 (%)', value: t ? `${t.mem.toFixed(1)}%` : '--', percent: t ? t.mem : 0, label: '总内存' },
    { name: '磁盘使用 (%)', value: t ? `${t.disk.toFixed(1)}%` : '--', percent: t ? t.disk : 0, label: '根分区' },
    { name: '进程数量', value: t ? String(t.procs) : '--', percent: 0, label: '运行中' },
  ]
})

function isSelected(hostId: string): boolean {
  return store.selectedHostIds.has(hostId)
}

function isConnected(hostId: string): boolean {
  return store.view === 'shell' && store.selectedHostId === hostId
}

function hostStatus(hostId: string): string {
  if (store.selectedHostId === hostId && store.view === 'shell') {
    if (store.shellState === 'online') return '已连接'
    if (store.shellState === 'connecting') return '连接中'
    if (store.shellState === 'error') return '错误'
  }
  return '已保存'
}

function toggleSelection(hostId: string) {
  const next = new Set(store.selectedHostIds)
  if (next.has(hostId)) {
    next.delete(hostId)
  } else {
    next.add(hostId)
  }
  store.selectedHostIds = next
}

function rangeSelection(targetId: string) {
  const ids = store.hosts.map((h) => h.id)
  const anchor = store.selectionAnchor
  const anchorIndex = anchor ? ids.indexOf(anchor) : -1
  const targetIndex = ids.indexOf(targetId)
  if (anchorIndex === -1 || targetIndex === -1) {
    store.selectedHostIds = new Set([targetId])
    store.selectionAnchor = targetId
    return
  }
  const start = Math.min(anchorIndex, targetIndex)
  const end = Math.max(anchorIndex, targetIndex)
  const next = new Set<string>()
  for (let i = start; i <= end; i++) {
    next.add(ids[i])
  }
  store.selectedHostIds = next
}

function onItemClick(host: typeof store.hosts[0], event: MouseEvent) {
  if (event.ctrlKey || event.metaKey) {
    toggleSelection(host.id)
    store.selectionAnchor = host.id
  } else if (event.shiftKey) {
    rangeSelection(host.id)
  } else {
    store.selectedHostIds = new Set([host.id])
    store.selectionAnchor = host.id
  }
}

function onItemRightClick(host: typeof store.hosts[0], event: MouseEvent) {
  event.preventDefault()
  if (!store.selectedHostIds.has(host.id)) {
    store.selectedHostIds = new Set([host.id])
    store.selectionAnchor = host.id
  }
  store.contextMenuX = event.clientX
  store.contextMenuY = event.clientY
  store.contextMenuOpen = true
}

function openNewConnection() {
  store.editingHostId = ''
  store.connectionModalOpen = true
}

function openConnect(host: typeof store.hosts[0]) {
  store.editingHostId = host.id
  store.connectionModalOpen = true
}

function openPairing() {
  store.pairingModalOpen = true
}

function toggleConnections() {
  if (store.sidebarOpen && store.sidebarView === 'connections') {
    store.sidebarOpen = false
  } else {
    store.sidebarOpen = true
    store.sidebarView = 'connections'
  }
}

function switchToShell() {
  if (store.selectedHostId) {
    store.view = 'shell'
    store.sidebarOpen = false
  }
}

onMounted(() => {
  if (!store.token) {
    store.pairingModalOpen = true
  } else {
    listHosts()
  }
})
</script>

<template>
  <div class="app">
    <div class="main">
      <div class="activity">
        <div class="logo" title="PhotonShell">P</div>
        <div class="top-icons">
          <div
            class="icon"
            :class="{ active: store.sidebarOpen && store.sidebarView === 'connections' }"
            title="当前连接"
            @click="toggleConnections"
          >连</div>
          <div
            class="icon"
            :class="{ active: store.view === 'shell' }"
            title="终端"
            @click="switchToShell"
          >终</div>
        </div>
        <div class="bottom-icons">
          <div
            class="icon"
            title="设置"
            @click="store.settingsMenuOpen = true"
          >设</div>
        </div>
      </div>
      <aside v-if="store.sidebarOpen && store.sidebarView === 'connections'" class="sidebar">
        <div class="sidebar-header">
          <span>当前连接</span>
          <button type="button" class="new-btn" @click="openNewConnection">+ 新建连接</button>
        </div>
        <div class="conn-list" @contextmenu.prevent>
          <div
            v-for="h in store.hosts"
            :key="h.id"
            class="conn-item"
            :class="{ selected: isSelected(h.id), connected: isConnected(h.id) }"
            @click="onItemClick(h, $event)"
            @contextmenu="onItemRightClick(h, $event)"
          >
            <div class="name">{{ h.address }}</div>
            <div class="meta">
              {{ h.username }} · {{ h.port }} · <span class="status">{{ hostStatus(h.id) }}</span>
            </div>
            <button type="button" class="conn-btn" @click.stop="openConnect(h)">连接</button>
          </div>
          <p v-if="!store.hosts.length" class="empty">暂无保存的主机</p>
        </div>
        <div class="node-section">
          <div class="node-header">Node 连接</div>
          <div class="node-row"><span>地址</span><span>{{ nodeUrl }}</span></div>
          <div class="node-row">
            <span>状态</span>
            <span class="status">{{ nodeStatusText }}</span>
          </div>
          <button type="button" class="node-btn" @click="openPairing">
            {{ store.token ? '重新配对' : '配对' }}
          </button>
        </div>
      </aside>
      <div class="terminal-area">
        <ShellView v-if="store.view === 'shell'" />
        <div v-else class="welcome">
          <div class="welcome-logo">P</div>
          <h2>PhotonShell</h2>
          <p v-if="!store.token">请点击左下角「设置」>「配对」，或左侧活动栏的「连」后点 Node 区域的「配对」。</p>
          <p v-else-if="!store.hosts.length">暂无保存的主机，点击侧边栏「+ 新建连接」添加。</p>
          <p v-else>选择左侧主机（支持 Ctrl/Shift 多选），或右键批量操作。</p>
        </div>
      </div>
      <aside class="panel" :class="{ collapsed: !store.panelOpen }">
        <div class="panel-header">
          <span class="title">系统监控</span>
        </div>
        <div class="panel-content">
          <div v-if="store.view !== 'shell'" class="panel-empty">未连接</div>
          <div v-else class="dashboard">
            <div v-for="m in metrics" :key="m.name" class="metric">
              <div class="metric-header">
                <h3>{{ m.name }}</h3>
                <span class="metric-value">{{ m.value }}</span>
              </div>
              <div v-if="m.name !== '进程数量'" class="metric-bar">
                <div class="metric-bar-fill" :style="{ width: Math.min(100, Math.max(0, m.percent)) + '%' }"></div>
              </div>
              <div class="metric-footer">
                <span>{{ m.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
    <div class="statusbar">
      <div class="left">
        <span>{{ connectionStatus }}</span>
        <span v-if="selectedHost">{{ selectedHost.username }}</span>
        <span v-if="selectedHost">{{ selectedHost.address }}:{{ selectedHost.port }}</span>
      </div>
      <div class="right">
        <span>Node: {{ nodeUrl }}</span>
      </div>
    </div>
    <PairingView v-if="store.pairingModalOpen" />
    <HostFormView v-if="store.connectionModalOpen" />
    <SettingsMenu v-if="store.settingsMenuOpen" />
    <HostContextMenu v-if="store.contextMenuOpen" />
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
  padding: 0.5rem 0;
  border-right: 1px solid #252526;
  flex-shrink: 0;
  gap: 0.5rem;
}

.logo {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0e639c;
  color: #fff;
  border-radius: 4px;
  font-weight: 700;
  font-size: 16px;
  cursor: default;
  user-select: none;
  margin-bottom: 0.5rem;
}

.top-icons {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
}

.bottom-icons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  align-items: center;
  margin-top: auto;
}

.activity .icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}

.activity .icon:hover {
  color: #fff;
  background: #3c3c3c;
}

.activity .icon.active {
  color: #fff;
  background: #0e639c;
}

.sidebar {
  width: 220px;
  background: #252526;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #1f1f1f;
  flex-shrink: 0;
}

.sidebar-header {
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  background: #2d2d2d;
  border-bottom: 1px solid #1f1f1f;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.new-btn {
  background: transparent;
  border: none;
  color: #4aaaff;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}

.new-btn:hover {
  color: #fff;
}

.conn-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.conn-item {
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
  border: 1px solid #333;
  background: #1e1e1e;
  position: relative;
  cursor: pointer;
  user-select: none;
}

.conn-item:hover {
  background: #3c3c3c;
}

.conn-item.selected {
  border-color: #0e639c;
  background: #1a2633;
}

.conn-item.connected {
  border-left: 3px solid #4ec9b0;
}

.conn-item .name {
  color: #fff;
  font-size: 12px;
}

.conn-item .meta {
  color: #888;
  font-size: 11px;
  margin-top: 0.1rem;
}

.conn-item .status {
  color: #4ec9b0;
}

.conn-btn {
  position: absolute;
  right: 0.5rem;
  top: 0.5rem;
  background: #3c3c3c;
  border: none;
  color: #ccc;
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
  font-size: 11px;
  cursor: pointer;
}

.conn-btn:hover {
  background: #4a4a4a;
  color: #fff;
}

.empty {
  color: #888;
  font-size: 12px;
  text-align: center;
  padding: 1rem 0;
  margin: 0;
}

.node-section {
  border-top: 1px solid #1f1f1f;
  padding: 0.75rem;
  background: #1e1e1e;
}

.node-header {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.5rem;
}

.node-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  margin-bottom: 0.25rem;
}

.node-row .status {
  color: #4ec9b0;
}

.node-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.4rem;
  background: #3c3c3c;
  border: none;
  color: #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.node-btn:hover {
  background: #4a4a4a;
  color: #fff;
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
  background: #0e639c;
  color: #fff;
  border-radius: 12px;
  font-size: 32px;
  font-weight: 700;
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

.panel.collapsed .panel-header,
.panel.collapsed .panel-content {
  display: none;
}

.panel-header {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: #2d2d2d;
  border-bottom: 1px solid #1f1f1f;
  white-space: nowrap;
  flex-shrink: 0;
}

.panel-header .title {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.panel-empty {
  color: #888;
  font-size: 12px;
  text-align: center;
  padding: 1rem 0;
}

.dashboard {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.metric {
  background: #1e1e1e;
  padding: 0.6rem;
  border-radius: 4px;
  border: 1px solid #333;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.4rem;
}

.metric-header h3 {
  margin: 0;
  font-size: 12px;
  color: #999;
  font-weight: 500;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}

.metric-bar {
  height: 4px;
  background: #151515;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.4rem;
}

.metric-bar-fill {
  height: 100%;
  background: #4aaaff;
  border-radius: 2px;
}

.metric-footer {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #888;
}

.statusbar {
  height: 24px;
  background: #007acc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  color: #fff;
  font-size: 12px;
  flex-shrink: 0;
}

.statusbar .left,
.statusbar .right {
  display: flex;
  gap: 1rem;
}
</style>
