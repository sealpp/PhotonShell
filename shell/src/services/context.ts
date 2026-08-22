import { reactive, toRaw } from 'vue'

export type CommandContext = Record<string, unknown>

export const context = reactive<CommandContext>({})

export function setContext(key: string, value: unknown): void {
  context[key] = value
}

export function setContextAll(values: CommandContext): void {
  Object.assign(context, values)
}

export function getContext<T>(key: string): T | undefined {
  return context[key] as T | undefined
}

export function clearContext(): void {
  for (const key in context) {
    delete context[key]
  }
}

export function snapshotContext(): CommandContext {
  return { ...toRaw(context) }
}
