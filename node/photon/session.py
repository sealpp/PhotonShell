"""SSH session and PTY management for PhotonNode."""

import asyncio
from dataclasses import dataclass
from typing import Any, Callable, Coroutine, Dict, Optional

import asyncssh


@dataclass
class Terminal:
    terminal_id: str
    stream_id: int
    process: asyncssh.SSHClientProcess
    columns: int
    rows: int
    read_task: Optional[asyncio.Task] = None


class Session:
    """One SSH session with zero or more terminal channels."""

    def __init__(
        self,
        session_id: str,
        host_id: str,
        host: Dict[str, Any],
        password: str,
        on_output: Callable[[str, int, bytes], Coroutine],
        on_state: Callable[[str, str, Optional[str]], Coroutine],
    ):
        self.session_id = session_id
        self.host_id = host_id
        self.host = host
        self.password = password
        self.on_output = on_output
        self.on_state = on_state
        self.connection: Optional[asyncssh.SSHClientConnection] = None
        self._terminals: Dict[str, Terminal] = {}
        self._stream_to_terminal: Dict[int, str] = {}
        self._next_stream_id = 1
        self.state = "idle"
        self.error: Optional[str] = None

    async def _emit_state(self) -> None:
        await self.on_state(self.host_id, self.state, self.error)

    async def connect(self) -> None:
        self.state = "connecting"
        self.error = None
        await self._emit_state()
        try:
            self.connection = await asyncssh.connect(
                self.host["address"],
                self.host["port"],
                username=self.host["username"],
                password=self.password,
                known_hosts=None,
            )
            self.state = "online"
            await self._emit_state()
        except Exception as exc:
            self.state = "error"
            self.error = str(exc)
            await self._emit_state()
            raise

    async def open_terminal(
        self,
        terminal_id: str,
        term: str,
        columns: int,
        rows: int,
    ) -> int:
        if self.connection is None:
            raise RuntimeError("session not connected")
        if terminal_id in self._terminals:
            raise RuntimeError("terminal already exists")

        process = await self.connection.create_process(
            term_type=term,
            term_size=(columns, rows),
        )

        stream_id = self._next_stream_id
        self._next_stream_id += 1

        terminal = Terminal(
            terminal_id=terminal_id,
            stream_id=stream_id,
            process=process,
            columns=columns,
            rows=rows,
        )
        self._terminals[terminal_id] = terminal
        self._stream_to_terminal[stream_id] = terminal_id
        terminal.read_task = asyncio.create_task(self._read_output(stream_id, terminal))
        return stream_id

    async def _read_output(self, stream_id: int, terminal: Terminal) -> None:
        try:
            while True:
                data = await terminal.process.stdout.read(1024)
                if not data:
                    break
                if isinstance(data, str):
                    payload = data.encode("utf-8", errors="replace")
                else:
                    payload = data
                await self.on_output(self.host_id, stream_id, payload)
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        except asyncio.CancelledError:
            raise
        except Exception:
            pass
        finally:
            if stream_id in self._stream_to_terminal:
                # terminal closed by remote side; ensure cleanup
                await self._close_terminal(terminal.terminal_id)

    def _get_terminal(self, terminal_id: str) -> Optional[Terminal]:
        return self._terminals.get(terminal_id)

    def _get_terminal_by_stream(self, stream_id: int) -> Optional[Terminal]:
        terminal_id = self._stream_to_terminal.get(stream_id)
        if terminal_id:
            return self._terminals.get(terminal_id)
        return None

    async def write_input(self, stream_id: int, payload: bytes) -> None:
        terminal = self._get_terminal_by_stream(stream_id)
        if terminal:
            try:
                text = payload.decode("utf-8", errors="replace")
            except Exception:
                text = payload.decode("latin-1", errors="replace")
            terminal.process.stdin.write(text)
            await terminal.process.stdin.drain()

    async def resize_terminal(self, terminal_id: str, columns: int, rows: int) -> None:
        terminal = self._get_terminal(terminal_id)
        if terminal:
            terminal.process.change_terminal_size(columns, rows)
            terminal.columns = columns
            terminal.rows = rows

    async def close_terminal(self, terminal_id: str) -> None:
        await self._close_terminal(terminal_id)

    async def _close_terminal(self, terminal_id: str) -> None:
        terminal = self._terminals.pop(terminal_id, None)
        if terminal is None:
            return
        self._stream_to_terminal.pop(terminal.stream_id, None)

        if terminal.read_task:
            terminal.read_task.cancel()
            try:
                await terminal.read_task
            except asyncio.CancelledError:
                pass

        terminal.process.close()

    async def disconnect(self, reason: str = "") -> None:
        for terminal_id in list(self._terminals.keys()):
            await self._close_terminal(terminal_id)
        if self.connection:
            self.connection.close()
            try:
                await self.connection.wait_closed()
            except Exception:
                pass
            self.connection = None
        if self.state != "idle":
            self.state = "idle"
            self.error = None
            await self._emit_state()


class SessionManager:
    """Keeps one Session per host_id."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Session] = {}
        self._next_session_id = 1

    def get(self, host_id: str) -> Optional[Session]:
        return self._sessions.get(host_id)

    async def connect(
        self,
        host_id: str,
        host: Dict[str, Any],
        password: str,
        on_output: Callable[[str, int, bytes], Coroutine],
        on_state: Callable[[str, str, Optional[str]], Coroutine],
    ) -> Session:
        if host_id in self._sessions:
            raise RuntimeError("session already exists for this host")

        session_id = f"s{self._next_session_id}"
        self._next_session_id += 1

        session = Session(
            session_id=session_id,
            host_id=host_id,
            host=host,
            password=password,
            on_output=on_output,
            on_state=on_state,
        )
        self._sessions[host_id] = session
        try:
            await session.connect()
        except Exception:
            self._sessions.pop(host_id, None)
            raise
        return session

    async def disconnect(self, host_id: str, reason: str = "") -> None:
        session = self._sessions.pop(host_id, None)
        if session:
            await session.disconnect(reason)

    async def write_input(self, stream_id: int, payload: bytes) -> None:
        for session in self._sessions.values():
            await session.write_input(stream_id, payload)

    async def disconnect_all(self) -> None:
        for host_id in list(self._sessions.keys()):
            await self.disconnect(host_id)
