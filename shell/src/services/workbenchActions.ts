import { store } from '../stores/app'
import { menuRegistry, registerAction } from './commands'
import { MenuId } from './actions/menuIds'

registerAction({
  id: 'workbench.openSettings',
  title: '设置',
  run: () => {
    store.aboutModalOpen = false
    store.settingsModalOpen = true
  },
  menus: [{ menuId: MenuId.Workbench, group: '1_settings', order: 10 }],
})

registerAction({
  id: 'workbench.openAbout',
  title: '关于',
  run: () => {
    store.settingsModalOpen = false
    store.aboutModalOpen = true
  },
  menus: [{ menuId: MenuId.Workbench, group: '2_about', order: 10 }],
})

menuRegistry.appendSeparator(MenuId.Workbench, 'workbench.settings-separator', '2_about', 0)

registerAction({
  id: 'workbench.toggleConnections',
  title: '当前连接',
  checked: 'sidebarOpen',
  run: () => {
    if (store.sidebarOpen && store.sidebarView === 'connections') store.sidebarOpen = false
    else {
      store.sidebarOpen = true
      store.sidebarView = 'connections'
    }
  },
})

registerAction({
  id: 'workbench.togglePanel',
  title: '系统监控',
  checked: 'panelOpen',
  run: () => {
    store.panelOpen = !store.panelOpen
  },
})

export const WORKBENCH_MENU_ID = MenuId.Workbench
