<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { DockviewVue, themeAbyss } from 'dockview-vue'
import type { DockviewApi, DockviewPanelApi, DockviewReadyEvent } from 'dockview-vue'
import { IconFile, IconFolder, IconX } from '@tabler/icons-vue'
import { store, setBottomPanelActiveTab, type Tab, type BottomPanelCategory } from '../stores/app'
import { commandService } from '../services/commands'
import { canDropWorkspaceInstance, workspaceSplitMarker } from '../services/workspace-docking'
import FilePanel from './FilePanel.vue'
import EditorPanel from './EditorPanel.vue'

const props = defineProps<{ category: BottomPanelCategory }>()
interface WorkspaceGroup {
  id: string
  panels: readonly unknown[]
  activePanel?: { id: string }
  api: { boundingBox?: { left: number; top: number; width: number; height: number } }
  model: { header: { hidden: boolean } }
}
type PanelMoveGroup = NonNullable<Parameters<DockviewPanelApi['moveTo']>[0]['group']>

const api = ref<DockviewApi | null>(null)
const layoutVersion = ref(0)
const draggingId = ref('')
let activeWorkspaceDrag: { tabId: string; category: BottomPanelCategory } | undefined
let subscriptions: Array<{ dispose: () => void }> = []

const components = {
  file: FilePanel,
  editor: EditorPanel,
}

const tabs = computed(() => store.tabs.filter((tab): tab is Tab & { kind: 'file' | 'editor' } => tab.kind === props.category.slice(0, -1)))

const visiblePanels = computed(() => {
  // Dockview owns layout state outside Vue. A version tick keeps the instance
  // list in sync after moves, splits, and tab activation.
  layoutVersion.value
  const currentApi = api.value
  if (!currentApi) return new Map<string, { marker: string; group: WorkspaceGroup }>()
  const groups = currentApi.groups
  const activeGroups = groups.filter((group) => !!group.activePanel)
  const result = new Map<string, { marker: string; group: WorkspaceGroup }>()
  activeGroups.forEach((group, index) => {
    const panel = group.activePanel
    if (panel) result.set(panel.id, { marker: workspaceSplitMarker(index, activeGroups.length), group })
  })
  return result
})

function tick(): void {
  layoutVersion.value += 1
}

function groupHeadersHidden(): void {
  for (const group of api.value?.groups ?? []) {
    group.model.header.hidden = true
  }
}

function panelTitle(tab: Tab): string {
  return tab.label || (tab.kind === 'file' ? '文件列表' : '文件')
}

function addPanel(tab: Tab): void {
  const currentApi = api.value
  if (!currentApi || (props.category === 'files' && tab.kind !== 'file') || (props.category === 'editors' && tab.kind !== 'editor')) return
  if (currentApi.getPanel(tab.id)) return

  const group = currentApi.activeGroup ?? currentApi.groups[0]
  const index = group?.panels.length ?? 0
  const options = {
    id: tab.id,
    title: panelTitle(tab),
    component: tab.kind,
    params: { tabId: tab.id },
    renderer: 'always' as const,
    ...(group ? { position: { referenceGroup: group.id, direction: 'within' as const, index } } : {}),
  }
  currentApi.addPanel(options)
  groupHeadersHidden()
  if ((props.category === 'files' ? store.activeFileTabId : store.activeEditorTabId) === tab.id) {
    nextTick(() => currentApi.getPanel(tab.id)?.api.setActive())
  }
  tick()
}

function removePanel(tabId: string): void {
  const currentApi = api.value
  const panel = currentApi?.getPanel(tabId)
  if (panel && currentApi) currentApi.removePanel(panel)
  tick()
}

function onReady(event: DockviewReadyEvent): void {
  api.value = event.api
  const currentApi = event.api
  subscriptions.push(
    currentApi.onDidActivePanelChange(({ panel }) => {
      if (!panel) return
      setBottomPanelActiveTab(panel.id, props.category)
      tick()
    }),
    currentApi.onDidLayoutChange(() => {
      groupHeadersHidden()
      tick()
    }),
    currentApi.onWillDrop((drop) => {
      const data = drop.getData()
      if (data && data.viewId !== currentApi.id) drop.preventDefault()
      const workspaceDrag = readWorkspaceDrag(drop.nativeEvent)
      if (workspaceDrag && !canDropWorkspaceInstance(workspaceDrag.category, props.category)) drop.preventDefault()
    }),
    currentApi.onUnhandledDragOver((drop) => {
      if (activeWorkspaceDrag && canDropWorkspaceInstance(activeWorkspaceDrag.category, props.category)) drop.accept()
    }),
    currentApi.onDidDrop((drop) => {
      const workspaceDrag = activeWorkspaceDrag
      if (!workspaceDrag || !canDropWorkspaceInstance(workspaceDrag.category, props.category) || !drop.group) return
      const panel = currentApi.getPanel(workspaceDrag.tabId)
      if (!panel) return
      panel.api.moveTo({
        group: drop.group as unknown as PanelMoveGroup,
        position: drop.position,
        index: drop.position === 'center' ? drop.group.panels.length : undefined,
      })
      const movedTab = store.tabs.find((tab) => tab.id === workspaceDrag.tabId)
      if (movedTab) selectInstance(movedTab)
    }),
  )
  for (const tab of tabs.value) addPanel(tab)
  groupHeadersHidden()
}

function instanceMarker(tabId: string): string {
  return visiblePanels.value.get(tabId)?.marker ?? ''
}

function selectInstance(tab: Tab): void {
  setBottomPanelActiveTab(tab.id, props.category)
  api.value?.getPanel(tab.id)?.api.setActive()
}

