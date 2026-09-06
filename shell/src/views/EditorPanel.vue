<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { openSearchPanel, search, searchKeymap } from '@codemirror/search'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { IconDeviceFloppy, IconSearch, IconX } from '@tabler/icons-vue'
import { store, type EditorTab } from '../stores/app'
import { saveEditorTab } from '../services/sftp/editor-tabs'
import { commandService } from '../services/commands'

const props = defineProps<{ params: { params: { tabId: string; [key: string]: unknown }; [key: string]: unknown } }>()
const tabId = computed(() => String(props.params?.params?.tabId ?? ''))
const tab = computed(() => store.tabs.find((candidate) => candidate.id === tabId.value && candidate.kind === 'editor') as EditorTab | undefined)
const editorEl = ref<HTMLDivElement | null>(null)
let view: EditorView | undefined

function languageExtension(language: string) {
  if (language === 'javascript' || language === 'typescript') return javascript({ typescript: language === 'typescript' })
  if (language === 'json') return json()
  if (language === 'markdown') return markdown()
  if (language === 'python') return python()
  return []
}

function mountEditor(): void {
  const current = tab.value
  if (!current || !editorEl.value || view) return
  const state = EditorState.create({
    doc: current.editor.content,
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      search({ top: true }),
      syntaxHighlighting(defaultHighlightStyle),
      languageExtension(current.editor.language),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        const reactive = tab.value
        if (reactive) {
          reactive.editor.content = update.state.doc.toString()
          reactive.editor.dirty = true
        }
      }),
    ],
  })
  view = new EditorView({ state, parent: editorEl.value })
}

async function save(): Promise<void> { await saveEditorTab(tabId.value) }
function openFind(): void { if (view) void openSearchPanel(view) }

onMounted(mountEditor)
onBeforeUnmount(() => { view?.destroy(); view = undefined })
</script>

<template>
  <div v-if="tab" class="editor-panel">
    <header class="editor-toolbar">
      <span class="editor-title" :title="tab.editor.path">{{ tab.label }}{{ tab.editor.dirty ? ' *' : '' }}</span>
      <span class="editor-path">{{ tab.editor.path }}</span>
      <button type="button" title="查找/替换" @click="openFind"><IconSearch :size="15" /></button>
      <button type="button" title="保存" :disabled="!tab.editor.dirty" @click="save"><IconDeviceFloppy :size="15" /></button>
      <button type="button" title="关闭" @click="commandService.execute('tab.close', { area: 'tab', tabId })"><IconX :size="15" /></button>
    </header>
    <div ref="editorEl" class="editor-host" />
    <footer class="editor-status"><span>{{ tab.editor.encoding.toUpperCase() }}{{ tab.editor.bom ? ' BOM' : '' }}</span><span>{{ tab.editor.lineEnding === '\r\n' ? 'CRLF' : tab.editor.lineEnding === '\r' ? 'CR' : 'LF' }}</span><span>{{ tab.editor.size }} bytes</span><span v-if="tab.state === 'error'" class="error">{{ tab.error }}</span></footer>
  </div>
</template>

<style scoped>
.editor-panel{width:100%;height:100%;display:flex;flex-direction:column;background:#1e1e1e;color:#ccc}.editor-toolbar{height:38px;display:flex;align-items:center;gap:8px;padding:0 10px;background:#252526;border-bottom:1px solid #333}.editor-title{color:#fff;white-space:nowrap}.editor-path{flex:1;min-width:0;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.editor-toolbar button{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border:1px solid #444;background:#333;color:#ddd;cursor:pointer}.editor-toolbar button:hover{background:#0e639c;color:#fff}.editor-toolbar button:disabled{opacity:.4;cursor:default}.editor-host{min-height:0;flex:1;overflow:auto}.editor-host :deep(.cm-editor){height:100%;font-size:13px}.editor-host :deep(.cm-scroller){font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.editor-status{height:24px;display:flex;align-items:center;gap:14px;padding:0 10px;background:#007acc;color:#fff;font-size:11px}.editor-status .error{margin-left:auto;color:#ffd0d0}
</style>
