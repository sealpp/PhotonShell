import { readMeta, saveMeta, type KeybindingPreferences } from './storage'
import { formatKeyStroke, keybindingRegistry, parseKeyStroke } from './commands'
import type { KeyStroke, KeybindingOverrideRule } from './commands/types'

const KEY = 'keybindingPreferences'
let writeChain = Promise.resolve()

function currentOverrideRules(exceptCommandId?: string): KeybindingOverrideRule[] {
  return keybindingRegistry.getOverrideRules().filter((rule) => rule.commandId !== exceptCommandId)
}

export async function loadKeybindingPreferences(): Promise<void> {
  const stored = await readMeta<KeybindingPreferences>(KEY)
  if (!stored || stored.version !== 1) return
  keybindingRegistry.setOverrides(stored.overrides.map((rule) => ({ commandId: rule.commandId, key: rule.key })))
  keybindingRegistry.setDisabledCommands(stored.disabled)
}

export async function persistKeybindingPreferences(): Promise<void> {
  const overrides = keybindingRegistry.getOverrideRules()
    .map((rule) => ({ commandId: rule.commandId, key: rule.key === null ? null : formatKeyStroke(rule.key) }))
  await saveMeta<KeybindingPreferences>({
    key: KEY,
    version: 1,
    overrides,
    disabled: keybindingRegistry.getDisabledCommands(),
  })
}

export function queuePersistKeybindingPreferences(): Promise<void> {
  writeChain = writeChain.then(() => persistKeybindingPreferences())
  return writeChain
}

export async function setKeybindingOverride(commandId: string, key: string | KeyStroke | null): Promise<void> {
  const parsed = key === null ? null : parseKeyStroke(key)
  const defaultBinding = keybindingRegistry.getDefaultBinding(commandId)
  const isDefault = parsed !== null && defaultBinding && formatKeyStroke(parsed) === formatKeyStroke(defaultBinding.stroke)
  const rules = currentOverrideRules(commandId)
  if (!isDefault) rules.push({ commandId, key: parsed })
  keybindingRegistry.setOverrides(rules)
  if (parsed !== null) {
    keybindingRegistry.setDisabledCommands(keybindingRegistry.getDisabledCommands().filter((id) => id !== commandId))
  }
  await queuePersistKeybindingPreferences()
}

export async function setKeybindingEnabled(commandId: string, enabled: boolean): Promise<void> {
  const disabled = new Set(keybindingRegistry.getDisabledCommands())
  if (enabled) disabled.delete(commandId)
  else disabled.add(commandId)
  keybindingRegistry.setDisabledCommands([...disabled])
  await queuePersistKeybindingPreferences()
}

export async function resetKeybinding(commandId: string): Promise<void> {
  keybindingRegistry.setOverrides(currentOverrideRules(commandId))
  keybindingRegistry.setDisabledCommands(keybindingRegistry.getDisabledCommands().filter((id) => id !== commandId))
  await queuePersistKeybindingPreferences()
}

export async function resetAllKeybindings(): Promise<void> {
  keybindingRegistry.resetOverrides()
  await queuePersistKeybindingPreferences()
}
