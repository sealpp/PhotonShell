<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { IconPencil, IconRefresh, IconSearch } from '@tabler/icons-vue'
import UiAlertDialog from './UiAlertDialog.vue'
import UiDialog from './UiDialog.vue'
import { store } from '../stores/app'
import { commandRegistry, keybindingRegistry, formatKeyStroke, keyStrokeFromKeyboardEvent } from '../services/commands'
import { resetAllKeybindings, resetKeybinding, setKeybindingEnabled, setKeybindingOverride } from '../services/keybindingPreferences'
import type { CommandLabel } from '../services/commands/types'
import type { KeyStroke, ResolvedKeybinding } from '../services/commands/types'

const search = ref('')
const editingCommandId = ref<string | null>(null)
const captured = ref<KeyStroke | null>(null)
const editOpen = ref(false)
const resetAllOpen = ref(false)
const recorderEl = ref<HTMLElement | null>(null)
const revision = ref(0)

const stopKeybindingWatch = keybindingRegistry.onDidChange(() => { revision.value += 1 })
const stopCommandWatch = commandRegistry.onDidRegister(() => { revision.value += 1 })
onBeforeUnmount(() => {
  stopKeybindingWatch()
  stopCommandWatch()
})

function close() {
  store.keyboardShortcutsModalOpen = false
}

function resolveLabel(label: CommandLabel): string {
  return typeof label === 'function' ? label({ area: 'global' }) : label
}

const rows = computed(() => {
  void revision.value
  const query = search.value.trim().toLocaleLowerCase()
  return [...commandRegistry.getCommands().values()]
    .map((command) => {
      const current = keybindingRegistry.getCurrentBinding(command.id)
      const defaultBinding = keybindingRegistry.getDefaultBinding(command.id)
      return {
        id: command.id,
        title: resolveLabel(command.title),
        description: command.description,
        category: command.category === 'terminal' ? '终端' : '工作台',
        current,
        defaultBinding,
        disabled: keybindingRegistry.isDisabled(command.id),
      }
    })
    .filter((row) => {
      if (!query) return true
      const haystack = [row.id, row.title, row.description, row.current?.label, row.defaultBinding?.label]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
      return query.split(/\s+/).every((term) => haystack.includes(term))
    })
    .sort((left, right) => left.id.localeCompare(right.id))
})

const editingCommand = computed(() => {
  void revision.value
  return editingCommandId.value ? commandRegistry.get(editingCommandId.value) : undefined
})

const editingCurrent = computed(() => {
  void revision.value
  return editingCommandId.value ? keybindingRegistry.getCurrentBinding(editingCommandId.value) : undefined
})

const conflicts = computed(() => {
  void revision.value
  if (!editingCommandId.value || !captured.value) return []
  return keybindingRegistry.findConflicts(captured.value, editingCommandId.value)
})

function startEditing(commandId: string) {
  editingCommandId.value = commandId
  const current = keybindingRegistry.getCurrentBinding(commandId)
  captured.value = current ? { key: current.stroke.key, modifiers: [...(current.stroke.modifiers ?? [])] } : null
  editOpen.value = true
  nextTick(() => recorderEl.value?.focus())
}

function cancelEditing() {
  editOpen.value = false
  editingCommandId.value = null
  captured.value = null
}

function onRecorderKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancelEditing()
    return
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    void saveEditing()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    captured.value = null
    return
  }
  const stroke = keyStrokeFromKeyboardEvent(event)
  if (!stroke) return
  event.preventDefault()
  captured.value = stroke
}

async function saveEditing() {
  const commandId = editingCommandId.value
  if (!commandId || conflicts.value.length) return
  await setKeybindingOverride(commandId, captured.value)
  cancelEditing()
}

async function restoreOne(commandId: string) {
  await resetKeybinding(commandId)
}

async function restoreEditing() {
  const commandId = editingCommandId.value
  if (!commandId) return
  await restoreOne(commandId)
  const restored = keybindingRegistry.getCurrentBinding(commandId)
  captured.value = restored ? { key: restored.stroke.key, modifiers: [...(restored.stroke.modifiers ?? [])] } : null
}

async function restoreAll() {
  await resetAllKeybindings()
  resetAllOpen.value = false
}

function bindingLabel(binding: ResolvedKeybinding | undefined): string {
  return binding ? formatKeyStroke(binding.stroke) : ''
}
</script>

