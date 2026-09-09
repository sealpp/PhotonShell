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
- Complex tasks must use atomic commits organized by one user-visible behavior or one architecture layer. Each commit should be independently buildable, testable, and revertible where practical; do not mix design, state/model, UI, interaction, and test changes without a direct dependency.
- Before committing, inspect the staged diff and keep unrelated changes out of the commit. Push each repository from its own root after its commits are verified.
- Prefer removing confirmed-redundant or obsolete code, tests, and content over blindly appending; avoid unnecessary defensive programming and redundant logic that cause bloat and decay.

## E2E & local dev

End-to-end testing guidance for PhotonShell is maintained as a project skill: `.agents/skills/photon-e2e/SKILL.md`.

Do not duplicate the detailed caveats here; update the skill directly. This section exists only to disclose the skill location.

### Dev server cleanup

After finishing local testing or browser validation, kill the PWA Vite dev server (`npm run dev`, usually on `127.0.0.1:8080`) and the PhotonNode Python process (`./.venv/bin/python -m photon.main`, usually on `127.0.0.1:17373`) unless the user explicitly asks to keep them running. This avoids keeping ports 8080/17373 occupied when the user wants to start their own manual tests.

## Known Pitfalls Index

长期有效的实现踩坑、根因和修复规则集中维护在私有文档：
`me_PhotonShell/docs/engineering/pitfalls.md`。

修复可复用问题后先合并、删减或改写该文档，再提交代码；不要在本文件复制正文或追加一次性 workaround。
