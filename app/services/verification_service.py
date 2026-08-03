"""Demo OTP challenges for PAN and mobile verification.

Deliberately a stub: no SMS/email provider is wired, and challenges live in
process memory rather than Redis, so they do not survive a restart or reach a
second worker. That is acceptable for a demo flow and unacceptable for
production — swap the store for Redis and `_deliver` for a real provider
before this gates anything that matters.
"""

import secrets
import time
from dataclasses import dataclass
from typing import Dict, Literal, Optional

from app.constants import OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_SECONDS
from app.core.exceptions import InvalidPayloadError
from app.core.logging import logger, redact_pii

Channel = Literal["email", "mobile"]


@dataclass
class Challenge:
    code: str
    channel: Channel
    target: str
    expires_at: float
    attempts: int = 0


_CHALLENGES: Dict[str, Challenge] = {}


def _sweep(now: float) -> None:
    for key in [k for k, c in _CHALLENGES.items() if c.expires_at <= now]:
        _CHALLENGES.pop(key, None)


def _mask(channel: Channel, target: str) -> str:
    """What the UI may display back: enough to recognise, not enough to leak."""
    if channel == "mobile":
        return f"******{target[-4:]}" if len(target) >= 4 else "******"
    name, _, domain = target.partition("@")
    return f"{name[:2]}***@{domain}" if domain else "***"


def send_otp(channel: Channel, target: str) -> Dict[str, object]:
    """Issue a challenge. Returns the id and a masked destination, never the code."""
    if not target.strip():
        raise InvalidPayloadError("A destination is required to send an OTP.")

    now = time.time()
    _sweep(now)
    challenge_id = secrets.token_urlsafe(16)
    code = f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"
    _CHALLENGES[challenge_id] = Challenge(code, channel, target.strip(), now + OTP_TTL_SECONDS)

    # The destination is PII and the code is a credential; neither is logged raw.
    logger.info(f"OTP challenge {challenge_id} issued via {channel} to {redact_pii(target)}")
    return {
        "challenge_id": challenge_id,
        "channel": channel,
        "sent_to": _mask(channel, target.strip()),
        "expires_in_seconds": OTP_TTL_SECONDS,
        # Demo-only: a real provider delivers the code out of band.
        "demo_code": code,
    }


def verify_otp(challenge_id: str, code: str) -> Dict[str, object]:
    """Consume a challenge. A correct code verifies once; a wrong one burns an attempt."""
    now = time.time()
    _sweep(now)
    challenge: Optional[Challenge] = _CHALLENGES.get(challenge_id)
    if challenge is None:
        raise InvalidPayloadError("That verification code has expired. Request a new one.")

    challenge.attempts += 1
    if challenge.attempts > OTP_MAX_ATTEMPTS:
        _CHALLENGES.pop(challenge_id, None)
        raise InvalidPayloadError("Too many incorrect attempts. Request a new code.")

    if not secrets.compare_digest(challenge.code, code.strip()):
        return {"verified": False, "attempts_remaining": OTP_MAX_ATTEMPTS - challenge.attempts}

    _CHALLENGES.pop(challenge_id, None)
    logger.info(f"OTP challenge {challenge_id} verified")
    return {"verified": True, "attempts_remaining": OTP_MAX_ATTEMPTS - challenge.attempts}