<template>
  <UiDialog
    :open="store.keyboardShortcutsModalOpen"
    title="键盘快捷键"
    width="80vw"
    height="80vh"
    content-class="keybindings-dialog-content"
    @close="close"
  >
    <div class="keybindings-info" role="note">
      <p>1. 建议使用 Chrome 浏览器，以更流畅地使用快捷键功能。</p>
      <p>2. 当前显示的快捷键为 PhotonShell 内置功能快捷键，可能会被浏览器、系统应用或其他组件占用。</p>
      <p>3. 快捷键只在对应功能上下文中生效，例如终端命令需要终端处于可用状态。</p>
      <p>4. 如果某个快捷键不生效但不影响正常使用，可暂时忽略；也可以重新设置或关闭它。</p>
    </div>
    <div class="keybindings-toolbar">
      <label class="keybindings-search">
        <IconSearch :size="16" aria-hidden="true" />
        <input v-model="search" type="search" placeholder="按关键词搜索快捷键，如 AI命令助手、ctrl、关闭、toggle" aria-label="搜索快捷键" />
      </label>
      <button type="button" class="keybindings-reset-button" aria-label="全部恢复系统默认" title="全部恢复系统默认" @click="resetAllOpen = true">
        <IconRefresh :size="18" aria-hidden="true" />
        <span>重置</span>
      </button>
    </div>

    <div class="keybindings-table-wrap" role="table" aria-label="键盘快捷键列表">
      <div class="keybindings-row keybindings-row--header" role="row">
        <span role="columnheader">命令 ID</span>
        <span role="columnheader">当前快捷键</span>
        <span role="columnheader">默认快捷键</span>
        <span role="columnheader">描述</span>
        <span role="columnheader">类型</span>
        <span role="columnheader">是否启用</span>
      </div>
      <div v-for="row in rows" :key="row.id" class="keybindings-row" role="row">
        <code role="cell" class="keybindings-command-id">{{ row.id }}</code>
        <div role="cell" class="keybindings-current-cell">
          <button type="button" class="keybindings-binding-button" :aria-label="`编辑 ${row.id} 快捷键`" @click="startEditing(row.id)">
            <span v-if="row.current" class="keybindings-chip">{{ bindingLabel(row.current) }}</span>
            <span v-else class="keybindings-unbound">未绑定</span>
          </button>
          <button type="button" class="keybindings-edit-button" :aria-label="`编辑 ${row.id} 快捷键`" title="编辑快捷键" @click="startEditing(row.id)">
            <IconPencil :size="15" aria-hidden="true" />
          </button>
        </div>
        <span role="cell" class="keybindings-default-cell">
          <span v-if="row.defaultBinding" class="keybindings-chip">{{ bindingLabel(row.defaultBinding) }}</span>
          <span v-else class="keybindings-none">无</span>
        </span>
        <span role="cell">{{ row.description }}</span>
        <span role="cell">{{ row.category }}</span>
        <label role="cell" class="keybindings-enabled-cell">
          <input type="checkbox" :checked="!row.disabled" :disabled="!row.current" :aria-label="`${row.id} 是否启用`" @change="setKeybindingEnabled(row.id, ($event.target as HTMLInputElement).checked)" />
        </label>
      </div>
      <div v-if="!rows.length" class="keybindings-empty">没有匹配的快捷键</div>
    </div>
  </UiDialog>

  <UiDialog
    :open="editOpen"
    title="编辑快捷键组合"
    width="560px"
    content-class="keybinding-edit-dialog-content"
    @close="cancelEditing"
  >
    <div ref="recorderEl" class="keybinding-recorder" tabindex="0" role="textbox" aria-label="快捷键录制" @keydown.stop.prevent="onRecorderKeydown">
      <strong>按下所需的组合键，再按 Enter 键确认修改</strong>
      <span class="keybinding-recorded-value">{{ captured ? formatKeyStroke(captured) : '未绑定' }}</span>
    </div>
    <div v-if="conflicts.length" class="keybinding-conflict" role="alert">
      已有命令的快捷键绑定与此相同，请重新设置：
      <span v-for="conflict in conflicts" :key="conflict.commandId" class="keybinding-conflict-item">
        {{ conflict.commandId }} ({{ conflict.label }})
      </span>
    </div>
    <div class="keybinding-edit-current">
      当前：{{ editingCurrent ? editingCurrent.label : '未绑定' }}
      <span v-if="editingCommand">{{ resolveLabel(editingCommand.title) }}</span>
    </div>
    <template #actions>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="captured = null">清除快捷键</button>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="restoreEditing">恢复系统默认</button>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="cancelEditing">取消</button>
      <button type="button" class="workbench-dialog-button workbench-dialog-button--primary" :disabled="conflicts.length > 0" @click="saveEditing">确定</button>
    </template>
  </UiDialog>

  <UiAlertDialog
    :open="resetAllOpen"
    title="全部恢复系统默认？"
    action-label="恢复默认"
    @close="resetAllOpen = false"
    @confirm="restoreAll"
  >
    <p class="keybinding-reset-warning">所有自定义快捷键和启用状态都会恢复为系统默认。</p>
  </UiAlertDialog>
</template>
