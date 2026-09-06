<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { IconArrowBackUp, IconArrowForwardUp, IconArrowUp, IconEye, IconRefresh, IconSearch, IconLayoutList, IconLayoutGrid, IconX } from '@tabler/icons-vue'
import CommandContextMenu from '../components/CommandContextMenu.vue'
import { FILE_MENU_ID } from '../services/actions/menuIds'
import type { CommandContext } from '../services/context'
import { commandService } from '../services/commands'
import { store, type FileEntry, type FileTab } from '../stores/app'
import { copyEntry, moveEntry, targetNameForEntry } from '../services/sftp/operations'
import { getSftpBackend, goBackFileTab, goForwardFileTab, navigateFileTab, navigateParentFileTab, refreshFileTab } from '../services/sftp/file-tabs'

const props = defineProps<{ params: { params: { tabId: string; [key: string]: unknown }; [key: string]: unknown } }>()
const tabId = computed(() => String(props.params?.params?.tabId ?? ''))
const tab = computed(() => store.tabs.find((candidate) => candidate.id === tabId.value && candidate.kind === 'file') as FileTab | undefined)
const pathInput = ref('')
const dropTarget = ref<string | null>(null)
const listEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(600)
const ROW_HEIGHT = 32
let activateTimer: number | undefined

const sortedEntries = computed(() => tab.value?.file.entries ?? [])
const renderStart = computed(() => Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - 8))
const renderEnd = computed(() => Math.min(sortedEntries.value.length, renderStart.value + Math.ceil(viewportHeight.value / ROW_HEIGHT) + 16))
const renderedEntries = computed(() => sortedEntries.value.slice(renderStart.value, renderEnd.value))
const topSpacer = computed(() => renderStart.value * ROW_HEIGHT)
const bottomSpacer = computed(() => Math.max(0, (sortedEntries.value.length - renderEnd.value) * ROW_HEIGHT))

function fileContext(): CommandContext {
  const current = tab.value
  const selected = current?.file.selectedPaths ?? []
  return {
    area: 'file',
    tabId: tabId.value,
    selectedPaths: selected,
    selectedCount: selected.length,
    filePath: selected[0],
    fileKind: current?.file.entries.find((entry) => entry.path === selected[0])?.kind,
    canPasteFiles: !!store.sftpClipboard?.entries.length,
  }
}

function syncPath(): void { pathInput.value = tab.value?.file.cwd ?? '' }
function onListScroll(event: Event): void {
  const element = event.currentTarget as HTMLElement
  scrollTop.value = element.scrollTop
  viewportHeight.value = element.clientHeight
}

function select(entry: FileEntry, event: MouseEvent): void {
  const current = tab.value
  if (!current) return
  const paths = sortedEntries.value.map((candidate) => candidate.path)
  const index = paths.indexOf(entry.path)
  const selected = new Set(current.file.selectedPaths)
  if (event.shiftKey && selected.size) {
    const anchor = paths.indexOf(Array.from(selected)[0])
    const start = Math.min(anchor < 0 ? index : anchor, index)
    const end = Math.max(anchor < 0 ? index : anchor, index)
    current.file.selectedPaths = paths.slice(start, end + 1)
  } else if (event.ctrlKey || event.metaKey) {
    if (selected.has(entry.path)) selected.delete(entry.path)
    else selected.add(entry.path)
    current.file.selectedPaths = Array.from(selected)
  } else {
    current.file.selectedPaths = [entry.path]
  }
}

async function openEntry(entry: FileEntry): Promise<void> {
  select(entry, new MouseEvent('click'))
  await commandService.execute('file.open', fileContext())
}

async function navigateFromInput(): Promise<void> {
  await navigateFileTab(tabId.value, pathInput.value)
  syncPath()
}

function setSort(event: Event): void {
  const current = tab.value
  if (!current) return
  const value = (event.target as HTMLSelectElement).value
  const [sortKey, sortDirection] = value.split(':') as [FileTab['file']['sortKey'], FileTab['file']['sortDirection']]
  current.file.sortKey = sortKey
  current.file.sortDirection = sortDirection
  void refreshFileTab(tabId.value)
}

function toggleHidden(): void {
  if (!tab.value) return
  tab.value.file.showHidden = !tab.value.file.showHidden
  void refreshFileTab(tabId.value)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.target instanceof HTMLInputElement) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v'].includes(key)) {
    event.preventDefault()
    void commandService.execute(`file.${key === 'c' ? 'copy' : key === 'x' ? 'cut' : 'paste'}`, fileContext())
  } else if (key === 'f2' || key === 'delete' || key === 'backspace' || key === 'f5') {
    event.preventDefault()
    void commandService.execute(key === 'f2' ? 'file.rename' : key === 'f5' ? 'file.refresh' : 'file.delete', fileContext())
  } else if (event.altKey && event.key === 'ArrowUp') {
    event.preventDefault()
    void navigateParentFileTab(tabId.value)
  }
}

