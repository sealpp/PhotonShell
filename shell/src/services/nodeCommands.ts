import { IconCopy, IconLinkOff, IconPlug } from '@tabler/icons-vue'
import { store } from '../stores/app'
import { disconnectNode, wsUrl } from './ws'
import { writeToClipboard } from '../utils/clipboard'
import { registerAction } from './commands'
import { MenuId } from './actions/menuIds'

registerAction({
  id: 'node.pair',
  title: (ctx) => ctx.isPaired ? '重新配对' : '配对',
  icon: IconPlug,
  run: () => {
    store.pairingModalOpen = true
  },
  menus: [{ menuId: MenuId.NodeStatus, order: 10 }],
})

registerAction({
  id: 'node.disconnect',
  title: '断开当前 Node 连接',
  icon: IconLinkOff,
  when: 'isPaired == true',
  run: () => disconnectNode(),
  menus: [{ menuId: MenuId.NodeStatus, order: 20 }],
})

registerAction({
  id: 'node.copyAddress',
  title: '复制 Node 地址',
  icon: IconCopy,
  run: async () => {
    await writeToClipboard(wsUrl())
  },
  menus: [{ menuId: MenuId.NodeStatus, order: 30 }],
})

export { NODE_MENU_ID } from './actions/menuIds'
