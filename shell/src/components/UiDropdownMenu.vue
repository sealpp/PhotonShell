<script setup lang="ts">
import { ref } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { usePortalTarget } from '../ui/portal'

const props = withDefaults(defineProps<{
  contentClass?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  collisionPadding?: number
}>(), {
  contentClass: '',
  side: 'bottom',
  align: 'center',
  sideOffset: 4,
  collisionPadding: 8,
})

const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const triggerEl = ref<Element | null>(null)
const portalTarget = usePortalTarget(triggerEl)

function setTrigger(event: Event) {
  triggerEl.value = event.currentTarget as Element
}
</script>

<template>
  <DropdownMenuRoot @update:open="(open) => emit('update:open', open)">
    <DropdownMenuTrigger as-child @pointerdown="setTrigger" @click="setTrigger">
      <slot name="trigger" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal :to="portalTarget">
      <DropdownMenuContent
        :class="props.contentClass"
        :side="props.side"
        :align="props.align"
        :side-offset="props.sideOffset"
        :collision-padding="props.collisionPadding"
        :avoid-collisions="true"
      >
        <slot />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
