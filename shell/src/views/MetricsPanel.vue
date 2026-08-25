<script setup lang="ts">
import { computed } from 'vue'
import { store } from '../stores/app'
import MetricGauge from '../components/MetricGauge.vue'

type MetricStatus = 'normal' | 'warning' | 'critical' | 'unavailable'
type MetricKind = 'gauge' | 'stat'

type MetricCard = {
  id: string
  name: string
  value: number | null
  valueText: string
  label: string
  kind: MetricKind
  status: MetricStatus
}

function numericMetric(id: string): number | null {
  const metric = store.telemetry?.metrics[id]
  if (metric?.quality !== 'valid' || typeof metric.value !== 'number' || !Number.isFinite(metric.value)) {
    return null
  }
  return metric.value
}

function percentMetric(id: string): number | null {
  const value = numericMetric(id)
  return value !== null && value >= 0 && value <= 100 ? value : null
}

function metricText(value: number | null, digits: number, suffix = ''): string {
  return value === null ? '--' : `${value.toFixed(digits)}${suffix}`
}

function percentStatus(value: number | null): MetricStatus {
  if (value === null) return 'unavailable'
  if (value >= 90) return 'critical'
  if (value >= 70) return 'warning'
  return 'normal'
}

const metrics = computed<MetricCard[]>(() => {
  const cpu = percentMetric('cpu.usage')
  const memory = percentMetric('memory.usage')
  const disk = percentMetric('disk.usage')
  const processes = numericMetric('process.count')
  const processCount = processes !== null && processes >= 0 ? processes : null

  return [
    {
      id: 'cpu.usage',
      name: 'CPU 使用率',
      value: cpu,
      valueText: metricText(cpu, 1, '%'),
      label: '核心使用',
      kind: 'gauge',
      status: percentStatus(cpu),
    },
    {
      id: 'memory.usage',
      name: '内存使用率',
      value: memory,
      valueText: metricText(memory, 1, '%'),
      label: '总内存',
      kind: 'gauge',
      status: percentStatus(memory),
    },
    {
      id: 'disk.usage',
      name: '磁盘使用率',
      value: disk,
      valueText: metricText(disk, 1, '%'),
      label: '根分区',
      kind: 'gauge',
      status: percentStatus(disk),
    },
    {
      id: 'process.count',
      name: '进程数量',
      value: processCount,
      valueText: metricText(processCount, 0),
      label: '状态',
      kind: 'stat',
      status: processCount === null ? 'unavailable' : 'normal',
    },
  ]
})

function statusKey(metric: MetricCard): string {
  return store.telemetry ? metric.status : 'waiting'
}

function statusText(metric: MetricCard): string {
  if (!store.telemetry) return '等待数据'
  if (metric.status === 'unavailable') return '数据不可用'
  if (metric.kind === 'stat') return '运行中'
  if (metric.status === 'critical') return '高负载'
  if (metric.status === 'warning') return '注意'
  return '正常'
}
</script>

<template>
  <div class="metrics-panel">
    <div class="metrics-header">
      <span class="title">系统监控</span>
    </div>
    <div class="metrics-content">
      <div v-if="store.view !== 'shell'" class="panel-empty">未连接</div>
      <div v-else class="dashboard">
        <article
          v-for="metric in metrics"
          :key="metric.id"
          class="metric"
          :data-metric-id="metric.id"
          :data-metric-kind="metric.kind"
          :data-metric-value="metric.valueText"
          :data-status="statusKey(metric)"
        >
          <div class="metric-header">
            <h3>{{ metric.name }}</h3>
          </div>
          <MetricGauge
            v-if="metric.kind === 'gauge'"
            :name="metric.name"
            :value="metric.value"
            :status="metric.status"
          />
          <div v-else class="metric-stat" aria-label="进程数量">
            <span class="metric-stat-value">{{ metric.valueText }}</span>
          </div>
          <div class="metric-footer">
            <span>{{ metric.label }}</span>
            <span class="metric-status">{{ statusText(metric) }}</span>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metrics-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--workbench-surface, #252526);
}

.metrics-header {
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: var(--workbench-surface-raised, #2d2d2d);
  border-bottom: 1px solid var(--workbench-border-muted, #1f1f1f);
  white-space: nowrap;
  flex-shrink: 0;
}

.metrics-header .title {
  font-size: 12px;
  font-weight: 600;
  color: var(--workbench-text-strong, #fff);
}

.metrics-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}

.panel-empty {
  color: var(--workbench-text-muted, #888);
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
  background: var(--workbench-bg, #1e1e1e);
  padding: 0.6rem;
  border-radius: 4px;
  border: 1px solid var(--workbench-border, #333);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.metric-header h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--workbench-text-muted, #999);
  font-size: 12px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-stat {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 118px;
  background: #151515;
  border-radius: 4px;
}

.metric-stat-value {
  color: var(--workbench-text-strong, #fff);
  font-size: 32px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  line-height: 1;
}

.metric-footer {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--workbench-text-muted, #888);
  font-size: 11px;
}

.metric-status {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric[data-status='normal'] .metric-status {
  color: #4ec9b0;
}

.metric[data-status='warning'] .metric-status {
  color: #dcdcaa;
}

.metric[data-status='critical'] .metric-status {
  color: #f14c4c;
}

.metric[data-status='waiting'] .metric-status,
.metric[data-status='unavailable'] .metric-status {
  color: var(--workbench-text-disabled, #666);
}
</style>
