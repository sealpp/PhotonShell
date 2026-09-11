"""Entry point for the SealNode transport service."""

from __future__ import annotations

import asyncio
import os
import sys

from seal.server import serve
from seal.trust import TrustRepository


def main() -> int:
    host = os.environ.get("SEAL_HOST", "127.0.0.1")
    port = int(os.environ.get("SEAL_PORT", "17373"))

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
