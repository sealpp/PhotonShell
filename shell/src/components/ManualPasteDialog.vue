<script setup lang="ts">
import { ref } from 'vue'
import type { Terminal } from '@xterm/xterm'
import { store } from '../stores/app'
import { IconX } from '@tabler/icons-vue'

const text = ref('')
const textareaEl = ref<HTMLTextAreaElement | null>(null)

function getTerminal(): Terminal | undefined {
  return store.manualPaste?.context?.terminal as Terminal | undefined
}

function onPaste(event: ClipboardEvent) {
  const pasted = event.clipboardData?.getData('text')
  if (pasted != null) {
    event.preventDefault()
    text.value = pasted
  }
}

function submit() {
  const terminal = getTerminal()
  if (terminal && text.value) {
    terminal.paste(text.value)
  }
  close()
}

function close() {
  store.manualPaste = null
  text.value = ''
}
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span class="title">手动粘贴</span>
        <button type="button" class="close" @click="close">
          <IconX :size="16" />
        </button>
      </div>
      <div class="modal-body">
        <p class="hint">剪贴板不可用。请按 Ctrl+V 粘贴到下方输入框，或手动输入。</p>
        <textarea
          ref="textareaEl"
          v-model="text"
          class="paste-input"
          rows="6"
          @paste="onPaste"
        />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-default" @click="close">取消</button>
        <button type="button" class="btn-primary" :disabled="!text" @click="submit">粘贴到终端</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  width: 520px;
  max-width: 90vw;
  max-height: 90vh;
  background: #2d2d2d;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.modal-header {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.75rem;
  border-bottom: 1px solid #3c3c3c;
}

.title {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
}

.close {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close:hover {
  color: #fff;
}

.modal-body {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.hint {
  color: #888;
  font-size: 12px;
  margin: 0;
}

.paste-input {
  width: 100%;
  padding: 0.5rem;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #ccc;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  resize: vertical;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #3c3c3c;
}

.btn-default {
  background: #3c3c3c;
  color: #ccc;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 13px;
}

.btn-default:hover {
  background: #4a4a4a;
}

.btn-primary {
  background: #0e639c;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:disabled {
  background: #3c3c3c;
  color: #888;
  cursor: default;
}

.btn-primary:hover:not(:disabled) {
  background: #1177bb;
}
</style>
