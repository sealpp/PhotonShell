"""Minimal persistent device trust for PhotonNode."""

from __future__ import annotations

import base64
import ctypes
import json
import os
import secrets
import sys
from dataclasses import dataclass
from typing import Any, Optional, Protocol

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

TRUST_SCHEMA_VERSION = 1
NODE_ID_BYTES = 12
ECDSA_RAW_SIGNATURE_BYTES = 64
MAX_PAIRED_DEVICES = 4
MAX_TRUST_BLOB_BYTES = 5 * 512


class TrustBackend(Protocol):
    persistent: bool

    def load(self) -> Optional[bytes]:
        ...

    def save(self, value: bytes) -> None:
        ...


class MemoryTrustBackend:
    persistent = False

    def __init__(self) -> None:
        self._value: Optional[bytes] = None

    def load(self) -> Optional[bytes]:
        return self._value

    def save(self, value: bytes) -> None:
        self._value = value


if sys.platform == "win32":

    class _Credential(ctypes.Structure):
        _fields_ = [
            ("Flags", ctypes.c_uint32),
            ("Type", ctypes.c_uint32),
            ("TargetName", ctypes.c_wchar_p),
            ("Comment", ctypes.c_wchar_p),
            ("LastWritten", ctypes.c_byte * 8),
            ("CredentialBlobSize", ctypes.c_uint32),
            ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
            ("Persist", ctypes.c_uint32),
            ("AttributeCount", ctypes.c_uint32),
            ("Attributes", ctypes.c_void_p),
            ("TargetAlias", ctypes.c_wchar_p),
            ("UserName", ctypes.c_wchar_p),
        ]


    class WindowsCredentialBackend:
        persistent = True
        _target = "PhotonShell/PhotonNode/device-trust/v1"
        _generic_type = 1
        _persist_local_machine = 2

        def __init__(self) -> None:
            self._advapi32 = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
            self._advapi32.CredReadW.argtypes = [
                ctypes.c_wchar_p,
                ctypes.c_uint32,
                ctypes.c_uint32,
                ctypes.POINTER(ctypes.POINTER(_Credential)),
            ]
            self._advapi32.CredReadW.restype = ctypes.c_int
            self._advapi32.CredWriteW.argtypes = [ctypes.POINTER(_Credential), ctypes.c_uint32]
            self._advapi32.CredWriteW.restype = ctypes.c_int
            self._advapi32.CredFree.argtypes = [ctypes.c_void_p]
            self._advapi32.CredFree.restype = None

        def load(self) -> Optional[bytes]:
            credential = ctypes.POINTER(_Credential)()
            if not self._advapi32.CredReadW(
                self._target,
                self._generic_type,
                0,
                ctypes.byref(credential),
            ):
                error = ctypes.get_last_error()
                if error == 1168:
                    return None
                raise OSError(error, "CredReadW failed")

            try:
                value = credential.contents
                if not value.CredentialBlob or value.CredentialBlobSize == 0:
                    return None
                return ctypes.string_at(value.CredentialBlob, value.CredentialBlobSize)
            finally:
                self._advapi32.CredFree(credential)

        def save(self, value: bytes) -> None:
            if len(value) > MAX_TRUST_BLOB_BYTES:
                raise ValueError("device trust state exceeds Windows Credential Manager limit")
            blob = (ctypes.c_ubyte * len(value)).from_buffer_copy(value)
            credential = _Credential()
            credential.Type = self._generic_type
            credential.TargetName = self._target
            credential.CredentialBlobSize = len(value)
            credential.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
            credential.Persist = self._persist_local_machine
            if not self._advapi32.CredWriteW(ctypes.byref(credential), 0):
                error = ctypes.get_last_error()
                raise OSError(error, "CredWriteW failed")


else:

    class WindowsCredentialBackend:
        persistent = False

        def __init__(self) -> None:
            raise RuntimeError("Windows Credential Manager is only available on Windows")

        def load(self) -> Optional[bytes]:
            raise RuntimeError("Windows Credential Manager is only available on Windows")

        def save(self, _value: bytes) -> None:
            raise RuntimeError("Windows Credential Manager is only available on Windows")


def default_trust_backend() -> TrustBackend:
    if os.name == "nt":
        return WindowsCredentialBackend()
    return MemoryTrustBackend()


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
    def __init__(self, backend: Optional[TrustBackend] = None) -> None:
        self.backend = backend or default_trust_backend()
        raw = self.backend.load()
        self._state = self._decode(raw) if raw else self._new_state()
        self._save()

    @property
    def persistent(self) -> bool:
        return self.backend.persistent

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

    def get_device(self, device_id: str) -> Optional[PairedDevice]:
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
            raise RuntimeError("invalid PhotonNode trust state") from exc

    def _save(self) -> None:
        self.backend.save(json.dumps(self._state, separators=(",", ":")).encode("utf-8"))


def verify_device_signature(public_key: bytes, payload: bytes, signature: bytes) -> bool:
    try:
        key = load_p256_public_key(public_key)
        key.verify(_der_signature(signature), payload, ec.ECDSA(hashes.SHA256()))
        return True
    except (ValueError, TypeError):
        return False
