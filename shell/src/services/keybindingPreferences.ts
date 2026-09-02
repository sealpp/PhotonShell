import { readMeta, saveMeta, type KeybindingPreferences } from './storage'
import { formatKeyStroke, keybindingRegistry } from './commands'

const KEY = 'keybindingPreferences'

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
