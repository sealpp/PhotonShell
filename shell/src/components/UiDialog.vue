<script setup lang="ts">
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { usePortalTarget } from '../ui/portal'
import { IconX } from '@tabler/icons-vue'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  showClose?: boolean
}>(), {
  width: '420px',
  showClose: true,
})

const emit = defineEmits<{ close: [] }>()
const portalTarget = usePortalTarget()

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <DialogRoot :open="props.open" @update:open="onOpenChange">
    <DialogPortal :to="portalTarget">
      <DialogOverlay class="workbench-dialog-overlay" />
      <DialogContent class="workbench-dialog-content" :style="{ width: props.width }">
        <div class="workbench-dialog-header">
          <DialogTitle class="workbench-dialog-title">{{ props.title }}</DialogTitle>
          <DialogClose v-if="props.showClose" as-child>
            <button type="button" class="workbench-dialog-close" aria-label="关闭">
              <IconX :size="16" />
            </button>
          </DialogClose>
        </div>
        <div class="workbench-dialog-body">
          <slot />
        </div>
        <div v-if="$slots.actions" class="workbench-dialog-actions">
          <slot name="actions" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
