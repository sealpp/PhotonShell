---
name: photon-e2e
description: 运行和维护 PhotonShell 端到端测试（PWA/WASM 协议客户端 + PhotonNode transport + mock SSH）。当要写 E2E、调试 PWA telemetry polling、复现标签生命周期或完整验证 PWA ↔ Node ↔ 远端协议链路时使用。
---

# PhotonShell E2E 测试指南

## 测试栈

```text
Playwright (Chromium)
  ↓ HTTP/WebSocket
PWA (Vite/Vue + WASM SSH client)
  ↓ loopback WebSocket transport
PhotonNode (Python pairing + TCP/UDP relay)
  ↓ TCP
mock SSH server (asyncssh)
```

PhotonNode 不实现 SSH，也不保存主机或凭据业务数据。完整链路中的 SSH 协议由 PWA/WASM
客户端执行；mock SSH 只属于测试依赖。

## 端口

1. PWA dev server 默认 `8080`，但被占用时 Vite 会 fallback 到更高端口。Node 只绑定
   loopback 且不做 Origin 校验，PWA 端口变化无需调整 Node 配置。
2. Node WebSocket 默认监听 `17373`，PWA transport 地址在 `shell/src/services/nodeClient.ts`
   中固定使用当前页面 hostname 和该端口。
3. 如果宿主机已有进程占用 `17373`，不要终止无关进程。将 PWA、mock SSH、PhotonNode 和
   Playwright 放进同一个 network namespace；`unshare --net` 后先执行 `ip link set lo up`。

示例：

```bash
unshare --net -- bash -lc '
  ip link set lo up
  npm --prefix shell run dev -- --port 8081 --host 127.0.0.1 >/tmp/photon-e2e-vite.log 2>&1 &
  pwa_pid=$!
  trap "kill $pwa_pid 2>/dev/null || true" EXIT
  until curl -fsS http://127.0.0.1:8081 >/dev/null; do sleep 0.2; done
  PWA_URL=http://127.0.0.1:8081 node .agents/skills/photon-e2e/run-e2e.js
'
```

## Node 与配对

Node 启动后输出：

```text
Listening on ws://127.0.0.1:17373, pairing code: 123456
```

E2E 必须解析实际六位码，不要写死。Node 的当前开发后端使用内存 trust store；Windows
正式后端使用当前用户 Credential Manager 保存节点身份和配对公钥。测试不设置
`PHOTON_MASTER_PASSWORD` 或 `PHOTON_STATE_PATH`。

## mock SSH

`.agents/skills/photon-e2e/mock-ssh-server.py` 应覆盖：

- 密码认证；
- PWA SSH 的交互式 PTY shell；
- `uname -s`；
- telemetry 合并采样命令；
- `printf exec-ok` 和简单终端命令。
- telemetry 后台 shell 的连接计数，验证首次探测、连续采样和收起再打开面板均复用同一连接。

交互式 shell 必须保持存活。PWA telemetry 使用 SSH shell marker 执行隐藏采样，不依赖
Node generic exec。

## 选择器

`配对`、`登录`、`新建连接` 文字可能同时出现在侧边栏和弹窗中，必须限定作用域：

- Dialog 内容：`.workbench-dialog-content`
- 主操作按钮：`.workbench-dialog-content .workbench-dialog-button--primary`
- 取消按钮：`.workbench-dialog-button--default`
- 新建连接：`.new-btn`
- 登录按钮：`page.getByRole('button', { name: '登录' })`
- 密码输入：`input[type="password"]`
- 主机指纹接受：`#host-key-accept`
- PWA vault 主密码：`#vault-password`、`#vault-password-confirm`

## 遥测验收

成功采样时：

- 有 4 个 `[data-metric-value]` 且不包含 `--`；
- 有 3 个 `[data-metric-kind="gauge"] .metric-gauge-chart`；
- 有 `[data-metric-id="process.count"][data-metric-kind="stat"]`。

当前仪表盘使用 CSS gauge，不依赖 canvas。面板关闭、标签切换或 session 断开时必须停止
polling；刷新后 host profile、凭据和设备身份保留，但活动 tab/stream 不恢复。

## PWA WASM 资源

Vite 配置会从已锁定的 npm 依赖复制以下运行时资源到开发/构建 public 目录：

- `sshclient.wasm`
- `wasm_exec.js`
- `argon2-bundled.min.js`

这些生成文件不提交。修改 `ws.ts`、`nodeClient.ts`、`ssh.ts`、`vault.ts` 或 Vite 配置后，
刷新页面或重启 dev server 再跑 E2E，避免 HMR 使用旧的 WASM/模块状态。

## 文件卫生

- 失败截图和临时日志放在 `/tmp/photon-e2e/`；
- `node_modules`、`.venv`、`shell/dist`、`shell/src/proto` 和 WASM 运行时复制文件不提交；
- 测试脚本、端口策略、选择器或链路行为变化时同步更新本 skill。
