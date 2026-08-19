"""Encrypted SQLite-backed key/value state for PhotonNode."""

import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

from photon.crypto import decrypt, derive_key, encrypt

VERSION = 1
DEFAULT_STATE_PATH = Path(__file__).resolve().parent.parent / "data" / "state.db"


class StateError(Exception):
    """Raised when state is locked, corrupt, or the master password is wrong."""


class State:
    """A single-file SQLite store where each value is an AES-GCM blob."""

    def __init__(self, db_path: Optional[Path] = None):
        self._db_path = db_path or DEFAULT_STATE_PATH
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path)
        self._key: Optional[bytes] = None
        self._init_schema()

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value BLOB)"
            )
            self._conn.execute(
                "CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY, value BLOB)"
            )

    def unlock(self, password: str) -> None:
        """Derive the master key and verify it against the stored _meta record."""
        with self._conn:
            row = self._conn.execute(
                "SELECT value FROM meta WHERE key = '_salt'"
            ).fetchone()
            if row:
                salt = row[0]
            else:
                salt = os.urandom(16)
                self._conn.execute(
                    "INSERT INTO meta (key, value) VALUES (?, ?)",
                    ("_salt", salt),
                )

            key = derive_key(password, salt)

            meta_row = self._conn.execute(
                "SELECT value FROM meta WHERE key = '_meta'"
            ).fetchone()
            if meta_row:
                try:
                    decrypt(meta_row[0], key)
                except Exception as exc:
                    raise StateError("invalid master password") from exc
            else:
                meta = json.dumps({"version": VERSION}).encode("utf-8")
                self._conn.execute(
                    "INSERT INTO meta (key, value) VALUES (?, ?)",
                    ("_meta", encrypt(meta, key)),
                )

            self._key = key

    def is_unlocked(self) -> bool:
        return self._key is not None

    def _require_unlocked(self) -> bytes:
        if self._key is None:
            raise StateError("state is locked")
        return self._key

    def get(self, key: str, default: Any = None) -> Any:
        key_mat = self._require_unlocked()
        row = self._conn.execute(
            "SELECT value FROM store WHERE key = ?", (key,)
        ).fetchone()
        if not row:
            return default
        try:
            return json.loads(decrypt(row[0], key_mat).decode("utf-8"))
        except Exception as exc:
            raise StateError(f"failed to decrypt key {key!r}") from exc

    def set(self, key: str, value: Any) -> None:
        key_mat = self._require_unlocked()
        blob = encrypt(json.dumps(value).encode("utf-8"), key_mat)
        with self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)",
                (key, blob),
            )

    def delete(self, key: str) -> None:
        with self._conn:
            self._conn.execute("DELETE FROM store WHERE key = ?", (key,))

    def close(self) -> None:
        self._conn.close()
