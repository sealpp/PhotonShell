import { commandRegistry, menuRegistry } from './commands'
import type { CommandContext } from './context'
import { store } from '../stores/app'
import { closeTabs } from './ws'

export const TAB_MENU_ID = 'tab.context'

function getTab(ctx: CommandContext) {
  return ctx.tabId ? store.tabs.find((tab) => tab.id === ctx.tabId) : undefined
}

function getGroupTabIds(ctx: CommandContext): string[] {
  const ids = ctx.tabGroupTabIds ?? (ctx.tabId ? [ctx.tabId] : [])
  return ids.filter((id) => store.tabs.some((tab) => tab.id === id))
}

function getTargetIndex(ctx: CommandContext, ids: string[]): number {
  return ctx.tabId ? ids.indexOf(ctx.tabId) : -1
}

commandRegistry.register({
  id: 'tab.close',
  label: '关闭',
  when: (ctx) => ctx.area === 'tab',
  enabled: (ctx) => !!getTab(ctx),
  execute: (ctx) => {
    if (ctx.tabId) closeTabs([ctx.tabId])
  },
})

commandRegistry.register({
  id: 'tab.closeOthers',
  label: '关闭其他',
  when: (ctx) => ctx.area === 'tab',
  enabled: (ctx) => {
    const ids = getGroupTabIds(ctx)
    return !!getTab(ctx) && ids.length > 1 && getTargetIndex(ctx, ids) !== -1
  },
  execute: (ctx) => {
    if (!ctx.tabId) return
    closeTabs(getGroupTabIds(ctx).filter((id) => id !== ctx.tabId))
  },
})

commandRegistry.register({
  id: 'tab.closeToRight',
  label: '关闭右侧',
  when: (ctx) => ctx.area === 'tab',
  enabled: (ctx) => {
    const ids = getGroupTabIds(ctx)
    const index = getTargetIndex(ctx, ids)
    return !!getTab(ctx) && index !== -1 && index < ids.length - 1
  },
  execute: (ctx) => {
    const ids = getGroupTabIds(ctx)
    const index = getTargetIndex(ctx, ids)
    if (index !== -1) closeTabs(ids.slice(index + 1))
  },
})

commandRegistry.register({
  id: 'tab.closeAll',
  label: '关闭全部',
  when: (ctx) => ctx.area === 'tab',
  enabled: (ctx) => getGroupTabIds(ctx).length > 0 && !!getTab(ctx),
  execute: (ctx) => {
    closeTabs(getGroupTabIds(ctx))
  },
})

menuRegistry.register(TAB_MENU_ID, [
  { kind: 'command', commandId: 'tab.close' },
  { kind: 'command', commandId: 'tab.closeOthers' },
  { kind: 'command', commandId: 'tab.closeToRight' },
  { kind: 'command', commandId: 'tab.closeAll' },
])
