import asyncio
import re

import asyncssh


class MockSSHServer(asyncssh.SSHServer):
    def begin_auth(self, username: str) -> bool:
        return True

    def password_auth_supported(self) -> bool:
        return True

    def validate_password(self, username: str, password: str) -> bool:
        return True


call_count = {"stat": 0}
SAMPLE_COMMAND = (
    "printf '__PHOTON_CPU__\\n'; cat /proc/stat; "
    "printf '__PHOTON_MEM__\\n'; free -b; "
    "printf '__PHOTON_DISK__\\n'; df -P -k /; "
    "printf '__PHOTON_PROCS__\\n'; ps -eo pid"
)


def sample_output() -> str:
    call_count["stat"] += 1
    total = 600 + call_count["stat"] * 100
    idle = 400 + call_count["stat"] * 20
    return (
        "__PHOTON_CPU__\n"
        f"cpu  {total - idle - 100} 0 100 {idle}\n"
        "__PHOTON_MEM__\n"
        "Mem: 16000000000 4000000000 4000000000 0 2000000000 12000000000\n"
        "__PHOTON_DISK__\n"
        "Filesystem 1K-blocks Used Available Use% Mounted on\n"
        "/dev/sda1 100000 40000 60000 40% /\n"
        "__PHOTON_PROCS__\n"
        "PID\n1\n2\n3\n"
    )


def command_output(command: str) -> tuple[str, int]:
    if command == "uname -s":
        return "Linux\n", 0
    if command == "printf exec-ok":
        return "exec-ok", 0
    if command == SAMPLE_COMMAND:
        return sample_output(), 0
    if command == "echo smoke-ok":
        return "smoke-ok\n", 0
    return f"unknown command: {command}\n", 1


async def handle_shell(process: asyncssh.SSHServerProcess) -> None:
    async for line in process.stdin:
        command = line.strip()
        marker = re.search(
            r"printf '(__PHOTON_EXEC_START_[A-Za-z0-9]+__)\\n'; (.*); status=\$\?; printf '\\n(__PHOTON_EXEC_END_[A-Za-z0-9]+__)%s\\n'",
            command,
        )
        if marker:
            start, inner, end = marker.groups()
            output, status = command_output(inner)
            process.stdout.write(f"{start}\n")
            process.stdout.write(output)
            process.stdout.write(f"\n{end}{status}\n")
            continue
        output, status = command_output(command)
        process.stdout.write(output)
        if status:
            process.exit(status)
            return


async def handle_process(process: asyncssh.SSHServerProcess) -> None:
    command = (process.command or "").strip()
    if command:
        output, status = command_output(command)
        process.stdout.write(output)
        if status:
            process.exit(status)
        else:
            process.exit(0)
        return
    await handle_shell(process)


async def main() -> int:
    host_key = asyncssh.generate_private_key("ssh-ed25519")
    server = await asyncssh.listen(
        host="127.0.0.1",
        port=0,
        server_host_keys=[host_key],
        process_factory=handle_process,
        server_factory=MockSSHServer,
    )
    port = server.sockets[0].getsockname()[1]
    print(f"MOCK_SSH_PORT={port}", flush=True)
    await asyncio.Event().wait()
    return 0


if __name__ == "__main__":
    asyncio.run(main())
