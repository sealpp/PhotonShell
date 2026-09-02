<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import type { CommandContext } from '../services/context'
import { menuRegistry } from '../services/commands'
import { usePortalTarget } from '../ui/portal'
import CommandDropdownMenuItems from './CommandDropdownMenuItems.vue'

const props = withDefaults(defineProps<{
  menuId: string
  context: CommandContext | (() => CommandContext)
  contentClass?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  collisionPadding?: number
  itemClass?: string
}>(), {
  contentClass: 'command-menu-content',
  side: 'bottom',
  align: 'center',
  sideOffset: 4,
  collisionPadding: 8,
  itemClass: 'command-menu-item',
})

const triggerEl = shallowRef<Element | null>(null)
const portalTarget = usePortalTarget(triggerEl)
const items = computed(() => {
  const context = typeof props.context === 'function' ? props.context() : props.context
  return menuRegistry.resolve(props.menuId, context)
})

function setTrigger(event: Event) {
  triggerEl.value = event.currentTarget as Element
}
</script>

<template>
  <DropdownMenuRoot>
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
        <slot name="before" />
        <CommandDropdownMenuItems
          :items="items"
          :portal-target="portalTarget"
          :item-class="props.itemClass"
        />
        <slot name="after" />
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
