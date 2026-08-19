import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
import jwt

from app.core.config import settings

# Derives consistent SHA-256 password hash using per-user cryptographic salt
def derive_password_hash(password: str, salt: str) -> str:
    return hashlib.sha256(f"{password}:{salt}".encode("utf-8")).hexdigest()

# Generates cryptographically secure random salt string
def generate_salt(length: int = 16) -> str:
    return secrets.token_hex(length)

# Computes challenge-response proof signature from derived hash and nonce
def compute_challenge_proof(password_hash: str, nonce: str) -> str:
    return hmac.new(
        key=password_hash.encode("utf-8"),
        msg=nonce.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

# Verifies client-submitted challenge-response proof signature
def verify_challenge_proof(password_hash: str, nonce: str, proof_signature: str) -> bool:
    expected_proof = compute_challenge_proof(password_hash, nonce)
    return hmac.compare_digest(expected_proof, proof_signature)

# Issues signed scoped JWT access token
def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
    scopes: Optional[List[str]] = None,
    tenant_uuid: Optional[str] = None,
    role: Optional[str] = None,
    permissions: Optional[List[str]] = None,
    governance_level: Optional[str] = None,
    token_version: int = 1,
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "scopes": scopes or ["read", "evaluate"],
        "tenant_uuid": tenant_uuid or "default",
        "role": role or "TRANSACTIONAL_USER",
        "permissions": permissions or [],
        "governance_level": governance_level or ("PLATFORM" if role == "SUPER_ADMIN" else "TENANT"),
        "ver": token_version,
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

# Issues long-lived cryptographic refresh token
def create_refresh_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=7))
    payload = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

# Decodes and validates JWT token payload
def verify_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError:
        return None
