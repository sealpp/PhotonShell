import { IconCopy, IconLinkOff, IconPlug } from '@tabler/icons-vue'
import { commandRegistry, menuRegistry } from './commands'
import { disconnectNode, wsUrl } from './ws'
import { store } from '../stores/app'
import { writeToClipboard } from '../utils/clipboard'

commandRegistry.register({
  id: 'node.pair',
  label: (ctx) => ctx.hasToken ? '重新配对' : '配对',
  icon: IconPlug,
  execute: () => {
    store.pairingModalOpen = true
  },
})

commandRegistry.register({
  id: 'node.disconnect',
  label: '断开当前 Node 连接',
  icon: IconLinkOff,
  when: (ctx) => ctx.hasToken === true,
  execute: () => {
    disconnectNode()
  },
})

commandRegistry.register({
  id: 'node.copyAddress',
  label: '复制 Node 地址',
  icon: IconCopy,
  execute: async () => {
    await writeToClipboard(wsUrl())
  },
})

export const NODE_MENU_ID = 'node.status'

menuRegistry.register(NODE_MENU_ID, [
  { kind: 'command', commandId: 'node.pair' },
  { kind: 'command', commandId: 'node.disconnect' },
  { kind: 'command', commandId: 'node.copyAddress' },
])
