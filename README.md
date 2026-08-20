# PhotonShell

<img src="shell/public/icon.svg" width="128" alt="PhotonShell Logo" />

Local-first SSH terminal console. This is the v0 PoC workspace.

## Layout

- `node/` — Python PhotonNode: local WebSocket server, SSH bridge, encrypted SQLite state.
- `shell/` — Vue 3 + Vite PWA.
- `me_PhotonShell/` — private documentation and protocol definitions (separate repo).

## Quick start

### Node

```bash
cd node
uv venv
uv pip install -e .
PHOTON_MASTER_PASSWORD=changeme uv run python -m photon.main
```

The terminal prints a 6-digit pairing code and the WebSocket address.

### PWA

In another shell:

```bash
cd shell
npm install
npm run gen:proto
npm run dev
```

Then open `http://127.0.0.1:8080`, enter the pairing code, and add a host.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PHOTON_MASTER_PASSWORD` | — | Master password used to derive the AES-256-GCM key for SQLite state. |
| `PHOTON_STATE_PATH` | `node/data/state.db` | Encrypted SQLite state file. |
| `PHOTON_HOST` | `127.0.0.1` | WebSocket listen host. Set `0.0.0.0` only for trusted LAN tests. |
| `PHOTON_PORT` | `17373` | WebSocket listen port. |
| `PHOTON_ALLOWED_ORIGIN` | `http://127.0.0.1:8080` | Allowed `Origin` header. |

## Protocol generation

After changing `me_PhotonShell/contracts/photon.proto`:

```bash
cd node && uv run python scripts/generate_proto.py
cd shell && npm run gen:proto
```

Generated files are not committed (see `.gitignore`).

## Smoke test

Run the Node-side end-to-end test that pairs, handshakes, and creates/lists a host:

```bash
cd node
.venv/bin/python scripts/smoke_test.py
```

The test uses a temporary state file and a temporary Node process.

## Notes

- Node defaults to `127.0.0.1`. Use `PHOTON_HOST=0.0.0.0` only in trusted LAN tests; a warning is printed.
- The PWA dev server defaults to `127.0.0.1:8080` to match Node's default allowed origin.
- SSH passwords are only used for the live session and are never persisted in SQLite state.
- For slow networks, use a mainland China mirror for `npm` and `uv` (already configured in `~/.npmrc` and `~/.config/uv/uv.toml`).
