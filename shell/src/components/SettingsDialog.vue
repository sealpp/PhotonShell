<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { IconRotate } from '@tabler/icons-vue'
import '@xterm/xterm/css/xterm.css'
import { store, type TerminalPreferences } from '../stores/app'
import UiDialog from './UiDialog.vue'
import { confirmDialog, alertDialog } from '../services/dialogs'
import { DEFAULT_TERMINAL_PREFERENCES, defaultTerminalPreferences, getTerminalFontFamily, getTerminalTheme, saveTerminalPreferences, terminalFontOptions, terminalThemeNames, terminalWeightOptions } from '../services/terminalPreferences'

const previewEl = ref<HTMLDivElement | null>(null)
const draft = ref<TerminalPreferences>({ ...store.terminalPreferences })
const saved = ref<TerminalPreferences>({ ...store.terminalPreferences })
let preview: Terminal | null = null
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(saved.value))

function resetField(field: keyof Pick<TerminalPreferences, 'theme' | 'fontFamily' | 'fontSize' | 'lineHeight' | 'fontWeight' | 'fontWeightBold'>): void {
  draft.value[field] = DEFAULT_TERMINAL_PREFERENCES[field] as never
}
async function resetAll(): Promise<void> {
  if (await confirmDialog('恢复默认设置', '将恢复本页所有终端外观设置，保存后生效。')) draft.value = defaultTerminalPreferences()
}
function applyPreview(): void {
  if (!preview) return
  const p = draft.value
  preview.options.fontFamily = getTerminalFontFamily(p.fontFamily)
  preview.options.fontSize = p.fontSize
  preview.options.lineHeight = p.lineHeight
  preview.options.fontWeight = p.fontWeight
  preview.options.fontWeightBold = p.fontWeightBold
  preview.options.theme = getTerminalTheme(p.theme)
  fitAddon?.fit()
}
async function save(): Promise<void> {
  try {
    await saveTerminalPreferences({ ...draft.value })
    saved.value = { ...draft.value }
    store.settingsModalOpen = false
  } catch (error) {
    await alertDialog('保存失败', error instanceof Error ? error.message : String(error))
  }
}
async function close(): Promise<void> {
  if (dirty.value && !await confirmDialog('放弃更改', '当前设置尚未保存，确定要放弃这些更改吗？', { confirmLabel: '放弃更改', danger: true })) return
  store.settingsModalOpen = false
}

onMounted(async () => {
  await nextTick()
  if (!previewEl.value) return
  const p = draft.value
  preview = new Terminal({ cursorBlink: true, convertEol: true, fontFamily: getTerminalFontFamily(p.fontFamily), fontSize: p.fontSize, lineHeight: p.lineHeight, fontWeight: p.fontWeight, fontWeightBold: p.fontWeightBold, theme: getTerminalTheme(p.theme) })
  fitAddon = new FitAddon()
  preview.loadAddon(fitAddon)
  preview.open(previewEl.value)
  preview.write('\x1b[1;36mSealShell terminal preview\x1b[0m\r\n')
  preview.write('\x1b[32m$\x1b[0m printf "\x1b[31m彩色文本\x1b[0m 你好，世界 👋\\n"\r\n')
  preview.write('\x1b[33m普通  中等  半粗  粗体\x1b[0m\r\n')
  preview.write('Unicode: λ → ✓  |  ANSI: \x1b[1;35mbold magenta\x1b[0m\r\n')
  fitAddon.fit()
  resizeObserver = new ResizeObserver(() => fitAddon?.fit())
  resizeObserver.observe(previewEl.value)
})
watch(draft, applyPreview, { deep: true })
onBeforeUnmount(() => { resizeObserver?.disconnect(); preview?.dispose(); preview = null })
</script>

