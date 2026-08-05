"""PII masking applied before logging, persistence, or BRE evaluation.

Redaction runs on the parsed structure, so it covers every string value the
engine emits regardless of which field carried the identifier.
"""
from __future__ import annotations

import re
from typing import Any, Final

AADHAAR_MASK: Final[str] = "[Aadhaar Redacted]"
PAN_MASK_SUFFIX: Final[int] = 4

# 12 digits, optionally spaced or hyphened in 4-4-4. Bounded by non-digits so a
# longer number (account ids, control numbers) is not partially matched.
_AADHAAR: Final[re.Pattern[str]] = re.compile(r"(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)")
_PAN: Final[re.Pattern[str]] = re.compile(r"(?<![A-Z0-9])[A-Z]{5}\d{4}[A-Z](?![A-Z0-9])")
_EMAIL: Final[re.Pattern[str]] = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
_PHONE: Final[re.Pattern[str]] = re.compile(r"(?<!\d)(?:\+91[- ]?)?[6-9]\d{9}(?!\d)")

# Verhoeff tables — Aadhaar's checksum. Used to avoid masking any arbitrary
# 12-digit number (e.g. an amount or an account id) that merely looks like one.
_D: Final[tuple[tuple[int, ...], ...]] = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9), (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6), (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8), (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2), (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4), (9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
)
_P: Final[tuple[tuple[int, ...], ...]] = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9), (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2), (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0), (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5), (7, 0, 4, 6, 9, 1, 3, 2, 5, 8),
)


def _verhoeff_valid(digits: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(digits)):
        c = _D[c][_P[i % 8][int(ch)]]
    return c == 0


def is_probable_aadhaar(candidate: str) -> bool:
    digits = re.sub(r"[ -]", "", candidate)
    if len(digits) != 12 or digits[0] in "01":
        return False
    return _verhoeff_valid(digits)


def redact_text(value: str, *, strict: bool = False) -> str:
    """Mask identifiers in a single string.

    Fail-closed by default: every 12-digit group is masked. Requiring a valid
    Verhoeff checksum (strict=True) would leak a real Aadhaar whenever OCR
    corrupts one digit, and costs little here because amounts in the target
    schema are JSON numbers, which redact_structure never rewrites.
    """

    def _aadhaar_sub(m: re.Match[str]) -> str:
        if strict and not is_probable_aadhaar(m.group(0)):
            return m.group(0)
        return AADHAAR_MASK

    out = _AADHAAR.sub(_aadhaar_sub, value)
    out = _PAN.sub(lambda m: "*****" + m.group(0)[-PAN_MASK_SUFFIX:], out)
    out = _EMAIL.sub(lambda m: "***@" + m.group(0).split("@", 1)[1], out)
    out = _PHONE.sub(lambda m: "*******" + m.group(0)[-3:], out)
    return out


def redact_structure(node: Any, *, strict: bool = False) -> Any:
    """Recursively redact every string in a parsed JSON structure.

    Dict keys are redacted too: this engine composes keys from account data.
    """
    if isinstance(node, str):
        return redact_text(node, strict=strict)
    if isinstance(node, dict):
        return {
            redact_text(k, strict=strict) if isinstance(k, str) else k:
            redact_structure(v, strict=strict)
            for k, v in node.items()
        }
    if isinstance(node, list):
        return [redact_structure(v, strict=strict) for v in node]
    return node


class RedactingFilter:
    """logging.Filter that masks PII in log records before they are emitted."""

    def filter(self, record: Any) -> bool:  # noqa: A003 - logging API
        if isinstance(record.msg, str):
            record.msg = redact_text(record.msg, strict=False)
        if record.args:
            record.args = tuple(
                redact_text(a, strict=False) if isinstance(a, str) else a
                for a in (record.args if isinstance(record.args, tuple) else (record.args,))
            )
        return True
