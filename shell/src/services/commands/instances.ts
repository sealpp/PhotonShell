import { commandRegistry, commandService } from './commandRegistry'
import { contextKeyService } from './contextKeys'
import { keybindingRegistry } from './keybindingRegistry'
import { MenuRegistry } from './menuRegistry'

export const menuRegistry = new MenuRegistry(commandRegistry, commandService, contextKeyService, keybindingRegistry)

export { commandRegistry, commandService, contextKeyService, keybindingRegistry }
