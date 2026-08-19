<script setup lang="ts">
import { ref } from 'vue'
import { store } from '../stores/app'
import { pair } from '../services/ws'

const pin = ref('')

function submit() {
  store.error = ''
  pair(pin.value, { onError: (msg) => { store.error = msg } })
}
</script>

<template>
  <div class="pairing">
    <h1>PhotonShell</h1>
    <p class="hint">Enter the pairing code shown in the Node terminal.</p>
    <input
      v-model="pin"
      type="text"
      inputmode="numeric"
      maxlength="6"
      pattern="[0-9]*"
      placeholder="000000"
      @keyup.enter="submit"
    />
    <button @click="submit">Pair</button>
    <p v-if="store.error" class="error">{{ store.error }}</p>
  </div>
</template>

<style scoped>
.pairing {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

h1 {
  margin: 0;
  color: #38bdf8;
}

.hint {
  color: #94a3b8;
  margin: 0;
}

input {
  font-size: 2rem;
  text-align: center;
  letter-spacing: 0.5rem;
  width: 12rem;
  padding: 0.5rem;
  border: 1px solid #334155;
  border-radius: 0.25rem;
  background: #1e293b;
  color: #e2e8f0;
}

button {
  padding: 0.5rem 1.5rem;
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 0.25rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover {
  background: #0ea5e9;
}

.error {
  color: #f87171;
  margin: 0;
}
</style>
