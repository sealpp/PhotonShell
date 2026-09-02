<script setup lang="ts">
import { IconSettings } from '@tabler/icons-vue'
import CommandDropdownMenu from './CommandDropdownMenu.vue'
import { MenuId } from '../services/actions/menuIds'
</script>

<template>
  <CommandDropdownMenu
    :menu-id="MenuId.Workbench"
    :context="{ area: 'global' }"
    content-class="workbench-menu"
    side="top"
    align="end"
    :side-offset="4"
    item-class="workbench-menu-item"
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

  </CommandDropdownMenu>
</template>
