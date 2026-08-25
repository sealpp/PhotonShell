<script setup lang="ts">
import { computed } from 'vue'

type GaugeStatus = 'normal' | 'warning' | 'critical' | 'unavailable'

const props = withDefaults(
  defineProps<{
    name: string
    value: number | null
    unit?: string
    status?: GaugeStatus
  }>(),
  {
    unit: '%',
    status: 'unavailable',
  },
)

const STATUS_COLORS: Record<GaugeStatus, string> = {
  normal: '#4ec9b0',
  warning: '#dcdcaa',
  critical: '#f14c4c',
  unavailable: '#666666',
}

const TRACK_COLOR = '#3a3a3a'

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function formatValue(value: number | null): string {
  return value === null ? '--' : `${value.toFixed(1)}${props.unit}`
}

const available = computed(() => props.value !== null && props.status !== 'unavailable')
const value = computed(() => (props.value === null ? 0 : clamp(props.value)))
const color = computed(() => STATUS_COLORS[props.status])
const style = computed(() => ({
  '--gauge-value': `${value.value}%`,
  '--gauge-color': available.value ? color.value : TRACK_COLOR,
}))
</script>

<template>
  <div class="metric-gauge" :data-status="props.status">
    <div class="metric-gauge-chart" :style="style" :aria-label="`${props.name} ${formatValue(props.value)}`">
      <span class="metric-gauge-value">{{ formatValue(props.value) }}</span>
    </div>
  </div>
</template>

<style scoped>
.metric-gauge {
  width: 100%;
  height: 118px;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.metric-gauge-chart {
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: conic-gradient(
    var(--gauge-color) var(--gauge-value),
    #3a3a3a var(--gauge-value)
  );
  position: relative;
}

.metric-gauge-chart::after {
  content: '';
  position: absolute;
  inset: 14px;
  border-radius: 50%;
  background: var(--workbench-bg, #1e1e1e);
}

.metric-gauge-value {
  position: relative;
  z-index: 1;
  color: var(--workbench-text-strong, #fff);
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
