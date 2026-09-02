import type { ActionDescriptor, SubmenuContribution } from './types'
import { commandRegistry, keybindingRegistry, menuRegistry } from './instances'

export function registerAction(action: ActionDescriptor): () => void {
  const disposeCommand = commandRegistry.register(action)
  const disposeMenus = (action.menus ?? []).map((menu) => menuRegistry.appendMenuItem(menu.menuId, {
    ...menu,
    commandId: action.id,
    title: menu.title,
    icon: menu.icon ?? action.icon,
  }))
  const disposeKeys = (action.keybindings ?? []).map((keybinding) => keybindingRegistry.register(action.id, keybinding))
  return () => {
    disposeCommand()
    disposeMenus.forEach((dispose) => dispose())
    disposeKeys.forEach((dispose) => dispose())
  }
}

export function registerSubmenu(submenu: SubmenuContribution): () => void {
  return menuRegistry.appendSubmenu(submenu)
}
