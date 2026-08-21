<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import { wsUrl, disconnectNode } from '../services/ws'
import { IconPlug, IconLinkOff, IconCopy } from '@tabler/icons-vue'

const pairLabel = computed(() => (store.token ? '重新配对' : '配对'))

function close() {
  store.nodeMenuOpen = false
}

function openPairing() {
  store.pairingModalOpen = true
  close()
}

function doDisconnect() {
  disconnectNode()
  close()
}

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(wsUrl())
  } catch {
    // ignore
  }
  close()
}
</script>

<template>
  <div class="overlay" @click.self="close" @contextmenu.prevent>
    <div class="menu">
      <div class="menu-header">
        <span>Node 操作</span>
      </div>
      <div class="menu-body">
        <button type="button" class="menu-item" @click="openPairing">
          <span class="left">
            <IconPlug :size="16" />
            <span class="label">{{ pairLabel }}</span>
          </span>
        </button>
        <button
          v-if="store.token"
          type="button"
          class="menu-item"
          @click="doDisconnect"
        >
          <span class="left">
            <IconLinkOff :size="16" />
            <span class="label">断开当前 Node 连接</span>
          </span>
        </button>
        <button type="button" class="menu-item" @click="copyAddress">
          <span class="left">
            <IconCopy :size="16" />
            <span class="label">复制 Node 地址</span>
          </span>
        </button>
      </div>
      <div class="menu-footer">
        <span class="node-address">{{ wsUrl() }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 100;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu {
  width: 320px;
  max-width: 90vw;
  background: #252526;
  border: 1px solid #1f1f1f;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.menu-header {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: #2d2d2d;
  border-bottom: 1px solid #1f1f1f;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.menu-body {
  padding: 0.5rem 0;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
}

.menu-item:hover {
  background: #0e639c;
  color: #fff;
}

.left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.label {
  flex: 1;
}

.menu-footer {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #1f1f1f;
  color: #888;
  font-size: 11px;
  word-break: break-all;
}
</style>
