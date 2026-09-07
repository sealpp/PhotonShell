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

### Dev server cleanup

After finishing local testing or browser validation, kill the PWA Vite dev server (`npm run dev`, usually on `127.0.0.1:8080`) and the PhotonNode Python process (`./.venv/bin/python -m photon.main`, usually on `127.0.0.1:17373`) unless the user explicitly asks to keep them running. This avoids keeping ports 8080/17373 occupied when the user wants to start their own manual tests.

## Known Pitfalls

### SSH / libssh2 Worker lifecycle

- Each terminal, file, editor, and direct-exec task owns a libssh2 Worker and PhotonNode WebSocket. The main NodeClient is only the pairing/control connection.
- libssh2 PTY setup is explicit in the Worker (`request_pty`, `request_pty_size`, `shell`); resize only applies after the shell channel is open.
- After editing Worker/runtime code, Vite HMR may leave an old WASM module alive. Restart the dev server or do a **hard refresh (Ctrl+Shift+R)** before interpreting SSH logs.

### Direct exec boundary

- Telemetry uses libssh2 `channel_exec` in an independent Worker session. Do not reintroduce shell markers, `stty`, or command-terminator parsing.

### Vue reactivity with store tabs

- `store.tabs.push(tab)` stores the raw object. Mutating that raw object later does not reliably trigger Vue watchers on `store.tabs`. Always get the reactive proxy via `store.tabs.find(...)` and mutate that.

### xterm / Dockview / ContextMenu mounting

- `ContextMenuTrigger as-child` from `reka-ui` can swallow or interfere with the slot element's `ref`. Keep the xterm mount node (`ref="termEl"`) inside the trigger slot but as a nested child, not the trigger element itself.
- `DockviewVue` does not auto-activate a panel when `addPanel()` is called; `api.setActive()` must be called explicitly when `store.activeTabId === tab.id`.

### Telemetry diagnostics

- `telemetry.ts` silently catches and swallows exec errors. When debugging telemetry, temporarily log the error in the `catch` block; otherwise the UI only shows "等待数据".
