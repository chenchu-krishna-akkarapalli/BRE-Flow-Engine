import logging
import re
from typing import Any, Dict, Union

# Regex patterns for PII redaction
PAN_PATTERN = re.compile(r"([A-Z]{2})[A-Z]{3}[0-9]{4}([A-Z]{2})")
DOB_PATTERN = re.compile(r"\b(\d{4}-\d{2}-)(\d{2})\b")
AADHAAR_PATTERN = re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?(\d{4})\b")


def redact_pan(pan: str) -> str:
    """Mask PAN format: ABCDE1234F -> AB******4F"""
    if not pan or len(pan) < 10:
        return "****"
    return f"{pan[:2]}******{pan[-2:]}"


def redact_dob(dob: str) -> str:
    """Mask DOB format: 1990-05-15 -> ****-**-15"""
    if not dob or len(dob) < 10:
        return "****-**-**"
    return f"****-**-{dob[-2:]}"


def redact_pii(data: Union[Dict[str, Any], str]) -> Union[Dict[str, Any], str]:
    """Recursively redact sensitive PII fields in dictionaries or log message strings."""
    if isinstance(data, str):
        # Redact strings matching PAN, DOB, or Aadhaar
        s = PAN_PATTERN.sub(r"\1******\2", data)
        s = DOB_PATTERN.sub(r"****-**-\2", s)
        s = AADHAAR_PATTERN.sub(r"****-****-\1", s)
        return s

    if isinstance(data, dict):
        redacted = {}
        for key, value in data.items():
            lower_key = key.lower()
            if "pan" in lower_key and isinstance(value, str):
                redacted[key] = redact_pan(value)
            elif "dob" in lower_key and isinstance(value, str):
                redacted[key] = redact_dob(value)
            elif "aadhaar" in lower_key and isinstance(value, str):
                redacted[key] = f"****-****-{value[-4:]}" if len(value) >= 4 else "****"
            elif isinstance(value, (dict, list)):
                redacted[key] = redact_pii(value)
            else:
                redacted[key] = value
        return redacted

    if isinstance(data, list):
        return [redact_pii(item) for item in data]

    return data


class PIIRedactingFilter(logging.Filter):
    """Logging filter that redacts sensitive PII from log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_pii(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = redact_pii(record.args)
            elif isinstance(record.args, tuple):
                record.args = tuple(redact_pii(arg) if isinstance(arg, str) else arg for arg in record.args)
        return True


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    logger = logging.getLogger("flowbre")
    logger.setLevel(log_level.upper())
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            '[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s'
        )
        handler.setFormatter(formatter)
        handler.addFilter(PIIRedactingFilter())
        logger.addHandler(handler)
        
    return logger


logger = setup_logging()
