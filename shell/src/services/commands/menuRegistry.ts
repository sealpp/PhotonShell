import { ref } from 'vue'
import type { CommandContext } from '../context'
import { contextKeyService, type ContextKeyService } from './contextKeys'
import { commandRegistry, type CommandService } from './commandRegistry'
import type {
  MenuContribution,
  MenuEntry,
  ResolvedMenuItem,
  SubmenuContribution,
} from './types'
import type { KeybindingRegistry } from './keybindingRegistry'

interface StoredEntry {
  entry: MenuEntry | MenuContribution
  group?: string
  order: number
  sequence: number
}

interface StoredSubmenu {
  entry: SubmenuContribution
  sequence: number
}

function isLegacyEntry(entry: MenuEntry | MenuContribution): entry is MenuEntry {
  return 'kind' in entry
}

export class MenuRegistry {
  private readonly menus = new Map<string, StoredEntry[]>()
  private readonly submenus = new Map<string, StoredSubmenu>()
  private readonly revision = ref(0)
  private readonly listeners = new Set<() => void>()
  private sequence = 0

  constructor(
    private readonly commands: typeof commandRegistry = commandRegistry,
    private readonly commandService: CommandService,
    private readonly contexts: ContextKeyService = contextKeyService,
    private readonly keybindings?: KeybindingRegistry,
  ) {}

  register(menuId: string, entries: MenuEntry[]): () => void {
    const stored = entries.map((entry, index) => this.store(menuId, entry, undefined, index))
    return () => {
      const current = this.menus.get(menuId) ?? []
      this.menus.set(menuId, current.filter((entry) => !stored.includes(entry)))
      this.touch()
    }
  }

  appendMenuItem(menuId: string, entry: MenuContribution): () => void {
    const stored = this.store(menuId, entry, entry.group, entry.order ?? 0)
    return () => {
      const current = this.menus.get(menuId) ?? []
      this.menus.set(menuId, current.filter((item) => item !== stored))
      this.touch()
    }
  }

  appendSubmenu(entry: SubmenuContribution): () => void {
    const previous = this.submenus.get(entry.id)
    this.submenus.set(entry.id, { entry, sequence: this.sequence++ })
    const parent = this.store(entry.parentMenuId, {
      menuId: entry.parentMenuId,
      submenuId: entry.id,
      title: entry.title,
      when: entry.when,
      group: entry.group,
      order: entry.order,
    }, entry.group, entry.order ?? 0)
    return () => {
      if (this.submenus.get(entry.id)?.entry === entry) {
        if (previous) this.submenus.set(entry.id, previous)
        else this.submenus.delete(entry.id)
      }
      const current = this.menus.get(entry.parentMenuId) ?? []
      this.menus.set(entry.parentMenuId, current.filter((item) => item !== parent))
      this.touch()
    }
  }

  appendSeparator(menuId: string, id?: string, group?: string, order = 0): () => void {
    return this.appendMenuItem(menuId, { menuId, separator: true, group, order, title: id ?? '' })
  }

  get(menuId: string): MenuEntry[] | undefined {
    void this.revision.value
    const entries = this.menus.get(menuId)
    if (!entries) return undefined
    return entries.map((stored) => stored.entry).filter(isLegacyEntry)
  }

  getContributions(menuId: string): readonly (MenuEntry | MenuContribution)[] {
    void this.revision.value
    return (this.menus.get(menuId) ?? []).map((stored) => stored.entry)
  }

