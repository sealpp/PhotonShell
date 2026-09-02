import { store } from '../stores/app'
import { connectHost } from './ws'
import { registerAction } from './commands'
import { MenuId } from './actions/menuIds'

registerAction({
  id: 'host.new',
  title: '新建连接',
  run: () => {
    store.editingHostId = ''
    store.connectionModalOpen = true
  },
})

registerAction({
  id: 'host.connect',
  title: '连接',
  when: 'area == "host"',
  enablement: 'selectedCount == 1',
  run: (ctx) => {
    const hostId = ctx.selectedIds?.[0]
    if (!hostId) return
    const host = store.hosts.find((item) => item.id === hostId)
    if (host) void connectHost(host)
  },
  menus: [{ menuId: MenuId.HostContext, order: 10 }],
})

registerAction({
  id: 'host.edit',
  title: '编辑',
  when: 'area == "host"',
  enablement: 'selectedCount == 1',
  run: (ctx) => {
    const hostId = ctx.selectedIds?.[0]
    if (!hostId || !store.hosts.some((host) => host.id === hostId)) return
    store.editingHostId = hostId
    store.connectionModalOpen = true
  },
  menus: [{ menuId: MenuId.HostContext, order: 20 }],
})

registerAction({
  id: 'host.delete',
  title: (ctx) => {
    const count = ctx.selectedCount ?? 0
    return count > 1 ? `删除 (${count})` : '删除'
  },
  when: 'area == "host"',
  enablement: 'selectedCount > 0',
  run: (ctx) => {
    store.deleteConfirmIds = ctx.selectedIds ?? []
    store.deleteConfirmOpen = true
  },
  menus: [{ menuId: MenuId.HostContext, order: 30 }],
})

export { HOST_MENU_ID } from './actions/menuIds'
