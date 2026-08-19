<script setup lang="ts">
import { ref } from 'vue'
import { create } from '@bufbuild/protobuf'
import { HostProfileSchema } from '../proto/photon_pb'
import { store } from '../stores/app'
import { connectToHost, createHost, listHosts } from '../services/ws'
import { randomId } from '../utils/id'

const address = ref('127.0.0.1')
const port = ref(22)
const username = ref('root')

listHosts()

function addHost() {
  store.error = ''
  const host = create(HostProfileSchema, {
    id: randomId(),
    address: address.value,
    port: port.value,
    username: username.value,
  })
  createHost(host)
}

function connect(host: typeof store.hosts[0]) {
  const password = window.prompt(`SSH password for ${host.username}@${host.address}:${host.port}`)
  if (!password) return
  store.error = ''
  store.selectedHostId = host.id
  connectToHost(host.id, password)
  store.view = 'shell'
}
</script>

<template>
  <div class="host-form">
    <h2>Hosts</h2>
    <ul v-if="store.hosts.length" class="host-list">
      <li v-for="h in store.hosts" :key="h.id">
        <span class="addr">{{ h.address }}:{{ h.port }}</span>
        <span class="user">{{ h.username }}</span>
        <button class="connect" type="button" @click="connect(h)">Connect</button>
      </li>
    </ul>
    <p v-else class="empty">No saved hosts yet.</p>

    <h3>Add Host</h3>
    <form @submit.prevent="addHost" class="add-form">
      <input v-model="address" placeholder="address" required />
      <input v-model.number="port" type="number" placeholder="port" required />
      <input v-model="username" placeholder="username" required />
      <button type="submit">Add</button>
    </form>
    <p v-if="store.error" class="error">{{ store.error }}</p>
  </div>
</template>

<style scoped>
.host-form {
  padding: 2rem;
  max-width: 640px;
  margin: 0 auto;
}

h2, h3 {
  color: #38bdf8;
}

.host-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
}

.host-list li {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 0.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.25rem;
  margin-bottom: 0.5rem;
}

.addr {
  font-weight: 600;
  flex: 1;
}

.user {
  color: #94a3b8;
}

.connect {
  background: #22c55e;
  color: #0f172a;
  border: none;
  border-radius: 0.25rem;
  padding: 0.25rem 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.connect:hover {
  background: #16a34a;
}

.empty {
  color: #94a3b8;
}

.add-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

input {
  background: #1e293b;
  color: #e2e8f0;
  border: 1px solid #334155;
  border-radius: 0.25rem;
  padding: 0.5rem;
  min-width: 8rem;
}

button {
  background: #38bdf8;
  color: #0f172a;
  border: none;
  border-radius: 0.25rem;
  padding: 0.5rem 1rem;
  font-weight: 600;
  cursor: pointer;
}

button:hover {
  background: #0ea5e9;
}

.error {
  color: #f87171;
}
</style>
