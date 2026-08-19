"""WebSocket server for the v0 PhotonNode protocol."""

import asyncio
import secrets
import time
from typing import Optional

import websockets

from photon.photon_pb2 import (
    HostProfile,
    NodeHelloAck,
    PairSucceeded,
    PhotonMessage,
    RequestFailed,
    SessionConnectRequest,
    SessionDisconnectRequest,
    SessionStateEvent,
    TerminalCloseRequest,
    TerminalInput,
    TerminalOpenedEvent,
    TerminalOpenRequest,
    TerminalOutput,
    TerminalResizeRequest,
)
from photon.session import SessionManager
from photon.state import State, StateError

MAX_PIN_ATTEMPTS = 5
PIN_TTL_SECONDS = 120
NODE_VERSION = "0.1.0"
PROTOCOL_VERSION = 0


class PhotonServer:
    """Holds server-wide state: SQLite, PIN, origin check."""

    def __init__(self, state: State, allowed_origin: str):
        self.state = state
        self.allowed_origin = allowed_origin
        self.pin = f"{secrets.randbelow(1_000_000):06d}"
        self.pin_created_at = time.time()
        self.pin_attempts = 0
        self.sessions = SessionManager()
        self._websocket: Optional[websockets.WebSocketServerProtocol] = None

    def _pin_expired(self) -> bool:
        return time.time() - self.pin_created_at > PIN_TTL_SECONDS

    def _generate_token(self) -> str:
        return secrets.token_urlsafe(32)

    def _check_origin(self, websocket: websockets.WebSocketServerProtocol) -> bool:
        origin = websocket.request_headers.get("Origin", "")
        return origin == self.allowed_origin

    async def _send(self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage) -> None:
        await websocket.send(msg.SerializeToString())

    def _error(self, request_id: str, code: str, message: str) -> PhotonMessage:
        msg = PhotonMessage()
        msg.protocol_version = PROTOCOL_VERSION
        msg.request_id = request_id
        failed = RequestFailed()
        failed.request_id = request_id
        failed.error.code = code
        failed.error.message = message
        msg.request_failed.CopyFrom(failed)
        return msg

    async def _send_failed(
        self,
        websocket: websockets.WebSocketServerProtocol,
        request_id: str,
        code: str,
        message: str,
    ) -> None:
        await self._send(websocket, self._error(request_id, code, message))

    def _validate_token(self, token: str) -> bool:
        if not self.state.is_unlocked():
            return False
        tokens = self.state.get("tokens", [])
        return token in tokens

    async def handle(self, websocket: websockets.WebSocketServerProtocol, _path: str) -> None:
        if not self._check_origin(websocket):
            await websocket.close(1008, "invalid origin")
            return

        self._websocket = websocket
        try:
            async for raw in websocket:
                try:
                    msg = PhotonMessage()
                    msg.ParseFromString(raw)
                    await self.dispatch(websocket, msg)
                except StateError as exc:
                    await self._send_failed(websocket, msg.request_id, "state_error", str(exc))
                except Exception as exc:
                    await self._send_failed(websocket, msg.request_id, "internal", str(exc))
        finally:
            self._websocket = None
            try:
                await self.sessions.disconnect_all()
            except Exception:
                pass

    async def dispatch(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        body_name = msg.WhichOneof("body")

        if body_name == "pair_begin":
            await self._handle_pair_begin(websocket, msg)
        elif body_name == "node_hello":
            await self._handle_node_hello(websocket, msg)
        elif body_name == "host_list_request":
            await self._handle_host_list(websocket, msg)
        elif body_name == "host_create_request":
            await self._handle_host_create(websocket, msg)
        elif body_name == "session_connect_request":
            await self._handle_session_connect(websocket, msg)
        elif body_name == "session_disconnect_request":
            await self._handle_session_disconnect(websocket, msg)
        elif body_name == "terminal_open_request":
            await self._handle_terminal_open(websocket, msg)
        elif body_name == "terminal_input":
            await self._handle_terminal_input(websocket, msg)
        elif body_name == "terminal_resize_request":
            await self._handle_terminal_resize(websocket, msg)
        elif body_name == "terminal_close_request":
            await self._handle_terminal_close(websocket, msg)
        elif body_name == "telemetry_start_request":
            await self._send_failed(websocket, msg.request_id, "not_implemented", "telemetry is not implemented in this slice")
        elif body_name == "telemetry_stop_request":
            await self._send_failed(websocket, msg.request_id, "not_implemented", "telemetry is not implemented in this slice")
        else:
            await self._send_failed(
                websocket,
                msg.request_id,
                "unsupported",
                f"message type {body_name!r} is not supported in this slice",
            )

    async def _handle_pair_begin(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if self._pin_expired():
            await self._send_failed(websocket, msg.request_id, "expired_pin", "pairing code has expired")
            return

        pin = msg.pair_begin.pin
        if pin != self.pin:
            self.pin_attempts += 1
            if self.pin_attempts >= MAX_PIN_ATTEMPTS:
                await self._send_failed(websocket, msg.request_id, "too_many_attempts", "too many failed pairing attempts")
                await websocket.close(1008, "too many failed pairing attempts")
                return
            await self._send_failed(websocket, msg.request_id, "invalid_pin", "pairing code is incorrect")
            return

        if not self.state.is_unlocked():
            await self._send_failed(websocket, msg.request_id, "needs_unlock", "node is locked; set PHOTON_MASTER_PASSWORD")
            return

        token = self._generate_token()
        tokens = self.state.get("tokens", [])
        tokens.append(token)
        self.state.set("tokens", tokens)

        resp = PhotonMessage()
        resp.protocol_version = PROTOCOL_VERSION
        resp.request_id = msg.request_id
        resp.pair_succeeded.token = token
        await self._send(websocket, resp)

    async def _handle_node_hello(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        resp = PhotonMessage()
        resp.protocol_version = PROTOCOL_VERSION
        resp.request_id = msg.request_id
        resp.token = msg.token
        resp.node_hello_ack.node_version = NODE_VERSION
        resp.node_hello_ack.protocol_version = PROTOCOL_VERSION
        await self._send(websocket, resp)

    async def _handle_host_list(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        hosts = self.state.get("hosts", [])
        resp = PhotonMessage()
        resp.protocol_version = PROTOCOL_VERSION
        resp.request_id = msg.request_id
        resp.token = msg.token

        for h in hosts:
            hp = resp.host_list_response.hosts.add()
            hp.id = h.get("id", "")
            hp.address = h.get("address", "")
            hp.port = h.get("port", 22)
            hp.username = h.get("username", "")

        await self._send(websocket, resp)

    async def _handle_host_create(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        src = msg.host_create_request.host
        if not src.id:
            src.id = secrets.token_urlsafe(8)

        hosts = self.state.get("hosts", [])
        hosts.append(
            {
                "id": src.id,
                "address": src.address,
                "port": src.port,
                "username": src.username,
            }
        )
        self.state.set("hosts", hosts)

        resp = PhotonMessage()
        resp.protocol_version = PROTOCOL_VERSION
        resp.request_id = msg.request_id
        resp.token = msg.token

        for h in hosts:
            hp = resp.host_list_response.hosts.add()
            hp.id = h.get("id", "")
            hp.address = h.get("address", "")
            hp.port = h.get("port", 22)
            hp.username = h.get("username", "")

        await self._send(websocket, resp)

    async def _send_client(self, msg: PhotonMessage) -> None:
        if self._websocket:
            await self._send(self._websocket, msg)

    async def _on_session_state(self, host_id: str, state: str, error: Optional[str]) -> None:
        msg = PhotonMessage()
        msg.protocol_version = PROTOCOL_VERSION
        msg.session_state_event.host_id = host_id
        msg.session_state_event.state = state
        msg.session_state_event.error = error or ""
        await self._send_client(msg)

    async def _on_terminal_output(self, host_id: str, stream_id: int, payload: bytes) -> None:
        msg = PhotonMessage()
        msg.protocol_version = PROTOCOL_VERSION
        msg.terminal_output.stream_id = stream_id
        msg.terminal_output.payload = payload
        await self._send_client(msg)

    async def _handle_session_connect(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        req = msg.session_connect_request
        hosts = self.state.get("hosts", [])
        host = next((h for h in hosts if h.get("id") == req.host_id), None)
        if not host:
            await self._send_failed(websocket, msg.request_id, "host_not_found", f"host {req.host_id!r} not found")
            return

        try:
            await self.sessions.connect(
                req.host_id,
                host,
                req.password,
                self._on_terminal_output,
                self._on_session_state,
            )
        except Exception as exc:
            await self._send_failed(websocket, msg.request_id, "connection_failed", str(exc))

    async def _handle_session_disconnect(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        await self.sessions.disconnect(msg.session_disconnect_request.host_id, msg.session_disconnect_request.reason)

    async def _handle_terminal_open(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        req = msg.terminal_open_request
        session = self.sessions.get(req.host_id)
        if not session:
            await self._send_failed(websocket, msg.request_id, "session_not_found", f"no active session for {req.host_id!r}")
            return

        pty = req.pty
        try:
            stream_id = await session.open_terminal(
                req.terminal_id,
                pty.term or "xterm-256color",
                pty.columns or 80,
                pty.rows or 24,
            )
            resp = PhotonMessage()
            resp.protocol_version = PROTOCOL_VERSION
            resp.request_id = msg.request_id
            resp.token = msg.token
            resp.terminal_opened_event.terminal_id = req.terminal_id
            resp.terminal_opened_event.session_id = session.session_id
            resp.terminal_opened_event.stream_id = stream_id
            await self._send(websocket, resp)
        except Exception as exc:
            await self._send_failed(websocket, msg.request_id, "terminal_open_failed", str(exc))

    async def _handle_terminal_input(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        await self.sessions.write_input(
            msg.terminal_input.stream_id,
            msg.terminal_input.payload,
        )

    async def _handle_terminal_resize(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        req = msg.terminal_resize_request
        session = self.sessions.get(req.host_id)
        if session:
            pty = req.pty
            await session.resize_terminal(req.terminal_id, pty.columns, pty.rows)

    async def _handle_terminal_close(
        self, websocket: websockets.WebSocketServerProtocol, msg: PhotonMessage
    ) -> None:
        if not self._validate_token(msg.token):
            await self._send_failed(websocket, msg.request_id, "invalid_token", "token is invalid or expired")
            return

        session = self.sessions.get(msg.terminal_close_request.host_id)
        if session:
            await session.close_terminal(msg.terminal_close_request.terminal_id)


async def serve(
    state: State,
    host: str,
    port: int,
    allowed_origin: str,
) -> None:
    """Start the WebSocket server and print the pairing PIN."""
    server = PhotonServer(state, allowed_origin)
    print(f"Listening on ws://{host}:{port}, pairing code: {server.pin}", flush=True)
    async with websockets.serve(server.handle, host, port):
        await asyncio.Future()
