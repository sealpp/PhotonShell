import { ref } from 'vue'
import type { CommandContext } from '../context'
import { contextKeyService, type ContextKeyService } from './contextKeys'
import type { ActionDescriptor, Command, CommandHandler, CommandLabel, CommandPredicate, LegacyCommand } from './types'

export interface RegisteredCommand extends ActionDescriptor {
  legacyShortcut?: string
  legacyWhen?: CommandPredicate
  legacyEnabled?: CommandPredicate
  legacyChecked?: CommandPredicate
}

function isActionDescriptor(command: Command): command is ActionDescriptor {
  return 'title' in command && 'run' in command
}

function normalizeCommand(command: Command): RegisteredCommand {
  if (isActionDescriptor(command)) return command
  const legacy = command as LegacyCommand
  return {
    id: legacy.id,
    title: legacy.label,
    icon: legacy.icon,
    legacyShortcut: legacy.shortcut,
    legacyWhen: legacy.when,
    legacyEnabled: legacy.enabled,
    legacyChecked: legacy.checked,
    run: legacy.execute,
  }
}

export class CommandRegistry {
  private readonly commands = new Map<string, RegisteredCommand>()
  private readonly revision = ref(0)
  private readonly listeners = new Set<(id: string) => void>()

  register(command: Command): () => void {
    const normalized = normalizeCommand(command)
    if (this.commands.has(normalized.id)) {
      console.warn(`[CommandRegistry] command ${normalized.id} already registered`)
    }
    this.commands.set(normalized.id, normalized)
    this.revision.value++
    this.listeners.forEach((listener) => listener(normalized.id))
    return () => {
      if (this.commands.get(normalized.id) === normalized) {
        this.commands.delete(normalized.id)
        this.revision.value++
        this.listeners.forEach((listener) => listener(normalized.id))
      }
    }
  }

  get(id: string): RegisteredCommand | undefined {
    void this.revision.value
    return this.commands.get(id)
  }

  getCommands(): Map<string, RegisteredCommand> {
    void this.revision.value
    return new Map(this.commands)
  }

  onDidRegister(listener: (id: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}

export class CommandService {
  constructor(
    private readonly registry: CommandRegistry,
    private readonly contexts: ContextKeyService = contextKeyService,
  ) {}

  isVisible(id: string, ctx: CommandContext): boolean {
    const command = this.registry.get(id)
    if (!command) return false
    return this.contexts.evaluate(command.when, ctx) && (!command.legacyWhen || command.legacyWhen(ctx))
  }

  isEnabled(id: string, ctx: CommandContext): boolean {
    const command = this.registry.get(id)
    if (!command || !this.isVisible(id, ctx)) return false
    return this.contexts.evaluate(command.enablement, ctx) && (!command.legacyEnabled || command.legacyEnabled(ctx))
  }

  isChecked(id: string, ctx: CommandContext): boolean {
    const command = this.registry.get(id)
    if (!command?.checked) return Boolean(command?.legacyChecked?.(ctx))
    if (typeof command.checked === 'function') return command.checked(ctx)
    return this.contexts.evaluate(command.checked, ctx)
  }

  async execute(id: string, ctx: CommandContext, ...args: unknown[]): Promise<void> {
    const command = this.registry.get(id)
    if (!command || !this.isEnabled(id, ctx)) return
    await command.run(ctx, ...args)
  }
}

export const commandRegistry = new CommandRegistry()
export const commandService = new CommandService(commandRegistry)

export type { Command, CommandHandler, CommandLabel, CommandPredicate }
