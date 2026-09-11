"""Minimal persistent device trust for SealNode."""

from __future__ import annotations

import base64
import json
import os
import secrets
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import (
    decode_dss_signature,
    encode_dss_signature,
)

TRUST_SCHEMA_VERSION = 1
NODE_ID_BYTES = 12
ECDSA_RAW_SIGNATURE_BYTES = 64
MAX_PAIRED_DEVICES = 4
TRUST_FILENAME = "seal-trust.json"


def default_trust_path() -> Path:
    configured = os.environ.get("SEAL_TRUST_PATH")
    if configured:
        return Path(configured)
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / TRUST_FILENAME
    return Path(__file__).resolve().parents[1] / TRUST_FILENAME


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value.encode("ascii"))


def _raw_signature(signature_der: bytes) -> bytes:
    r, s = decode_dss_signature(signature_der)
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def _der_signature(signature_raw: bytes) -> bytes:
    if len(signature_raw) != ECDSA_RAW_SIGNATURE_BYTES:
        raise ValueError("invalid ECDSA signature length")
    r = int.from_bytes(signature_raw[:32], "big")
    s = int.from_bytes(signature_raw[32:], "big")
    return encode_dss_signature(r, s)


def load_p256_public_key(der: bytes) -> ec.EllipticCurvePublicKey:
    key = serialization.load_der_public_key(der)
    if not isinstance(key, ec.EllipticCurvePublicKey) or key.curve.name != "secp256r1":
        raise ValueError("device key must be an ECDSA P-256 public key")
    return key


@dataclass(frozen=True)
class PairedDevice:
    device_id: str
    device_name: str
    public_key: bytes
    created_at: float


class TrustRepository:
    def __init__(self, path: Path | str | None = None) -> None:
        self.path = Path(path) if path is not None else default_trust_path()
        raw = self.path.read_bytes() if self.path.exists() else None
        self._state = self._decode(raw) if raw else self._new_state()
        self._save()

    @property
    def node_id(self) -> str:
        return self._state["node_id"]

    @property
    def node_private_key(self) -> ec.EllipticCurvePrivateKey:
        key = serialization.load_pem_private_key(
            _unb64(self._state["private_key"]),
            password=None,
        )
        if not isinstance(key, ec.EllipticCurvePrivateKey) or key.curve.name != "secp256r1":
            raise ValueError("stored node key is not an ECDSA P-256 private key")
        return key

    @property
    def node_public_key(self) -> bytes:
        return self.node_private_key.public_key().public_bytes(
            serialization.Encoding.DER,
            serialization.PublicFormat.SubjectPublicKeyInfo,
        )

    def sign(self, payload: bytes) -> bytes:
        signature = self.node_private_key.sign(payload, ec.ECDSA(hashes.SHA256()))
        return _raw_signature(signature)

    def get_device(self, device_id: str) -> PairedDevice | None:
        raw = self._state["devices"].get(device_id)
        if raw is None:
            return None
        return PairedDevice(
            device_id=device_id,
            device_name=raw["device_name"],
            public_key=_unb64(raw["public_key"]),
            created_at=float(raw["created_at"]),
        )

    def upsert_device(self, device_id: str, device_name: str, public_key: bytes, created_at: float) -> None:
        load_p256_public_key(public_key)
        if device_id not in self._state["devices"] and len(self._state["devices"]) >= MAX_PAIRED_DEVICES:
            raise RuntimeError("paired device limit reached")
        self._state["devices"][device_id] = {
            "device_name": device_name,
            "public_key": _b64(public_key),
            "created_at": created_at,
        }
        self._save()

    def _new_state(self) -> dict[str, Any]:
        private_key = ec.generate_private_key(ec.SECP256R1())
        private_pem = private_key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        return {
            "version": TRUST_SCHEMA_VERSION,
            "node_id": _b64(secrets.token_bytes(NODE_ID_BYTES)),
            "private_key": _b64(private_pem),
            "devices": {},
        }

    def _decode(self, raw: bytes) -> dict[str, Any]:
        try:
            state = json.loads(raw.decode("utf-8"))
            if state.get("version") != TRUST_SCHEMA_VERSION:
                raise ValueError("unsupported trust state version")
            if not isinstance(state.get("devices"), dict):
                raise ValueError("invalid trust device registry")
            return state
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            raise RuntimeError("invalid SealNode trust state") from exc

    def _save(self) -> None:
        value = json.dumps(self._state, separators=(",", ":")).encode("utf-8")
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=self.path.parent,
            prefix=f".{self.path.name}.",
            delete=False,
        ) as temporary:
            temporary.write(value)
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, self.path)
        if os.name != "nt":
            os.chmod(self.path, 0o600)


def verify_device_signature(public_key: bytes, payload: bytes, signature: bytes) -> bool:
    try:
        key = load_p256_public_key(public_key)
        key.verify(_der_signature(signature), payload, ec.ECDSA(hashes.SHA256()))
        return True
    except (ValueError, TypeError):
        return False