function onDragStart(event: DragEvent, entry: FileEntry): void {
  if (!event.dataTransfer) return
  const current = tab.value
  if (!current) return
  if (!current.file.selectedPaths.includes(entry.path)) current.file.selectedPaths = [entry.path]
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData('application/x-photonshell-sftp', JSON.stringify({ sourceTabId: tabId.value, paths: current.file.selectedPaths }))
}

function onDragEnter(): void {
  if (activateTimer !== undefined) window.clearTimeout(activateTimer)
  activateTimer = window.setTimeout(() => { store.activeTabId = tabId.value }, 500)
}

function onDragLeave(): void {
  if (activateTimer !== undefined) window.clearTimeout(activateTimer)
  activateTimer = undefined
}

async function onDrop(event: DragEvent, entry?: FileEntry): Promise<void> {
  onDragLeave()
  event.preventDefault()
  dropTarget.value = null
  const raw = event.dataTransfer?.getData('application/x-photonshell-sftp')
  if (!raw) return
  let payload: { sourceTabId: string; paths: string[] }
  try { payload = JSON.parse(raw) as { sourceTabId: string; paths: string[] } } catch { return }
  const targetBackend = getSftpBackend(tabId.value)
  const sourceBackend = getSftpBackend(payload.sourceTabId)
  const current = tab.value
  if (!targetBackend || !sourceBackend || !current) return
  const targetDirectory = entry?.kind === 'directory' ? entry.path : current.file.cwd
  for (const sourcePath of payload.paths) {
    const targetPath = targetNameForEntry(sourcePath, targetDirectory)
    if (payload.sourceTabId === tabId.value) await moveEntry(targetBackend, sourcePath, targetPath)
    else await copyEntry(sourceBackend, targetBackend, sourcePath, targetPath)
  }
  await refreshFileTab(tabId.value)
}

function isSelected(entry: FileEntry): boolean { return !!tab.value?.file.selectedPaths.includes(entry.path) }

onMounted(syncPath)
onBeforeUnmount(onDragLeave)
</script>

<template>
  <CommandContextMenu v-if="tab" :menu-id="FILE_MENU_ID" :context="fileContext">
    <div class="file-panel" tabindex="0" @keydown="onKeydown" @dragover.prevent @dragenter="onDragEnter" @dragleave="onDragLeave" @drop="onDrop">
      <header class="file-toolbar">
        <button type="button" title="后退" :disabled="tab.file.historyIndex <= 0" @click="goBackFileTab(tabId)"><IconArrowBackUp :size="16" /></button>
        <button type="button" title="前进" :disabled="tab.file.historyIndex >= tab.file.history.length - 1" @click="goForwardFileTab(tabId)"><IconArrowForwardUp :size="16" /></button>
        <button type="button" title="上级目录" @click="navigateParentFileTab(tabId)"><IconArrowUp :size="16" /></button>
        <button type="button" title="刷新" @click="refreshFileTab(tabId)"><IconRefresh :size="16" /></button>
        <input v-model="pathInput" aria-label="远端路径" @keydown.enter="navigateFromInput" @blur="syncPath">
        <button type="button" title="显示隐藏文件" :class="{ active: tab.file.showHidden }" @click="toggleHidden"><IconEye :size="16" /></button>
        <select :value="`${tab.file.sortKey}:${tab.file.sortDirection}`" aria-label="排序" @change="setSort">
          <option value="name:asc">文件名 A-Z</option><option value="name:desc">文件名 Z-A</option>
          <option value="modified:desc">修改时间 新-旧</option><option value="modified:asc">修改时间 旧-新</option>
          <option value="size:desc">大小 大-小</option><option value="size:asc">大小 小-大</option>
        </select>
        <button type="button" title="列表视图" :class="{ active: tab.file.view === 'list' }" @click="tab.file.view = 'list'"><IconLayoutList :size="16" /></button>
        <button type="button" title="平铺视图" :class="{ active: tab.file.view === 'tiles' }" @click="tab.file.view = 'tiles'"><IconLayoutGrid :size="16" /></button>
      </header>
      <div v-if="tab.file.error" class="file-error">{{ tab.file.error }}</div>
      <div ref="listEl" class="file-list" :class="`view-${tab.file.view}`" @scroll="onListScroll">
        <div class="file-list-head"><span>名称</span><span>大小</span><span>修改时间</span><span>类型</span></div>
        <div class="virtual-spacer" :style="{ height: `${topSpacer}px` }" aria-hidden="true" />
        <div
          v-for="entry in renderedEntries"
          :key="entry.path"
          class="file-row"
          :class="{ selected: isSelected(entry), drop: dropTarget === entry.path }"
          draggable="true"
          @click="select(entry, $event)"
          @dblclick="openEntry(entry)"
          @dragstart="onDragStart($event, entry)"
          @dragenter="dropTarget = entry.kind === 'directory' ? entry.path : null"
          @dragover.prevent
          @drop="onDrop($event, entry)"
          @contextmenu.stop="select(entry, $event)"
        >
          <span class="file-name"><span class="file-kind">{{ entry.kind === 'directory' ? '▰' : entry.kind === 'symlink' ? '↗' : '•' }}</span><span>{{ entry.name }}</span></span>
          <span>{{ entry.kind === 'directory' ? '—' : entry.size }}</span>
          <span>{{ entry.modifiedAt ? new Date(entry.modifiedAt).toLocaleString() : '—' }}</span>
          <span>{{ entry.kind }}</span>
        </div>
        <div class="virtual-spacer" :style="{ height: `${bottomSpacer}px` }" aria-hidden="true" />
        <div v-if="tab.file.loading" class="file-empty">正在加载...</div>
        <div v-else-if="!sortedEntries.length && !tab.file.error" class="file-empty">目录为空</div>
      </div>
      <footer class="file-status"><span>SFTP · {{ tab.state }}</span><span>{{ tab.file.selectedPaths.length }} 个项目已选中</span><span v-if="store.sftpClipboard" title="应用内部剪贴板"><IconSearch :size="13" /> {{ store.sftpClipboard.mode }}</span><button type="button" title="关闭文件标签" @click="commandService.execute('tab.close', { area: 'tab', tabId })"><IconX :size="14" /></button></footer>
    </div>
  </CommandContextMenu>
