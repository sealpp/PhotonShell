<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'

const metrics = computed(() => {
  const t = store.telemetry
  return [
    { name: 'CPU 使用率 (%)', value: t ? `${t.cpu.toFixed(1)}%` : '--', percent: t ? t.cpu : 0, label: '核心使用' },
    { name: '内存使用量 (%)', value: t ? `${t.mem.toFixed(1)}%` : '--', percent: t ? t.mem : 0, label: '总内存' },
    { name: '磁盘使用 (%)', value: t ? `${t.disk.toFixed(1)}%` : '--', percent: t ? t.disk : 0, label: '根分区' },
    { name: '进程数量', value: t ? String(t.procs) : '--', percent: 0, label: '运行中' },
  ]
})
</script>

<template>
  <div class="metrics-panel">
    <div class="metrics-header">
      <span class="title">系统监控</span>
    </div>
    <div class="metrics-content">
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
  </div>
</template>

<style scoped>
.metrics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #252526;
}

.metrics-header {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: #2d2d2d;
  border-bottom: 1px solid #1f1f1f;
  white-space: nowrap;
  flex-shrink: 0;
}

.metrics-header .title {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.metrics-content {
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
</style>
