import { IconCopy, IconLinkOff, IconPlug } from '@tabler/icons-vue'
import { commandRegistry } from './commands'
import { disconnectNode, wsUrl } from './ws'
import { store } from '../stores/app'
import { writeToClipboard } from '../utils/clipboard'

commandRegistry.register({
  id: 'node.pair',
  label: (ctx) => ctx.hasToken ? '重新配对' : '配对',
  icon: IconPlug,
  action: () => {
    store.pairingModalOpen = true
  },
})

commandRegistry.register({
  id: 'node.disconnect',
  label: '断开当前 Node 连接',
  icon: IconLinkOff,
  when: (ctx) => ctx.hasToken === true,
  action: () => {
    disconnectNode()
  },
})

commandRegistry.register({
  id: 'node.copyAddress',
  label: '复制 Node 地址',
  icon: IconCopy,
  action: async () => {
    await writeToClipboard(wsUrl())
  },
})

export function getNodeMenuIds(): string[] {
  return ['node.pair', 'node.disconnect', 'node.copyAddress']
}