  resolve(menuId: string, ctx: CommandContext): ResolvedMenuItem[] {
    void this.revision.value
    return this.resolveEntries(menuId, this.sorted(this.menus.get(menuId) ?? []), ctx)
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private resolveEntries(menuId: string, entries: StoredEntry[], ctx: CommandContext): ResolvedMenuItem[] {
    const resolved: ResolvedMenuItem[] = []
    for (const stored of entries) {
      const entry = stored.entry
      if (isLegacyEntry(entry)) {
        const item = this.resolveLegacy(entry, ctx, resolved.length)
        if (item) resolved.push(item)
        continue
      }

      if (entry.separator) {
        resolved.push({
          id: `${menuId}.separator.${stored.sequence}`,
          separator: true,
          label: '',
          disabled: true,
          checked: false,
        })
        continue
      }
      if (!this.contexts.evaluate(entry.when, ctx)) continue

      if (entry.submenuId) {
        const submenu = this.submenus.get(entry.submenuId)?.entry
        if (!submenu) continue
        const children = this.resolveEntries(entry.submenuId, this.sorted(this.menus.get(entry.submenuId) ?? []), ctx)
        if (!children.length) continue
        resolved.push({
          id: entry.submenuId,
          label: resolveLabel(entry.title ?? submenu.title, ctx),
          icon: entry.icon ?? undefined,
          children,
          disabled: false,
          checked: false,
        })
        continue
      }

      if (!entry.commandId) continue
      const command = this.commands.get(entry.commandId)
      if (!command || !this.commandService.isVisible(entry.commandId, ctx)) {
        if (!command) console.warn(`[MenuRegistry] unknown command ${entry.commandId}`)
        continue
      }
      const enabled = this.commandService.isEnabled(entry.commandId, ctx)
        && this.contexts.evaluate(entry.enablement, ctx)
      resolved.push({
        id: entry.commandId,
        commandId: entry.commandId,
        label: resolveLabel(entry.title ?? command.title, ctx),
        shortcut: this.keybindings?.getLabel(entry.commandId, ctx),
        icon: entry.icon ?? command.icon,
        disabled: !enabled,
        checked: this.commandService.isChecked(entry.commandId, ctx),
        action: () => this.commandService.execute(entry.commandId!, ctx),
      })
    }
    return resolved
  }

  private resolveLegacy(entry: MenuEntry, ctx: CommandContext, index: number): ResolvedMenuItem | null {
    if (entry.kind === 'separator') {
      return { id: entry.id ?? `separator-${index}`, separator: true, label: '', disabled: true, checked: false }
    }
    if (entry.when && !entry.when(ctx)) return null
    if (entry.kind === 'submenu') {
      const children = this.resolveLegacyEntries(entry.items, ctx)
      if (!children.length) return null
      return { id: entry.id, label: resolveLabel(entry.label, ctx), children, disabled: false, checked: false }
    }
    const command = this.commands.get(entry.commandId)
    if (!command || !this.commandService.isVisible(entry.commandId, ctx)) {
      if (!command) console.warn(`[MenuRegistry] unknown command ${entry.commandId}`)
      return null
    }
    const disabled = entry.disabled?.(ctx) ?? !this.commandService.isEnabled(entry.commandId, ctx)
    return {
      id: entry.commandId,
      commandId: entry.commandId,
      label: resolveLabel(entry.label ?? command.title, ctx),
      shortcut: entry.shortcut ?? this.keybindings?.getLabel(entry.commandId, ctx) ?? command.legacyShortcut,
      icon: entry.icon ?? command.icon,
      disabled,
      checked: entry.checked?.(ctx) ?? this.commandService.isChecked(entry.commandId, ctx),
      action: () => this.commandService.execute(entry.commandId, ctx),
    }
  }

  private resolveLegacyEntries(entries: MenuEntry[], ctx: CommandContext): ResolvedMenuItem[] {
    const resolved: ResolvedMenuItem[] = []
    for (const entry of entries) {
      const item = this.resolveLegacy(entry, ctx, resolved.length)
      if (item) resolved.push(item)
    }
    return resolved
  }

  private store(menuId: string, entry: MenuEntry | MenuContribution, group: string | undefined, order: number): StoredEntry {
    const stored = { entry, group, order, sequence: this.sequence++ }
    const items = this.menus.get(menuId) ?? []
    items.push(stored)
    this.menus.set(menuId, items)
    this.touch()
    return stored
  }

  private touch(): void {
    this.revision.value++
    this.listeners.forEach((listener) => listener())
  }

  private sorted(entries: StoredEntry[]): StoredEntry[] {
    return [...entries].sort((left, right) => {
      const group = (left.group ?? '').localeCompare(right.group ?? '')
      return group || left.order - right.order || left.sequence - right.sequence
    })
  }
}

function resolveLabel(label: string | ((ctx: CommandContext) => string), ctx: CommandContext): string {
  return typeof label === 'function' ? label(ctx) : label
}
