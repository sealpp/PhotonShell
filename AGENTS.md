# Repository Memory

- `me_PhotonShell/` is a private, independently versioned repository.
- Keep its documentation, designs, diagrams, and related project files inside that directory.
- Use concise English Conventional Commits in the form `type(scope): summary`.
- Commit and push them separately from their respective repository roots.

## Design sync

- UI/UX design decisions and the design tracker live in `me_PhotonShell/`.
- The tracker records intent, interaction conventions, and "not-in-code" boundaries; it does not duplicate implementation details retrievable from source.
- Public commits may reference private tracker IDs (e.g., `Refs: A02`) but must not include private design details.
- See `me_PhotonShell/AGENTS.md` and `me_PhotonShell/docs/v0-components.md` for the full sync convention.

## E2E & local dev caveats

Lessons from running Playwright against the full PWA + PhotonNode + mock SSH stack. Update this section when the local environment or UI changes; remove stale entries and avoid duplicating info that is obvious from the source.

- **Port 8080 may already be in use by the IDE/dev environment**. `npm run dev` falls back to the next port (e.g. `8081`). E2E scripts must read the actual PWA port and set `PHOTON_ALLOWED_ORIGIN` to match; do not assume the default `http://127.0.0.1:8080`.
- **Node WebSocket port 17373 is hardcoded in the PWA**. `shell/src/services/ws.ts` always returns `ws://${window.location.hostname}:17373`. A local test must start PhotonNode on `17373`; using another port will silently fail.
- **Pairing PIN is dynamic and printed to Node stdout**. Parse the 6-digit code from `Listening on ws://..., pairing code: XXXXXX`; do not hard-code a PIN.
- **Playwright selectors for ambiguous labels**: `配对`, `登录`, and `新建连接` appear in both the sidebar and modals. Use scoped selectors (`.modal .btn-primary`, `.new-btn`, `input[type="password"]`) instead of `getByText`/`getByRole` with those labels alone.
- **Telemetry needs a mock SSH server**. To exercise the full monitoring lifecycle without a real network host, start an in-process SSH server (e.g. `asyncssh`) that responds to `cat /proc/stat`, `free -b`, `df -P -k /`, and `ps -eo pid`.
- **Vite HMR can serve stale code if multiple Vite processes are running** (e.g. the IDE server on `8080` and `npm run dev` on `8081`). After editing `ShellTerminal.vue` or other lifecycle code, refresh the page or restart the dev server before declaring the E2E result valid.
- **E2E artifact hygiene**: Temporary state files, generated protobuf, and `package-lock.json` are gitignored. Any committed E2E harness should live under `e2e/` with its own manifest to avoid polluting `shell/package.json` or `node`. Remove stale temp scripts and update selectors when the UI changes.
- **Design-tracker sync**: UI/UX changes that affect telemetry or tab lifecycle (e.g. making the right panel update without a tab switch) should be reflected in `me_PhotonShell/docs/v0-components.md`. Also reconcile `v0-ugly.md` if it contains stale v0-scope statements.
