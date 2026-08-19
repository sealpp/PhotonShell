#!/usr/bin/env python3
"""End-to-end smoke test for the v0 pairing -> host form slice."""

import asyncio
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import websockets

from photon.photon_pb2 import (
    HostCreateRequest,
    HostListRequest,
    HostProfile,
    NodeHello,
    PairBegin,
    PhotonMessage,
)


async def read_pin(process: subprocess.Popen) -> str:
    """Wait for the Node to print its pairing PIN."""
    deadline = time.time() + 10
    while time.time() < deadline:
        line = process.stdout.readline()
        if not line:
            await asyncio.sleep(0.1)
            continue
        line = line.strip()
        print("node:", line)
        match = re.search(r"pairing code: (\d{6})", line)
        if match:
            return match.group(1)
    raise RuntimeError("Node did not print a pairing PIN in time")


async def run() -> int:
    root = Path(__file__).resolve().parents[2]
    with tempfile.TemporaryDirectory() as tmpdir:
        state_path = Path(tmpdir) / "state.db"
        env = os.environ.copy()
        env["PHOTON_MASTER_PASSWORD"] = "smoke"
        env["PHOTON_STATE_PATH"] = str(state_path)
        env["PHOTON_ALLOWED_ORIGIN"] = "http://127.0.0.1:8080"

        process = subprocess.Popen(
            [sys.executable, "-m", "photon.main"],
            cwd=root / "node",
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        try:
            pin = await read_pin(process)
            print(f"got pin: {pin}")

            async with websockets.connect(
                "ws://127.0.0.1:17373",
                extra_headers={"Origin": "http://127.0.0.1:8080"},
            ) as ws:
                # Pair
                msg = PhotonMessage()
                msg.protocol_version = 0
                msg.request_id = "pair-1"
                msg.pair_begin.pin = pin
                msg.pair_begin.device_name = "smoke"
                await ws.send(msg.SerializeToString())

                resp = PhotonMessage()
                resp.ParseFromString(await ws.recv())
                assert resp.WhichOneof("body") == "pair_succeeded", resp
                token = resp.pair_succeeded.token
                print(f"got token: {token}")

                # Hello
                msg = PhotonMessage()
                msg.protocol_version = 0
                msg.request_id = "hello-1"
                msg.token = token
                msg.node_hello.pwa_version = "0.1.0"
                await ws.send(msg.SerializeToString())

                resp = PhotonMessage()
                resp.ParseFromString(await ws.recv())
                assert resp.WhichOneof("body") == "node_hello_ack", resp
                print("hello ack ok")

                # Create host
                msg = PhotonMessage()
                msg.protocol_version = 0
                msg.request_id = "create-1"
                msg.token = token
                h = msg.host_create_request.host
                h.id = "h1"
                h.address = "127.0.0.1"
                h.port = 22
                h.username = "root"
                await ws.send(msg.SerializeToString())

                resp = PhotonMessage()
                resp.ParseFromString(await ws.recv())
                assert resp.WhichOneof("body") == "host_list_response", resp
                assert len(resp.host_list_response.hosts) == 1
                print("create host ok")

                # List hosts
                msg = PhotonMessage()
                msg.protocol_version = 0
                msg.request_id = "list-1"
                msg.token = token
                msg.host_list_request.SetInParent()
                await ws.send(msg.SerializeToString())

                resp = PhotonMessage()
                resp.ParseFromString(await ws.recv())
                assert resp.WhichOneof("body") == "host_list_response", resp
                assert len(resp.host_list_response.hosts) == 1
                h = resp.host_list_response.hosts[0]
                assert h.address == "127.0.0.1"
                assert h.username == "root"
                print("list hosts ok")

            print("smoke test passed")
            return 0
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
