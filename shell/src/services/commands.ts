import type { Component } from 'vue'
import type { CommandContext } from './context'

export type CommandLabel = string | ((ctx: CommandContext) => string)
export type CommandPredicate = (ctx: CommandContext) => boolean
export type CommandHandler = (ctx: CommandContext) => void | Promise<void>

export interface Command {
  id: string
  label: CommandLabel
  shortcut?: string
  icon?: Component
  when?: CommandPredicate
  enabled?: CommandPredicate
  checked?: CommandPredicate
  execute: CommandHandler
}

export interface MenuCommandEntry {
  kind: 'command'
  commandId: string
  label?: CommandLabel
  shortcut?: string
  icon?: Component
  when?: CommandPredicate
  disabled?: CommandPredicate
  checked?: CommandPredicate
}

export interface MenuSubmenuEntry {
  kind: 'submenu'
  id: string
  label: CommandLabel
  items: MenuEntry[]
  when?: CommandPredicate
}

export interface MenuSeparatorEntry {
  kind: 'separator'
  id?: string
}

export type MenuEntry = MenuCommandEntry | MenuSubmenuEntry | MenuSeparatorEntry

export interface ResolvedMenuItem {
  id: string
  commandId?: string
  label: string
  shortcut?: string
  icon?: Component
  children?: ResolvedMenuItem[]
  separator?: boolean
  disabled: boolean
  checked: boolean
  action?: () => void | Promise<void>
}

export class CommandRegistry {
  private commands = new Map<string, Command>()

  register(command: Command): () => void {
    if (this.commands.has(command.id)) {
      console.warn(`[CommandRegistry] command ${command.id} already registered`)
    }
    this.commands.set(command.id, command)
    return () => {
      if (this.commands.get(command.id) === command) {
        this.commands.delete(command.id)
      }
    }
  }

  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  isVisible(id: string, ctx: CommandContext): boolean {
    const command = this.commands.get(id)
    return !!command && (!command.when || command.when(ctx))
  }

  isEnabled(id: string, ctx: CommandContext): boolean {
    const command = this.commands.get(id)
    return !!command && this.isVisible(id, ctx) && (!command.enabled || command.enabled(ctx))
  }

  isChecked(id: string, ctx: CommandContext): boolean {
    const command = this.commands.get(id)
    return !!command?.checked?.(ctx)
  }

  async execute(id: string, ctx: CommandContext): Promise<void> {
    const command = this.commands.get(id)
    if (!command || !this.isEnabled(id, ctx)) return
    await command.execute(ctx)
  }
}

export class MenuRegistry {
  private menus = new Map<string, MenuEntry[]>()

  register(menuId: string, entries: MenuEntry[]): () => void {
    if (this.menus.has(menuId)) {
      console.warn(`[MenuRegistry] menu ${menuId} already registered`)
    }
    this.menus.set(menuId, entries)
    return () => {
      if (this.menus.get(menuId) === entries) {
        this.menus.delete(menuId)
      }
    }
  }

  get(menuId: string): MenuEntry[] | undefined {
    return this.menus.get(menuId)
  }

  resolve(menuId: string, ctx: CommandContext): ResolvedMenuItem[] {
    const entries = this.menus.get(menuId)
    if (!entries) {
      console.warn(`[MenuRegistry] unknown menu ${menuId}`)
      return []
    }
    return this.resolveEntries(entries, ctx)
  }

  private resolveEntries(entries: MenuEntry[], ctx: CommandContext): ResolvedMenuItem[] {
    const resolved: ResolvedMenuItem[] = []
    for (const entry of entries) {
      if (entry.kind === 'separator') {
        resolved.push({
          id: entry.id ?? `separator-${resolved.length}`,
          separator: true,
          label: '',
          disabled: true,
          checked: false,
        })
        continue
      }

      if (entry.when && !entry.when(ctx)) continue

      if (entry.kind === 'submenu') {
        const children = this.resolveEntries(entry.items, ctx)
        if (!children.length) continue
        resolved.push({
          id: entry.id,
          label: resolveLabel(entry.label, ctx),
          children,
          disabled: false,
          checked: false,
        })
        continue
      }

      const command = commandRegistry.get(entry.commandId)
      if (!command || !commandRegistry.isVisible(entry.commandId, ctx)) {
        if (!command) console.warn(`[MenuRegistry] unknown command ${entry.commandId}`)
        continue
      }

      const disabled = entry.disabled?.(ctx)
        ?? (command.enabled ? !command.enabled(ctx) : false)
      resolved.push({
        id: entry.commandId,
        commandId: entry.commandId,
        label: resolveLabel(entry.label ?? command.label, ctx),
        shortcut: entry.shortcut ?? command.shortcut,
        icon: entry.icon ?? command.icon,
        disabled,
        checked: entry.checked?.(ctx) ?? commandRegistry.isChecked(entry.commandId, ctx),
        action: () => commandRegistry.execute(entry.commandId, ctx),
      })
    }
    return resolved
  }
}

function resolveLabel(label: CommandLabel, ctx: CommandContext): string {
  return typeof label === 'function' ? label(ctx) : label
}

export const commandRegistry = new CommandRegistry()
export const menuRegistry = new MenuRegistry()
