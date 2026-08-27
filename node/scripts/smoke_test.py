"""End-to-end smoke test for pairing and opaque TCP/UDP transport."""

from __future__ import annotations

import asyncio
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import websockets
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

from photon.photon_pb2 import PhotonMessage
from photon.trust import MemoryTrustBackend, TrustRepository, load_p256_public_key

PROTOCOL_VERSION = 1


def transcript(label: str, *fields: str | bytes) -> bytes:
    encoded = bytearray()
    for field in (label, *fields):
        value = field.encode("utf-8") if isinstance(field, str) else field
        encoded.extend(len(value).to_bytes(4, "big"))
        encoded.extend(value)
    return bytes(encoded)


def raw_signature(private_key: ec.EllipticCurvePrivateKey, payload: bytes) -> bytes:
    r, s = decode_dss_signature(private_key.sign(payload, ec.ECDSA(hashes.SHA256())))
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def verify_raw(public_key: bytes, payload: bytes, signature: bytes) -> None:
    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    load_p256_public_key(public_key).verify(
        encode_dss_signature(r, s),
        payload,
        ec.ECDSA(hashes.SHA256()),
    )


class UdpEcho(asyncio.DatagramProtocol):
    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport

    def datagram_received(self, data: bytes, address: Any) -> None:
        self.transport.sendto(data, address)


async def read_pin(process: asyncio.subprocess.Process) -> str:
    assert process.stdout is not None
    deadline = time.time() + 10
    while time.time() < deadline:
        line = await asyncio.wait_for(process.stdout.readline(), timeout=1)
        text = line.decode("utf-8", errors="replace")
        match = re.search(r"pairing code: (\d{6})", text)
        if match:
            return match.group(1)
    raise RuntimeError("Node did not print a pairing code")


async def recv_message(ws: websockets.WebSocketClientProtocol) -> PhotonMessage:
    raw = await ws.recv()
    if not isinstance(raw, bytes):
        raise RuntimeError("Node returned a text frame")
    message = PhotonMessage()
    message.ParseFromString(raw)
    return message


async def pair(
    ws: websockets.WebSocketClientProtocol,
    pin: str,
    private_key: ec.EllipticCurvePrivateKey,
    device_id: str,
) -> tuple[str, bytes]:
    public_key = private_key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    client_nonce = os.urandom(32)
    begin = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="pair-begin")
    begin.pair_begin.pairing_code = pin
    begin.pair_begin.device_id = device_id
    begin.pair_begin.device_name = "smoke"
    begin.pair_begin.device_public_key = public_key
    begin.pair_begin.client_nonce = client_nonce
    await ws.send(begin.SerializeToString())

    challenge = await recv_message(ws)
    assert challenge.WhichOneof("body") == "pair_challenge", challenge
    pair_id = challenge.pair_challenge.pairing_id
    node_id = challenge.pair_challenge.node_id
    node_public_key = bytes(challenge.pair_challenge.node_public_key)
    signed = transcript(
        "PHOTON-PAIR-1",
        str(PROTOCOL_VERSION),
        pair_id,
        device_id,
        "smoke",
        public_key,
        node_id,
        node_public_key,
        client_nonce,
        bytes(challenge.pair_challenge.node_nonce),
    )
    proof = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="pair-proof")
    proof.pair_proof.pairing_id = pair_id
    proof.pair_proof.device_signature = raw_signature(private_key, signed)
    await ws.send(proof.SerializeToString())

    result = await recv_message(ws)
    assert result.WhichOneof("body") == "pair_succeeded", result
    assert result.pair_succeeded.device_id == device_id
    assert bytes(result.pair_succeeded.node_public_key) == node_public_key
    return node_id, node_public_key


async def authenticate(
    ws: websockets.WebSocketClientProtocol,
    private_key: ec.EllipticCurvePrivateKey,
    device_id: str,
    node_id: str,
    node_public_key: bytes,
) -> None:
    connection_id = "connection-2"
    client_nonce = os.urandom(32)
    begin = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="auth-begin")
    begin.auth_begin.device_id = device_id
    begin.auth_begin.connection_id = connection_id
    begin.auth_begin.client_nonce = client_nonce
    await ws.send(begin.SerializeToString())

    challenge = await recv_message(ws)
    assert challenge.WhichOneof("body") == "auth_challenge", challenge
    assert challenge.auth_challenge.node_id == node_id
    assert bytes(challenge.auth_challenge.node_public_key) == node_public_key
    signed = transcript(
        "PHOTON-AUTH-1",
        str(PROTOCOL_VERSION),
        connection_id,
        device_id,
        node_id,
        client_nonce,
        bytes(challenge.auth_challenge.node_nonce),
    )
    verify_raw(node_public_key, signed, bytes(challenge.auth_challenge.node_signature))
    proof = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="auth-proof")
    proof.auth_proof.connection_id = connection_id
    proof.auth_proof.device_signature = raw_signature(private_key, signed)
    await ws.send(proof.SerializeToString())

    result = await recv_message(ws)
    assert result.WhichOneof("body") == "auth_succeeded", result


