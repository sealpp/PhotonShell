<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../stores/app'
import { pair } from '../services/ws'

const pin = ref('')
const localError = ref('')

function submit() {
  localError.value = ''
  store.error = ''
  pair(pin.value, { onError: (msg) => { localError.value = msg } })
}

function close() {
  store.pairingModalOpen = false
  localError.value = ''
}
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <span class="title">配对 Node</span>
        <button type="button" class="close" @click="close">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>配对码</label>
          <input
            v-model="pin"
            type="text"
            inputmode="numeric"
            maxlength="6"
            pattern="[0-9]*"
            placeholder="000000"
            @keyup.enter="submit"
          />
        </div>
        <p class="hint">Node 启动时已输出 6 位配对码，输入后 PWA 与本地 Node 完成配对。</p>
        <p v-if="localError" class="error">{{ localError }}</p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-default" @click="close">取消</button>
        <button type="button" class="btn-primary" @click="submit">配对</button>
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
  width: 360px;
  max-width: 90vw;
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
}

.close:hover {
  color: #fff;
}

.modal-body {
  padding: 1rem;
}

.form-group {
  margin-bottom: 0.75rem;
}

.form-group label {
  display: block;
  color: #999;
  font-size: 12px;
  margin-bottom: 0.25rem;
}

input {
  width: 100%;
  padding: 0.5rem;
  background: #1e1e1e;
  border: 1px solid #3c3c3c;
  color: #ccc;
  border-radius: 4px;
  font-size: 1.5rem;
  text-align: center;
  letter-spacing: 0.4rem;
  box-sizing: border-box;
}

.hint {
  color: #888;
  font-size: 11px;
  margin: 0;
}

.error {
  color: #f87171;
  font-size: 12px;
  margin: 0.5rem 0 0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem;
  border-top: 1px solid #3c3c3c;
}

.modal-actions button {
  padding: 0.4rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary {
  background: #0e639c;
  color: #fff;
}

.btn-primary:hover {
  background: #1177bb;
}

.btn-default {
  background: #3c3c3c;
  color: #ccc;
}

.btn-default:hover {
  background: #4a4a4a;
}
</style>
