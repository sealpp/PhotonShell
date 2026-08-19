"""Telemetry collection for an active SSH session."""

import asyncio
import re
from dataclasses import dataclass
from typing import Callable, Coroutine, Optional

import asyncssh

from photon.photon_pb2 import Metric, TelemetrySnapshot


@dataclass
class _CpuSample:
    total: int
    idle: int


class TelemetryCollector:
    """Periodically gather CPU, memory, disk, and process metrics."""

    def __init__(
        self,
        host_id: str,
        connection: asyncssh.SSHClientConnection,
        on_snapshot: Callable[[TelemetrySnapshot], Coroutine],
    ):
        self.host_id = host_id
        self.connection = connection
        self.on_snapshot = on_snapshot
        self.interval_ms = 2000
        self._task: Optional[asyncio.Task] = None
        self._last_cpu: Optional[_CpuSample] = None

    async def start(self, interval_ms: int) -> None:
        self.interval_ms = interval_ms
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run(self) -> None:
        try:
            while True:
                await self._collect()
                await asyncio.sleep(self.interval_ms / 1000.0)
        except asyncio.CancelledError:
            raise

    async def _collect(self) -> None:
        snapshot = TelemetrySnapshot()
        snapshot.host_id = self.host_id
        snapshot.sampled_at_ms = int(asyncio.get_event_loop().time() * 1000)

        cpu = await self._cpu_percent()
        mem = await self._memory_percent()
        disk = await self._disk_percent()
        procs = await self._process_count()

        snapshot.cpu_percent.CopyFrom(_metric(cpu))
        snapshot.memory_percent.CopyFrom(_metric(mem))
        snapshot.disk_percent.CopyFrom(_metric(disk))
        snapshot.process_count = procs if procs is not None else 0

        await self.on_snapshot(snapshot)

    async def _run_cmd(self, command: str) -> str:
        if self.connection is None:
            return ""
        try:
            result = await self.connection.run(command, check=False, timeout=5)
            return result.stdout or ""
        except Exception:
            return ""

    async def _cpu_percent(self) -> Optional[float]:
        text = await self._run_cmd("cat /proc/stat")
        match = re.search(r"^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)", text, re.MULTILINE)
        if not match:
            return None
        user, nice, system, idle = (int(x) for x in match.groups())
        total = user + nice + system + idle
        current = _CpuSample(total=total, idle=idle)
        prev = self._last_cpu
        self._last_cpu = current
        if prev is None:
            # first sample: guestimate from idle ratio
            if total == 0:
                return 0.0
            return 100.0 - (idle / total * 100.0)
        delta_total = current.total - prev.total
        delta_idle = current.idle - prev.idle
        if delta_total == 0:
            return 0.0
        return 100.0 - (delta_idle / delta_total * 100.0)

    async def _memory_percent(self) -> Optional[float]:
        text = await self._run_cmd("free -b")
        total_match = re.search(r"Mem:\s+(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)", text)
        if not total_match:
            return None
        total = int(total_match.group(1))
        available = int(total_match.group(2))
        if total == 0:
            return 0.0
        return (total - available) / total * 100.0

    async def _disk_percent(self) -> Optional[float]:
        text = await self._run_cmd("df -P -k /")
        lines = text.strip().splitlines()
        if len(lines) < 2:
            return None
        parts = lines[-1].split()
        if len(parts) < 5:
            return None
        used = int(parts[2])
        available = int(parts[3])
        total = used + available
        if total == 0:
            return 0.0
        return used / total * 100.0

    async def _process_count(self) -> Optional[int]:
        text = await self._run_cmd("ps -eo pid")
        count = max(0, len(text.strip().splitlines()) - 1)
        return count


def _metric(value: Optional[float]) -> Metric:
    m = Metric()
    if value is None:
        m.quality = "missing"
    else:
        m.number = round(value, 2)
        m.quality = "valid"
    return m