</template>

<style scoped>
.file-panel{width:100%;height:100%;display:flex;flex-direction:column;background:#1e1e1e;color:#ccc;outline:none}.file-toolbar{height:40px;display:flex;align-items:center;gap:5px;padding:0 8px;background:#252526;border-bottom:1px solid #333}.file-toolbar button{width:27px;height:27px;display:inline-flex;align-items:center;justify-content:center;background:#333;border:1px solid #444;color:#ccc;cursor:pointer}.file-toolbar button:hover,.file-toolbar button.active{background:#0e639c;color:#fff}.file-toolbar button:disabled{opacity:.4;cursor:default}.file-toolbar input{min-width:140px;flex:1;height:27px;background:#1e1e1e;border:1px solid #555;color:#eee;padding:0 8px}.file-toolbar select{height:27px;max-width:160px;background:#1e1e1e;border:1px solid #555;color:#ddd}.file-error{padding:8px 12px;color:#f48771;background:#3a1d1d;border-bottom:1px solid #633}.file-list{min-height:0;flex:1;overflow:auto}.file-list-head,.file-row{display:grid;grid-template-columns:minmax(200px,2fr) 100px 170px 100px;gap:10px;align-items:center;padding:0 12px;min-height:32px;height:32px;border-bottom:1px solid #2a2a2a}.virtual-spacer{pointer-events:none}.file-list-head{position:sticky;top:0;background:#2d2d2d;color:#aaa;font-size:12px;z-index:1}.file-row{cursor:default}.file-row:hover{background:#2a2d2e}.file-row.selected{background:#094771;color:#fff}.file-row.drop{outline:1px solid #3794ff}.file-name{display:flex;align-items:center;gap:8px;min-width:0}.file-name span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-kind{color:#dcdcaa}.file-empty{padding:28px;color:#777;text-align:center}.file-status{height:24px;display:flex;align-items:center;gap:14px;padding:0 10px;background:#007acc;color:#fff;font-size:11px}.file-status span:first-child{margin-right:auto}.file-status button{display:inline-flex;align-items:center;border:0;background:transparent;color:#fff;padding:1px;cursor:pointer}.view-tiles .file-list-head,.view-tiles .file-row{grid-template-columns:repeat(3,minmax(130px,1fr));min-height:70px;height:70px}.view-tiles .file-list-head span:not(:first-child),.view-tiles .file-row>span:not(:first-child){display:none}.view-tiles .file-name{flex-direction:column;align-items:flex-start}
</style>
