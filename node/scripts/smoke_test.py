"""End-to-end smoke test for v0 pairing -> host form -> SSH/terminal slice."""

import asyncio
import os
import re
import sys
import tempfile
import time
from pathlib import Path

import websockets

from photon.photon_pb2 import PhotonMessage


async def read_pin(process: asyncio.subprocess.Process) -> str:
    """Wait for the Node to print its pairing PIN."""
    assert process.stdout is not None
    deadline = time.time() + 10
    while time.time() < deadline:
        try:
            line = await asyncio.wait_for(process.stdout.readline(), timeout=0.5)
        except asyncio.TimeoutError:
            continue
        if not line:
            continue
        text = line.decode("utf-8", errors="replace").strip()
        print("node:", text)
        match = re.search(r"pairing code: (\d{6})", text)
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

        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-m",
            "photon.main",
            cwd=root / "node",
            env=env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        try:
            pin = await read_pin(process)
            print(f"got pin: {pin}")
            await asyncio.sleep(0.5)

            async with websockets.connect(
                "ws://127.0.0.1:17373",
                origin="http://127.0.0.1:8080",
            ) as ws:
                # Pair
                msg = PhotonMessage()
                msg.protocol_version = 0
                msg.request_id = "pair-1"
                msg.pair_begin.pin = pin
                msg.pair_begin.device_name = "smoke"
                msg.pair_begin.device_id = "smoke-device"
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

                # Optional SSH/terminal/exec slice
                ssh_password = os.environ.get("PHOTON_SMOKE_SSH_PASSWORD")
                if ssh_password:
                    await _test_ssh_terminal_exec(ws, token, ssh_password)

            print("smoke test passed")
            return 0
        finally:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
            except asyncio.TimeoutError:
                process.kill()


async def _test_ssh_terminal_exec(ws: websockets.WebSocketClientProtocol, token: str, password: str) -> None:
    """If an SSH target is configured, connect, open a PTY, and run exec commands."""
    host_id = "h1"
    session_id = "s-smoke-1"

    # Connect
    msg = PhotonMessage()
    msg.protocol_version = 0
    msg.request_id = "conn-1"
    msg.token = token
    msg.session_connect_request.host_id = host_id
    msg.session_connect_request.password = password
    msg.session_connect_request.session_id = session_id
    await ws.send(msg.SerializeToString())

    while True:
        resp = PhotonMessage()
        resp.ParseFromString(await ws.recv())
        body = resp.WhichOneof("body")
        if body == "session_state_event":
            print(f"session state: {resp.session_state_event.state} {resp.session_state_event.error}")
            assert resp.session_state_event.state in ("connecting", "online", "error"), resp
            if resp.session_state_event.state == "online":
                break
            if resp.session_state_event.state == "error":
                raise RuntimeError(f"session failed: {resp.session_state_event.error}")

    # Open terminal
    msg = PhotonMessage()
    msg.protocol_version = 0
    msg.request_id = "term-1"
    msg.token = token
    msg.terminal_open_request.session_id = session_id
    msg.terminal_open_request.terminal_id = "t1"
    pty = msg.terminal_open_request.pty
    pty.term = "xterm-256color"
    pty.columns = 80
    pty.rows = 24
    await ws.send(msg.SerializeToString())

    while True:
        resp = PhotonMessage()
        resp.ParseFromString(await ws.recv())
        body = resp.WhichOneof("body")
        print(f"terminal event: {body}")
        if body == "terminal_opened_event":
            stream_id = resp.terminal_opened_event.stream_id
            break
        if body == "request_failed":
            raise RuntimeError(f"terminal open failed: {resp.request_failed.error.message}")

    # Run an exec command
    msg = PhotonMessage()
    msg.protocol_version = 0
    msg.request_id = "exec-1"
    msg.token = token
    msg.exec_request.session_id = session_id
    msg.exec_request.command = "printf exec-ok"
    await ws.send(msg.SerializeToString())

    # Run a terminal command
    msg = PhotonMessage()
    msg.protocol_version = 0
    msg.request_id = "input-1"
    msg.token = token
    msg.terminal_input.stream_id = stream_id
    msg.terminal_input.payload = b"echo smoke-ok\n"
    await ws.send(msg.SerializeToString())

    got_output = False
    got_exec = False
    deadline = time.time() + 10
    while time.time() < deadline:
        resp = PhotonMessage()
        resp.ParseFromString(await asyncio.wait_for(ws.recv(), timeout=10))
        body = resp.WhichOneof("body")
        if body == "terminal_output":
            text = resp.terminal_output.payload.decode("utf-8", errors="replace")
            print(f"terminal output: {text!r}")
            if "smoke-ok" in text:
                got_output = True
        elif body == "exec_response":
            result = resp.exec_response
            assert result.session_id == session_id
            assert result.stdout == b"exec-ok"
            assert result.stderr == b""
            assert result.exit_code == 0
            got_exec = True
        if got_output and got_exec:
            break

    assert got_output, "did not receive terminal command output"
    assert got_exec, "did not receive exec response"
    print("ssh/terminal/exec ok")


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
