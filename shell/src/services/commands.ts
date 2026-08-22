import type { Component } from 'vue'
import type { CommandContext } from './context'

export interface Command {
  id: string
  label: string | ((ctx: CommandContext) => string)
  shortcut?: string
  icon?: Component
  children?: string[]
  when?: (ctx: CommandContext) => boolean
  disabled?: (ctx: CommandContext) => boolean
  checked?: (ctx: CommandContext) => boolean
  action?: (ctx: CommandContext) => void | Promise<void>
}

export interface ResolvedCommand {
  id: string
  label: string
  shortcut?: string
  icon?: Component
  children?: ResolvedCommand[]
  disabled: boolean
  checked: boolean
  action?: () => void | Promise<void>
}

class CommandRegistry {
  private commands = new Map<string, Command>()

  register(command: Command): void {
    if (this.commands.has(command.id)) {
      console.warn(`[CommandRegistry] command ${command.id} already registered`)
    }
    this.commands.set(command.id, command)
  }

  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  resolve(ids: string[], ctx: CommandContext, visited = new Set<string>()): ResolvedCommand[] {
    const result: ResolvedCommand[] = []
    for (const id of ids) {
      if (visited.has(id)) continue
      visited.add(id)
      const cmd = this.commands.get(id)
      if (!cmd) {
        console.warn(`[CommandRegistry] unknown command ${id}`)
        continue
      }
      if (cmd.when && !cmd.when(ctx)) continue

      const resolved: ResolvedCommand = {
        id: cmd.id,
        label: typeof cmd.label === 'function' ? cmd.label(ctx) : cmd.label,
        shortcut: cmd.shortcut,
        icon: cmd.icon,
        disabled: false,
        checked: cmd.checked ? cmd.checked(ctx) : false,
      }

      if (cmd.children?.length) {
        const children = this.resolve(cmd.children, ctx, visited)
        if (!children.length) continue
        resolved.children = children
      } else {
        resolved.disabled = cmd.disabled ? cmd.disabled(ctx) : false
        if (cmd.action && !resolved.disabled) {
          resolved.action = () => cmd.action!(ctx)
        }
      }

      result.push(resolved)
    }
    return result
  }
}

export const commandRegistry = new CommandRegistry()
