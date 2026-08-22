import { commandRegistry } from './commands'
import { store } from '../stores/app'

commandRegistry.register({
  id: 'host.connect',
  label: '连接',
  disabled: (ctx) => (ctx.selectedCount as number) !== 1,
  action: (ctx) => {
    const count = ctx.selectedCount as number
    if (count !== 1) return
    const ids = ctx.selectedIds as string[]
    store.editingHostId = ids[0]
    store.connectionModalOpen = true
    store.contextMenu = null
  },
})

commandRegistry.register({
  id: 'host.delete',
  label: (ctx) => {
    const count = ctx.selectedCount as number
    return count > 1 ? `删除 (${count})` : '删除'
  },
  action: (ctx) => {
    const ids = ctx.selectedIds as string[]
    store.deleteConfirmIds = ids
    store.deleteConfirmOpen = true
    store.contextMenu = null
  },
})

export function getHostMenuIds(): string[] {
  return ['host.connect', 'host.delete']
}
