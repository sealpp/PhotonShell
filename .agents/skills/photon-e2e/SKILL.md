---
name: photon-e2e
description: 运行和维护 PhotonShell 端到端测试（PWA + PhotonNode + mock SSH）。当你要写 E2E、调试 PWA telemetry polling、复现标签生命周期问题、或发现新的测试环境暗坑时使用。
---

# PhotonShell E2E 测试指南

## 什么时候用

- 用户要求写/跑 E2E。
- 调试 PWA telemetry polling 不更新、消失、或需要切换标签才出现。
- 新增/修改 UI 改变了选择器或标签生命周期。
- 在本地完整复现 PWA ↔ Node ↔ SSH 链路的问题。

## 测试栈

```
Playwright (Chromium)
  ↓ HTTP/WebSocket
PWA (Vite/Vue，动态端口)
  ↓ ws://127.0.0.1:17373
PhotonNode (Python)
  ↓ SSH
mock SSH server (asyncssh)
```

## 必须知道的暗坑

### 端口

1. PWA dev server 默认 `8080`，但经常被 IDE/环境占用，Vite 会 fallback 到 `8081` 或更高。因此 `PHOTON_ALLOWED_ORIGIN` 必须对齐**实际** PWA 端口；不要写死 `http://127.0.0.1:8080`。
2. Node WebSocket 端口 `17373` 在 `shell/src/services/ws.ts` 中硬编码：`ws://${window.location.hostname}:17373`。测试必须让 Node 监听 `17373`，改端口 PWA 会连不上。

### 配对码

Node 启动时 stdout 输出：

```
Listening on ws://127.0.0.1:17373, pairing code: 123456
```

E2E 必须解析这个 6 位码，不要写死。

### mock SSH

要完整跑 PWA telemetry polling，需要一个能响应以下 exec 的 mock SSH server：

- `uname -s`，返回 `Linux`
- PWA Linux provider 的合并采样命令，返回带 `__PHOTON_*__` section 标记的输出
- `printf exec-ok`，用于 generic exec smoke test

可用本目录下的 `mock-ssh-server.py`（基于 `asyncssh`、内存生成 host key）作为 fixture。

### Playwright 选择器

`配对`、`登录`、`新建连接` 这些文字同时出现在侧边栏和弹窗里，`getByText`/`getByRole` 会命中多个元素。必须用 CSS 限定：

- Dialog 内容：`page.locator('.workbench-dialog-content')`
- 主操作按钮：`page.locator('.workbench-dialog-content .workbench-dialog-button--primary')`
- 取消按钮：`page.locator('.workbench-dialog-button--default')`
- 新建连接：`page.locator('.new-btn')`
- 登录按钮：`page.getByRole('button', { name: '登录' })`（只在弹窗里出现，相对安全）
- 密码输入：`page.locator('input[type="password"]')`

### telemetry polling 结果判断

- 面板一直显示 `--`：说明 PWA 没有完成能力探测或 generic exec polling，优先检查监控面板是否打开、active tab 是否 online，以及 `telemetry.ts` 的 provider 是否启动。
- 面板显示 `0.0%` 或 `0`：这是 mock 数据正常，不代表失败。关键是**不是** `--`。

### 标签与布局不持久化

v0 不保存标签和 Dockview 布局状态。刷新 PWA 后所有 SSH 会话都会断开，且不会恢复任何标签/分栏。E2E 脚本每次运行时都应从「配对 → 新建连接」开始，不要依赖刷新后保留之前的状态。

### Vite HMR

多个 Vite 进程共存时（例如环境占 `8080`，`npm run dev` 落到 `8081`），HMR 可能给旧代码。改完 `telemetry.ts` 或 `ws.ts` 后，**刷新页面或重启 dev server**，再跑 E2E 才可信。

### xterm 渲染器

`@xterm/xterm` 6 默认使用 DOM renderer 时，终端屏幕是 `.xterm-screen`，不一定存在 canvas；终端右键测试应定位 `.xterm-screen`，应用侧允许屏幕后代元素触发菜单，以兼容 DOM 和 canvas renderer。

### Chromium 下载

当前 Playwright 1.62.0 解析到的 Chromium headless shell 版本可能尚未同步到 npmmirror；国内镜像返回 404 时，不要修改依赖版本或安全配置，去掉下载镜像环境变量后重试官方 Playwright 下载源。

### Docker 运行完整链路

Playwright Docker 镜像可能没有仓库的 Python 虚拟环境依赖。`run-e2e.js` 支持 `PHOTON_PYTHON` 覆盖解释器；容器内运行时需安装 `node/pyproject.toml` 依赖，并设置 `PYTHONPATH` 指向 `/workspace/node`。

### 文件卫生

- 用 `/tmp/photon-e2e/` 或类似目录放 `state.db` 和失败截图，不要提交。
- `package-lock.json`、`node_modules`、`.venv`、`shell/dist`、`shell/src/proto` 都已 gitignore。
- 测试脚本更新后，同步更新本 skill，不要留过期示例路径。

## 可用示例

- `run-e2e.js`：启动 mock SSH、启动 PhotonNode、用 Playwright 打开 PWA、配对、加主机、验证 PWA generic exec polling。
- `mock-ssh-server.py`：为能力探测、合并采样命令和 generic exec 返回固定数据的 `asyncssh` server。

用法（先在一个终端启动 PWA）：

```bash
cd shell
npm run dev
```

再在另一个终端：

```bash
cd .agents/skills/photon-e2e
PWA_URL=http://127.0.0.1:8081 node run-e2e.js
```

## 维护原则

- **自动记录**：每次发现新的环境、选择器、链路暗坑，更新本 `SKILL.md`。
- **重整冗余**：不要重复代码里能直接读到的实现细节；本 skill 只保留测试环境和经验。
- **去除过期**：端口策略、UI 选择器、命令输出格式、脚本路径发生变化时，立即删除或修正对应条目。
