# PhotonShell

<img src="shell/public/icon.svg" width="128" alt="PhotonShell Logo" />

Local-first PWA shell console. The PWA owns protocol clients, product logic, and product storage; PhotonNode is a localhost WebSocket-to-TCP/UDP transport and pairing helper.

## Layout

- `node/` — Python PhotonNode: loopback WebSocket, pairing/device trust, opaque TCP/UDP transport.
- `shell/` — Vue 3 + Vite PWA, IndexedDB vault, WASM SSH client, telemetry providers, and UI.
- `contracts/` — protobuf contract for pairing, device authentication, and multiplexed transport.
- `me_PhotonShell/` — private architecture and design documentation (separate repository).

## Quick start

### PhotonNode

```bash
cd node
uv venv
uv pip install -e ".[dev]"
uv run python -m photon.main
```

The Node prints a six-digit pairing code and listens on `127.0.0.1:17373`. On Windows, device trust is kept in the current user's Credential Manager. Non-Windows development uses an in-memory trust backend.

### PWA

In another shell:

```bash
cd shell
npm install
npm run gen:proto
npm run dev
```

Then open `http://127.0.0.1:8080`, enter the pairing code, and add a host. The PWA stores host profiles and encrypted credentials in the browser's IndexedDB. SSH protocol traffic is implemented by the PWA WASM client and transported through PhotonNode as opaque bytes.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PHOTON_HOST` | `127.0.0.1` | WebSocket listen host; only loopback addresses are accepted. |
| `PHOTON_PORT` | `17373` | WebSocket listen port. |
| `PHOTON_ALLOWED_ORIGIN` | `http://127.0.0.1:8080` | Exact browser Origin accepted by PhotonNode. |

## Protocol generation

After changing `contracts/photon.proto`:

```bash
cd node && uv run python scripts/generate_proto.py
cd shell && npm run gen:proto
```

Generated files are not committed (see `.gitignore`).

## Smoke test

Run the Node-side test for pairing, device challenge authentication, and opaque TCP/UDP transport:

```bash
cd node
.venv/bin/python scripts/generate_proto.py
.venv/bin/python scripts/smoke_test.py
```

## Notes

- PhotonNode binds loopback only and rejects non-loopback listen addresses.
- The WebSocket Origin allowlist is exact; it is not a substitute for device challenge authentication.
- SSH, RDP, X11, and other client protocol implementations belong in the PWA. Adding a protocol does not require a PhotonNode protocol update.
- PhotonNode does not expose local files, local processes, TCP listeners, SOCKS, or reverse-connection capabilities.
- The PWA vault uses AES-256-GCM records, a browser profile key for automatic unlock, and an Argon2id-WASM master-password wrapper.
- Tabs and layout are runtime state. Refreshing the PWA closes active transport streams; host profiles, credentials, and pairing identity remain in IndexedDB.
