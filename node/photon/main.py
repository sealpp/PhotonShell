"""Entry point for the PhotonNode transport service."""

from __future__ import annotations

import asyncio
import os
import sys

from photon.server import serve
from photon.trust import TrustRepository


def main() -> int:
    host = os.environ.get("PHOTON_HOST", "127.0.0.1")
    port = int(os.environ.get("PHOTON_PORT", "17373"))

    try:
        trust = TrustRepository()
        asyncio.run(serve(trust, host, port))
    except KeyboardInterrupt:
        print("\nShutting down...", flush=True)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr, flush=True)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
