<script setup lang="ts">
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui'
import { usePortalTarget } from '../ui/portal'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  width?: string
  cancelLabel?: string
  actionLabel?: string
}>(), {
  width: '420px',
  cancelLabel: '取消',
  actionLabel: '确认',
})

const emit = defineEmits<{
  close: []
  confirm: []
}>()
const portalTarget = usePortalTarget()

function onOpenChange(open: boolean) {
  if (!open) emit('close')
}
</script>

<template>
  <AlertDialogRoot :open="props.open" @update:open="onOpenChange">
    <AlertDialogPortal :to="portalTarget">
      <AlertDialogOverlay class="workbench-dialog-overlay workbench-alert-overlay" />
      <AlertDialogContent
        class="workbench-dialog-content workbench-alert-content"
        :style="{ width: props.width }"
      >
        <div class="workbench-dialog-header">
          <AlertDialogTitle class="workbench-dialog-title">{{ props.title }}</AlertDialogTitle>
        </div>
        <AlertDialogDescription as="div" class="workbench-dialog-body">
          <slot />
        </AlertDialogDescription>
        <div class="workbench-dialog-actions">
          <AlertDialogCancel as-child>
            <button
              type="button"
              class="workbench-dialog-button workbench-dialog-button--default"
              @click="emit('close')"
            >
              {{ props.cancelLabel }}
            </button>
          </AlertDialogCancel>
          <AlertDialogAction as-child>
            <button
              type="button"
              class="workbench-dialog-button workbench-dialog-button--danger"
              @click="emit('confirm')"
            >
              {{ props.actionLabel }}
            </button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
