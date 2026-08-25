#!/usr/bin/env python3
"""Generate Python protobuf bindings for the PhotonShell transport contract."""

import sys
from pathlib import Path

from grpc_tools import protoc


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    proto_path = root / "contracts"
    proto_file = "photon.proto"
    out_dir = root / "node" / "photon"
    out_dir.mkdir(parents=True, exist_ok=True)

    if not (proto_path / proto_file).exists():
        print(f"Proto file not found: {proto_path / proto_file}", file=sys.stderr)
        return 1

    args = [
        "protoc",
        f"--proto_path={proto_path}",
        f"--python_out={out_dir}",
        proto_file,
    ]
    return protoc.main(args)


if __name__ == "__main__":
    raise SystemExit(main())
