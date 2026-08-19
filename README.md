# PhotonShell

Local-first SSH terminal console.

## Layout

- `node/` — Python PhotonNode: local WebSocket server, SSH bridge, encrypted state.
- `shell/` — Vue 3 + Vite PWA.

## Quick start

### Node

```bash
cd node
uv venv
uv pip install -e .
PHOTON_MASTER_PASSWORD=changeme uv run python -m photon.main
```

### PWA

```bash
cd shell
npm install
npm run gen:proto
npm run dev
```
