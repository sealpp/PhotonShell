<script setup lang="ts">
import { DropdownMenuItem, DropdownMenuSeparator } from 'reka-ui'
import { IconSettings } from '@tabler/icons-vue'
import { store } from '../stores/app'
import UiDropdownMenu from './UiDropdownMenu.vue'

function openSettings() {
  store.aboutModalOpen = false
  store.settingsModalOpen = true
}

function openAbout() {
  store.settingsModalOpen = false
  store.aboutModalOpen = true
}
</script>

<template>
  <UiDropdownMenu
    content-class="workbench-menu"
    side="top"
    align="end"
    :side-offset="4"
  >
    <template #trigger>
      <button
        type="button"
        class="workbench-menu-trigger"
        aria-label="设置和关于"
        title="设置和关于"
      >
        <IconSettings :size="20" stroke-width="1.8" aria-hidden="true" />
      </button>
    </template>

    <DropdownMenuItem class="workbench-menu-item" @select="openSettings">
      设置
    </DropdownMenuItem>
    <DropdownMenuSeparator class="workbench-menu-separator" />
    <DropdownMenuItem class="workbench-menu-item" @select="openAbout">
      关于
    </DropdownMenuItem>
  </UiDropdownMenu>
</template>
