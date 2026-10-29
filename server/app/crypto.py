"""Encryption at rest for recorded prompt text (AES-256-GCM)."""

import base64
import hashlib
import logging
import os
from functools import lru_cache

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from .config import settings

log = logging.getLogger(__name__)

PREFIX = "enc:v1:"
_AAD = b"aiguard:prompt_text"


@lru_cache(maxsize=1)
def _cipher() -> AESGCM:
    raw = settings.prompt_encryption_key
    if raw:
        key = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4))
        if len(key) != 32:
            raise ValueError("PROMPT_ENCRYPTION_KEY must be 32 bytes, base64-encoded")
    else:
        log.warning("PROMPT_ENCRYPTION_KEY is not set; deriving the prompt key from SECRET_KEY")
        key = hashlib.sha256(b"aiguard-prompt-key:" + settings.secret_key.encode()).digest()
    return AESGCM(key)


def encrypt(text: str) -> str:
    nonce = os.urandom(12)
    sealed = _cipher().encrypt(nonce, text.encode(), _AAD)
    return PREFIX + base64.urlsafe_b64encode(nonce + sealed).decode()


def decrypt(value: str) -> str:
    if not value.startswith(PREFIX):
        return value  # stored before encryption was enabled; re-encrypted at startup
    blob = base64.urlsafe_b64decode(value[len(PREFIX):])
    try:
        return _cipher().decrypt(blob[:12], blob[12:], _AAD).decode()
    except InvalidTag:
        log.error("cannot decrypt a stored prompt; PROMPT_ENCRYPTION_KEY does not match the key it was saved with")
        return "[encrypted with a different key]"
