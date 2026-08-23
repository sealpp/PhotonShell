# Repository Memory

- `me_PhotonShell/` is a private, independently versioned repository.
- Keep its documentation, designs, diagrams, and related project files inside that directory.
- Use concise English Conventional Commits in the form `type(scope): summary`.
- Commit and push them separately from their respective repository roots.
- v0 does not persist tabs or layout; a page refresh is equivalent to a restart. Only the auth token and device id are kept in localStorage for auto-reconnect.

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
