"""Entry point for the PhotonNode v0 server."""

import asyncio
import os
import sys
from pathlib import Path

from photon.server import serve
from photon.state import State


def main() -> int:
    host = os.environ.get("PHOTON_HOST", "127.0.0.1")
    port = int(os.environ.get("PHOTON_PORT", "17373"))
    allowed_origin = os.environ.get("PHOTON_ALLOWED_ORIGIN", "http://127.0.0.1:8080")

    if host in ("0.0.0.0", "::"):
        print(
            f"warning: {host} exposes the WebSocket to all interfaces; "
            "use only in a trusted LAN test environment",
            flush=True,
        )

    state_path = os.environ.get("PHOTON_STATE_PATH")
    if state_path:
        db = Path(state_path)
    else:
        db = Path(__file__).resolve().parent.parent / "data" / "state.db"

    state = State(db)

    password = os.environ.get("PHOTON_MASTER_PASSWORD")
    if password:
        try:
            state.unlock(password)
            print("State unlocked.", flush=True)
        except Exception as exc:
            print(f"error: failed to unlock state: {exc}", file=sys.stderr, flush=True)
            return 1
    else:
        print("warning: PHOTON_MASTER_PASSWORD not set; host data cannot be persisted", flush=True)

    try:
        asyncio.run(serve(state, host, port, allowed_origin))
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        state.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