async def round_trip(
    ws: websockets.WebSocketClientProtocol,
    transport: str,
    port: int,
    payload: bytes,
) -> None:
    stream_id = 100 if transport == "tcp" else 200
    request = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id=f"open-{transport}")
    request.transport_open_request.stream_id = stream_id
    request.transport_open_request.transport = transport
    request.transport_open_request.host = "127.0.0.1"
    request.transport_open_request.port = port
    await ws.send(request.SerializeToString())
    opened = await recv_message(ws)
    assert opened.WhichOneof("body") == "transport_opened_event", opened
    assert opened.transport_opened_event.stream_id == stream_id

    data = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="")
    data.transport_data.stream_id = stream_id
    data.transport_data.sequence = 0
    data.transport_data.payload = payload
    await ws.send(data.SerializeToString())

    got_data = False
    got_credit = False
    while not (got_data and got_credit):
        response = await recv_message(ws)
        if response.WhichOneof("body") == "transport_data":
            assert response.transport_data.stream_id == stream_id
            assert bytes(response.transport_data.payload) == payload
            got_data = True
        elif response.WhichOneof("body") == "transport_credit":
            assert response.transport_credit.stream_id == stream_id
            assert response.transport_credit.direction == "input"
            got_credit = True

    close = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id=f"close-{transport}")
    close.transport_close_request.stream_id = stream_id
    close.transport_close_request.reason = "smoke"
    await ws.send(close.SerializeToString())
    while True:
        closed = await recv_message(ws)
        if closed.WhichOneof("body") == "transport_closed_event" and closed.transport_closed_event.stream_id == stream_id:
            break


async def run() -> int:
    root = Path(__file__).resolve().parents[2]
    trust_backend = MemoryTrustBackend()
    first_trust = TrustRepository(trust_backend)
    trust_key = ec.generate_private_key(ec.SECP256R1())
    trust_public = trust_key.public_key().public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    first_trust.upsert_device('trust-device', 'trust', trust_public, time.time())
    second_trust = TrustRepository(trust_backend)
    assert second_trust.node_id == first_trust.node_id
    assert second_trust.get_device('trust-device') is not None

    tcp_server = await asyncio.start_server(lambda reader, writer: echo_tcp(reader, writer), "127.0.0.1", 0)
    tcp_port = tcp_server.sockets[0].getsockname()[1]
    loop = asyncio.get_running_loop()
    udp_transport, _ = await loop.create_datagram_endpoint(
        UdpEcho,
        local_addr=("127.0.0.1", 0),
    )
    udp_port = udp_transport.get_extra_info("sockname")[1]
    node_port = os.environ.get("PHOTON_TEST_NODE_PORT", "17374")
    env = os.environ.copy()
    env["PHOTON_PORT"] = node_port
    env["PYTHONPATH"] = str(root / "node")
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
        async with websockets.connect(
            f"ws://127.0.0.1:{node_port}",
        ) as unauthenticated:
            request = PhotonMessage(protocol_version=PROTOCOL_VERSION, request_id="unauthenticated")
            request.transport_open_request.stream_id = 1
            request.transport_open_request.transport = "tcp"
            request.transport_open_request.host = "127.0.0.1"
            request.transport_open_request.port = tcp_port
            await unauthenticated.send(request.SerializeToString())
            response = await recv_message(unauthenticated)
            assert response.WhichOneof("body") == "transport_error_event", response
            assert response.transport_error_event.code == "not_authenticated", response

        key = ec.generate_private_key(ec.SECP256R1())
        async with websockets.connect(
            f"ws://127.0.0.1:{node_port}",
        ) as ws:
            node_id, node_key = await pair(ws, pin, key, "smoke-device")
            await round_trip(ws, "tcp", tcp_port, b"tcp-ok")
            await round_trip(ws, "udp", udp_port, b"udp-ok")

        async with websockets.connect(
            f"ws://127.0.0.1:{node_port}",
        ) as ws:
            await authenticate(ws, key, "smoke-device", node_id, node_key)
        print("transport smoke test passed")
        return 0
    finally:
        tcp_server.close()
        await tcp_server.wait_closed()
        udp_transport.close()
        if process.returncode is None:
            process.terminate()
        await process.wait()


async def echo_tcp(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    try:
        while data := await reader.read(65536):
            writer.write(data)
            await writer.drain()
    finally:
        writer.close()
        await writer.wait_closed()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run()))
