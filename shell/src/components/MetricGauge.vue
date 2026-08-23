<script setup lang="ts">
import { computed } from 'vue'
import { GaugeChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import type { EChartsOption } from 'echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'

use([CanvasRenderer, GaugeChart, TooltipComponent])

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

const chartOption = computed<EChartsOption>(() => {
  const ratio = value.value / 100
  const axisColors: [number, string][] = available.value
    ? [[ratio, color.value], [1, TRACK_COLOR]]
    : [[1, TRACK_COLOR]]

  return {
    animation: available.value,
    animationDuration: 350,
    animationDurationUpdate: 500,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      show: available.value,
      trigger: 'item',
      backgroundColor: '#2d2d2d',
      borderColor: '#3c3c3c',
      borderWidth: 1,
      textStyle: {
        color: '#cccccc',
        fontSize: 11,
      },
      formatter: () => `${props.name}<br/><strong style="color:${color.value}">${formatValue(props.value)}</strong>`,
    },
    series: [
      {
        type: 'gauge',
        min: 0,
        max: 100,
        startAngle: 90,
        endAngle: -269.9,
        center: ['50%', '50%'],
        radius: '82%',
        pointer: {
          show: false,
        },
        progress: {
          show: available.value,
          roundCap: true,
          width: 14,
          itemStyle: {
            color: color.value,
          },
        },
        axisLine: {
          roundCap: true,
          lineStyle: {
            width: 14,
            color: axisColors,
          },
        },
        splitLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          show: false,
        },
        anchor: {
          show: false,
        },
        title: {
          show: false,
        },
        detail: {
          show: true,
          valueAnimation: available.value,
          offsetCenter: [0, 0],
          color: available.value ? '#ffffff' : '#666666',
          fontSize: 18,
          fontWeight: 600,
          formatter: () => formatValue(props.value),
        },
        data: [{ value: value.value }],
      },
    ],
  }
})
</script>

<template>
  <div class="metric-gauge" :data-status="props.status">
    <VChart
      class="metric-gauge-chart"
      :option="chartOption"
      :aria-label="`${props.name} ${formatValue(props.value)}`"
      autoresize
    />
  </div>
</template>

<style scoped>
.metric-gauge {
  width: 100%;
  height: 118px;
  min-width: 0;
}

.metric-gauge-chart {
  width: 100%;
  height: 100%;
}
</style>
