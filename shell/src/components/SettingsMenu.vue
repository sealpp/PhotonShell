<script setup lang="ts">
import { store } from '../stores/app'

type MenuItem = {
  label: string
  shortcut?: string
  action: () => void
}

const groups: { title: string; items: MenuItem[] }[] = [
  {
    title: '视图',
    items: [
      { label: '命令面板...', shortcut: 'Ctrl+Shift+P', action: () => { /* placeholder */ } },
    ],
  },
  {
    title: '首选项',
    items: [
      { label: '通用设置', shortcut: 'Ctrl+,', action: () => { /* placeholder */ } },
      { label: '终端设置', action: () => { /* placeholder */ } },
      { label: '快捷键', shortcut: 'Ctrl+K Ctrl+S', action: () => { /* placeholder */ } },
      { label: '主题', action: () => { /* placeholder */ } },
    ],
  },
  {
    title: '帮助',
    items: [
      { label: '关于', action: () => { /* placeholder */ } },
      { label: '检查更新...', action: () => { /* placeholder */ } },
    ],
  },
]

function close() {
  store.settingsMenuOpen = false
}

function select(item: MenuItem) {
  item.action()
  close()
}
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="menu">
      <div class="menu-header">
        <span>设置</span>
      </div>
      <div class="menu-body">
        <div v-for="(group, gi) in groups" :key="gi" class="group">
          <div class="group-title">{{ group.title }}</div>
          <button
            v-for="(item, ii) in group.items"
            :key="ii"
            type="button"
            class="menu-item"
            @click="select(item)"
          >
            <span class="label">{{ item.label }}</span>
            <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
          </button>
        </div>
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
}

.menu {
  position: absolute;
  left: 48px;
  bottom: 24px;
  width: 240px;
  max-height: 70vh;
  overflow-y: auto;
  background: #252526;
  border: 1px solid #1f1f1f;
  border-radius: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
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

.group {
  margin-bottom: 0.5rem;
}

.group:last-child {
  margin-bottom: 0;
}

.group-title {
  padding: 0.25rem 0.75rem;
  color: #888;
  font-size: 11px;
  text-transform: uppercase;
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

.label {
  flex: 1;
}

.shortcut {
  color: #888;
  font-size: 11px;
}

.menu-item:hover .shortcut {
  color: #ccc;
}
</style>
