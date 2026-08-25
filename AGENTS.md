# Repository Memory

- `me_PhotonShell/` is a private, independently versioned repository.
- Keep its documentation, designs, diagrams, and related project files inside that directory.
- Use concise English Conventional Commits in the form `type(scope): summary`.
- Commit and push them separately from their respective repository roots.
- v0 does not persist tabs or layout; a page refresh closes active protocol streams. PWA product data, encrypted credentials, KnownHosts, and the device private key are kept in IndexedDB; Node keeps only its identity and paired device public keys in the OS trust store for automatic re-authentication.

## Design sync

- UI/UX design decisions and the design tracker live in `me_PhotonShell/`. Changes affecting design, behavior, interfaces, or usage must update the related documentation there; keep project documentation there rather than duplicating it in this repository.
- The tracker records intent, interaction conventions, and "not-in-code" boundaries; it does not duplicate implementation details retrievable from source.
- Public commits may reference private tracker IDs (e.g., `Refs: A02`) but must not include private design details.
- See `me_PhotonShell/AGENTS.md` and `me_PhotonShell/docs/v0-components.md` for the full sync convention.

## Development workflow

- For complex tasks, maintain a task tracker with decomposed subtasks and checkpoints; avoid overlong intermediate subtasks that cause context drift, loss of direction, or forgotten work.
- Split complex changes into logically scoped commits, making each as independently verifiable as practical.
- Prefer removing confirmed-redundant or obsolete code, tests, and content over blindly appending; avoid unnecessary defensive programming and redundant logic that cause bloat and decay.

## E2E & local dev

End-to-end testing guidance for PhotonShell is maintained as a project skill: `.agents/skills/photon-e2e/SKILL.md`.

Do not duplicate the detailed caveats here; update the skill directly. This section exists only to disclose the skill location.

## Known Pitfalls

### SSH / sshclient-wasm lifecycle

- `sshclient-wasm` does **not** start an interactive PTY/shell during `SSHClient.connect()`. The first `session.ssh.send()` triggers `RequestPty()` / `StartShell()` lazily. This applies to both interactive tabs and `exec-*` telemetry sessions.
- `resizeTerminal()` only resizes an existing PTY; it cannot create one, so it cannot be used to force shell startup.
- After editing `ssh.ts`, Vite HMR often fails to propagate changes into the running WASM/SSH module. Always do a **hard refresh (Ctrl+Shift+R)** and reconnect before interpreting new SSH behavior from browser logs.

### Exec command string escaping

- `waitForExecOutput()` builds a remote shell command inside a JavaScript template string. Watch out for JS-escape vs. shell-escape vs. `printf`-escape layers:
  - Use JS `\n` when the remote `printf` must see a literal `\n` escape (e.g. `printf '...\n'`).
  - Use JS `\r\n` (actual CRLF bytes) as the command terminator so the remote shell sees a line ending, not the literal text `\r\n`.
- A wrong terminator makes bash wait forever for a newline, causing `SSH exec timed out` and silently clearing telemetry.

### Vue reactivity with store tabs

- `store.tabs.push(tab)` stores the raw object. Mutating that raw object later (e.g. `tab.streamId = ...`) does not reliably trigger Vue watchers on `store.tabs`. Always get the reactive proxy via `store.tabs.find(...)` and mutate that (e.g. `reactiveTab.streamId = ...`).

### xterm / Dockview / ContextMenu mounting

- `ContextMenuTrigger as-child` from `reka-ui` can swallow or interfere with the slot element's `ref`. Keep the xterm mount node (`ref="termEl"`) inside the trigger slot but as a nested child, not the trigger element itself.
- `DockviewVue` does not auto-activate a panel when `addPanel()` is called; `api.setActive()` must be called explicitly when `store.activeTabId === tab.id`.

### Telemetry diagnostics

- `telemetry.ts` silently catches and swallows exec errors. When debugging telemetry, temporarily log the error in the `catch` block; otherwise the UI only shows "等待数据".
