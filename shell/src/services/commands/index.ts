import { CommandService, CommandRegistry } from './commandRegistry'
import { ContextKeyService, contextKeyService } from './contextKeys'
import { KeybindingRegistry, keybindingRegistry, parseKeyStroke, formatKeyStroke, keyStrokeFromKeyboardEvent } from './keybindingRegistry'
import { commandRegistry, commandService, menuRegistry } from './instances'

export {
  CommandRegistry,
  CommandService,
  ContextKeyService,
  KeybindingRegistry,
  commandRegistry,
  commandService,
  contextKeyService,
  formatKeyStroke,
  keyStrokeFromKeyboardEvent,
  keybindingRegistry,
  menuRegistry,
  parseKeyStroke,
}
export * from './types'
export * from './contextKeys'
export * from './keybindingService'
export { registerAction, registerSubmenu } from './actionRegistry'
