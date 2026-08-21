import asyncio
import asyncssh


class MockSSHServer(asyncssh.SSHServer):
    def begin_auth(self, username: str) -> bool:
        return True

    def password_auth_supported(self) -> bool:
        return True

    def validate_password(self, username: str, password: str) -> bool:
        return True


call_count = {"stat": 0}


async def handle_process(process: asyncssh.SSHServerProcess) -> None:
    cmd = process.command.strip()
    if cmd == "cat /proc/stat":
        call_count["stat"] += 1
        # Make numbers increase so CPU percent is non-zero and stable-ish
        total = 600 + call_count["stat"] * 100
        idle = 400 + call_count["stat"] * 20
        process.stdout.write(f"cpu  {total - idle - 100} 0 100 {idle}\n")
    elif cmd == "free -b":
        process.stdout.write("Mem: 16000000000 4000000000 4000000000 0 2000000000 12000000000\n")
    elif cmd == "df -P -k /":
        process.stdout.write("Filesystem 1K-blocks Used Available Use% Mounted on\n")
        process.stdout.write("/dev/sda1 100000 40000 60000 40% /\n")
    elif cmd == "ps -eo pid":
        process.stdout.write("PID\n1\n2\n3\n")
    else:
        process.stderr.write(f"unknown command: {cmd}\n")
        process.exit(1)
        return
    process.stdout.write_eof()
    process.exit(0)


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


if __name__ == "__main__":
    asyncio.run(main())
