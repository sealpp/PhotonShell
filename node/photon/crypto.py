"""Minimal v0 cryptography: PBKDF2 + AES-256-GCM."""

import secrets

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

SALT_LEN = 16
NONCE_LEN = 12
KEY_LEN = 32
ITERATIONS = 100_000


def derive_key(password: str, salt: bytes) -> bytes:
    """Derive a 256-bit key from a UTF-8 password and a random salt."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LEN,
        salt=salt,
        iterations=ITERATIONS,
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt(plaintext: bytes, key: bytes) -> bytes:
    """Encrypt with AES-256-GCM and prepend a random nonce."""
    nonce = secrets.token_bytes(NONCE_LEN)
    aesgcm = AESGCM(key)
    return nonce + aesgcm.encrypt(nonce, plaintext, None)


def decrypt(blob: bytes, key: bytes) -> bytes:
    """Decrypt an AES-256-GCM blob that starts with the nonce."""
    if len(blob) < NONCE_LEN + 16:
        raise ValueError("ciphertext too short")
    nonce = blob[:NONCE_LEN]
    ciphertext = blob[NONCE_LEN:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None)
