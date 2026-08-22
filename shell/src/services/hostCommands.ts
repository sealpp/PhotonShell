import { commandRegistry, menuRegistry } from './commands'
import { store } from '../stores/app'

commandRegistry.register({
  id: 'host.connect',
  label: '连接',
  enabled: (ctx) => ctx.selectedCount === 1,
  execute: (ctx) => {
    const hostId = ctx.selectedIds?.[0]
    if (!hostId) return
    store.editingHostId = hostId
    store.connectionModalOpen = true
  },
})

commandRegistry.register({
  id: 'host.delete',
  label: (ctx) => {
    const count = ctx.selectedCount ?? 0
    return count > 1 ? `删除 (${count})` : '删除'
  },
  enabled: (ctx) => (ctx.selectedCount ?? 0) > 0,
  execute: (ctx) => {
    store.deleteConfirmIds = ctx.selectedIds ?? []
    store.deleteConfirmOpen = true
  },
})

export const HOST_MENU_ID = 'host.context'

menuRegistry.register(HOST_MENU_ID, [
  { kind: 'command', commandId: 'host.connect' },
  { kind: 'command', commandId: 'host.delete' },
])