<template>
  <UiDialog :open="store.settingsModalOpen" title="设置" width="80vw" height="80vh" content-class="settings-dialog-content" @close="close">
    <div class="settings-layout">
      <nav class="settings-nav" aria-label="设置分类"><button type="button" class="settings-nav-item active">外观</button></nav>
      <main class="settings-main">
        <div class="settings-heading"><div><h2>外观</h2><p>调整终端字体和配色方案。</p></div><button type="button" class="settings-reset-all" @click="resetAll">恢复默认</button></div>
        <div ref="previewEl" class="terminal-preview" aria-label="终端外观预览" />
        <h3 class="settings-section-title">文本</h3>
        <div class="settings-form">
          <label class="settings-row"><span><strong>配色方案</strong><small>选择终端的完整 ANSI 配色。</small></span><span class="settings-control"><select v-model="draft.theme" aria-label="配色方案"><option v-for="name in terminalThemeNames" :key="name" :value="name">{{ name }}</option></select><button v-if="draft.theme !== DEFAULT_TERMINAL_PREFERENCES.theme" type="button" class="settings-reset" title="恢复默认配色" aria-label="恢复默认配色" @click="resetField('theme')"><IconRotate :size="15" /></button></span></label>
          <label class="settings-row"><span><strong>字体</strong><small>选择终端使用的等宽字体。</small></span><span class="settings-control"><select v-model="draft.fontFamily" aria-label="字体"><option v-for="font in terminalFontOptions" :key="font.value" :value="font.value">{{ font.label }}</option></select><button v-if="draft.fontFamily !== DEFAULT_TERMINAL_PREFERENCES.fontFamily" type="button" class="settings-reset" title="恢复默认字体" aria-label="恢复默认字体" @click="resetField('fontFamily')"><IconRotate :size="15" /></button></span></label>
          <label class="settings-row"><span><strong>字号</strong><small>终端文字大小（像素）。</small></span><span class="settings-control"><input v-model.number="draft.fontSize" type="number" min="8" max="32" step="1" aria-label="字号"><button v-if="draft.fontSize !== DEFAULT_TERMINAL_PREFERENCES.fontSize" type="button" class="settings-reset" title="恢复默认字号" aria-label="恢复默认字号" @click="resetField('fontSize')"><IconRotate :size="15" /></button></span></label>
          <label class="settings-row"><span><strong>行高</strong><small>终端行高相对于字号的倍数。</small></span><span class="settings-control"><input v-model.number="draft.lineHeight" type="number" min="1" max="2" step="0.05" aria-label="行高"><button v-if="draft.lineHeight !== DEFAULT_TERMINAL_PREFERENCES.lineHeight" type="button" class="settings-reset" title="恢复默认行高" aria-label="恢复默认行高" @click="resetField('lineHeight')"><IconRotate :size="15" /></button></span></label>
          <label class="settings-row"><span><strong>字体粗细</strong><small>普通文字的字重。</small></span><span class="settings-control"><select v-model.number="draft.fontWeight" aria-label="字体粗细"><option v-for="weight in terminalWeightOptions" :key="weight.value" :value="weight.value">{{ weight.label }}</option></select><button v-if="draft.fontWeight !== DEFAULT_TERMINAL_PREFERENCES.fontWeight" type="button" class="settings-reset" title="恢复默认字体粗细" aria-label="恢复默认字体粗细" @click="resetField('fontWeight')"><IconRotate :size="15" /></button></span></label>
          <label class="settings-row"><span><strong>粗体字体粗细</strong><small>粗体文字的字重。</small></span><span class="settings-control"><select v-model.number="draft.fontWeightBold" aria-label="粗体字体粗细"><option v-for="weight in terminalWeightOptions" :key="weight.value" :value="weight.value">{{ weight.label }}</option></select><button v-if="draft.fontWeightBold !== DEFAULT_TERMINAL_PREFERENCES.fontWeightBold" type="button" class="settings-reset" title="恢复默认粗体字体粗细" aria-label="恢复默认粗体字体粗细" @click="resetField('fontWeightBold')"><IconRotate :size="15" /></button></span></label>
        </div>
      </main>
    </div>
    <template #actions><button type="button" class="workbench-dialog-button workbench-dialog-button--default" @click="close">取消</button><button type="button" class="workbench-dialog-button workbench-dialog-button--primary" :disabled="!dirty" @click="save">保存</button></template>
  </UiDialog>
</template>