function closeInstance(tabId: string): void {
  void commandService.execute('tab.close', { area: 'tab', tabId })
}

function onDragStart(event: DragEvent, tab: Tab): void {
  const currentApi = api.value
  const panel = currentApi?.getPanel(tab.id)
  if (!event.dataTransfer || !currentApi || !panel) return
  draggingId.value = tab.id
  activeWorkspaceDrag = { tabId: tab.id, category: props.category }
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-photonshell-workspace', JSON.stringify({ tabId: tab.id, category: props.category }))
}

function onDragEnd(): void {
  draggingId.value = ''
  activeWorkspaceDrag = undefined
}

function readWorkspaceDrag(event: DragEvent | PointerEvent): { tabId: string; category: BottomPanelCategory } | undefined {
  if (!(event instanceof DragEvent)) return undefined
  const raw = event.dataTransfer?.getData('application/x-photonshell-workspace')
  if (!raw) return undefined
  try {
    const data = JSON.parse(raw) as { tabId?: string; category?: BottomPanelCategory }
    if (!data.tabId || (data.category !== 'files' && data.category !== 'editors')) return undefined
    return { tabId: data.tabId, category: data.category }
  } catch {
    return undefined
  }
}

watch(
  () => store.tabs.map((tab) => `${tab.id}:${tab.kind}`).join(','),
  (_, previous) => {
    if (!api.value) return
    const oldIds = (previous ?? '').split(',').filter(Boolean).map((value) => value.split(':')[0])
    const currentTabs = tabs.value
    const currentIds = currentTabs.map((tab) => tab.id)
    for (const id of oldIds.filter((id) => !currentIds.includes(id))) removePanel(id)
    for (const tab of currentTabs) addPanel(tab)
    groupHeadersHidden()
  },
  { flush: 'post' },
)

watch(
  () => props.category === 'files' ? store.activeFileTabId : store.activeEditorTabId,
  (tabId) => {
    if (!tabId || !api.value) return
    api.value.getPanel(tabId)?.api.setActive()
  },
)

onBeforeUnmount(() => {
  subscriptions.forEach((subscription) => subscription.dispose())
  subscriptions = []
  api.value = null
})
</script>

<template>
  <div class="workspace-dock-layout">
    <div class="workspace-dock">
      <DockviewVue
        class="workspace-dockview"
        :theme="themeAbyss"
        :components="(components as any)"
        @ready="onReady"
      />
      <div v-if="!tabs.length" class="workspace-dock-empty">
        <IconFolder v-if="props.category === 'files'" :size="22" aria-hidden="true" />
        <IconFile v-else :size="22" aria-hidden="true" />
        <span>{{ props.category === 'files' ? '暂无文件列表' : '暂无打开的文件' }}</span>
      </div>
    </div>
    <aside class="workspace-instance-list" aria-label="面板实例">
      <div v-if="!tabs.length" class="workspace-instance-empty">暂无实例</div>
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="workspace-instance"
        :class="{ active: (props.category === 'files' ? store.activeFileTabId : store.activeEditorTabId) === tab.id, dragging: draggingId === tab.id }"
        draggable="true"
        @click="selectInstance(tab)"
        @dragstart="onDragStart($event, tab)"
        @dragend="onDragEnd"
      >
        <span class="workspace-instance-marker" aria-hidden="true">{{ instanceMarker(tab.id) }}</span>
        <IconFolder v-if="tab.kind === 'file'" :size="14" aria-hidden="true" />
        <IconFile v-else :size="14" aria-hidden="true" />
        <span class="workspace-instance-label" :title="panelTitle(tab)">{{ panelTitle(tab) }}</span>
        <span class="workspace-instance-state" :class="tab.state" aria-hidden="true"></span>
        <span class="workspace-instance-close" role="button" title="关闭" @click.stop="closeInstance(tab.id)"><IconX :size="13" /></span>
      </button>
    </aside>
  </div>
</template>

<style>
.workspace-dock-layout{display:flex;min-width:0;min-height:0;width:100%;height:100%;background:#1e1e1e}.workspace-dock{position:relative;min-width:0;min-height:0;flex:1;overflow:hidden}.workspace-dockview{width:100%;height:100%}.workspace-instance-list{box-sizing:border-box;flex:0 0 var(--workspace-instance-list-width,220px);width:var(--workspace-instance-list-width,220px);min-width:160px;max-width:420px;overflow:auto;padding:6px 4px;background:#252526;border-left:1px solid #333}.workspace-instance-empty{display:flex;align-items:center;justify-content:center;height:100%;color:#777;font-size:12px}.workspace-instance{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:0 6px;border:0;border-left:2px solid transparent;background:transparent;color:#bbb;text-align:left;cursor:pointer;font:inherit;font-size:12px}.workspace-instance:hover{background:#2d2d2d;color:#fff}.workspace-instance.active{border-left-color:#3794ff;background:#37373d;color:#fff}.workspace-instance.dragging{opacity:.5}.workspace-instance-marker{width:12px;color:#888;font-family:ui-monospace,monospace;text-align:center}.workspace-instance-label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspace-instance-state{width:6px;height:6px;border-radius:50%;background:#777}.workspace-instance-state.online{background:#4ec9b0}.workspace-instance-state.connecting{background:#dcdcaa}.workspace-instance-state.error{background:#f14c4c}.workspace-instance-close{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;color:#888}.workspace-instance-close:hover{color:#fff;background:#4b4b4b}
.workspace-dockview :deep(.dv-tabs-and-actions-container){display:none}.workspace-dockview :deep(.dv-groupview){border:0}.workspace-dockview :deep(.dv-content-container){background:#1e1e1e}
.workspace-dock-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;color:#777;pointer-events:none}
</style>
