import pytest
from fastapi import Request
from unittest.mock import AsyncMock, MagicMock

from app.api.deps import get_current_authorized_tenant
from app.core.exceptions import ForbiddenError
from app.core.security import (
    compute_challenge_proof,
    create_access_token,
    derive_password_hash,
    generate_salt,
    verify_challenge_proof,
    verify_token,
)


# Verifies challenge-response proof signature computation and validation
def test_uas_challenge_proof_flow():
    salt = generate_salt(16)
    pwd_hash = derive_password_hash("SecretPassword@123", salt)
    nonce = "7f8b9a0c1d2e3f4a5b6c7d8e9f0a1b2c"

    proof = compute_challenge_proof(pwd_hash, nonce)
    assert isinstance(proof, str)
    assert len(proof) == 64

    is_valid = verify_challenge_proof(pwd_hash, nonce, proof)
    assert is_valid is True

    # Malformed nonce or password rejected
    is_invalid = verify_challenge_proof(pwd_hash, "wrong-nonce", proof)
    assert is_invalid is False


# Verifies token generation carries token_version and governance_level
def test_token_claims_governance_and_version():
    token = create_access_token(
        subject="usr_123",
        tenant_uuid="tenant-finsol-north",
        role="SALES_MANAGER",
        permissions=["applications:read"],
        governance_level="TENANT",
        token_version=2,
    )
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "usr_123"
    assert payload["tenant_uuid"] == "tenant-finsol-north"
    assert payload["role"] == "SALES_MANAGER"
    assert payload["governance_level"] == "TENANT"
    assert payload["ver"] == 2


# Verifies cross-tenant access violation raises 403 Forbidden
@pytest.mark.asyncio
async def test_cross_tenant_access_violation_rejection():
    # User token has tenant_uuid = 'tenant-finsol-north'
    token_payload = {
        "sub": "usr_123",
        "tenant_uuid": "tenant-finsol-north",
        "role": "SALES_MANAGER",
        "governance_level": "TENANT",
    }

    # Request header attempts to access 'tenant-boi-south'
    request = MagicMock(spec=Request)
    request.headers = {"X-Tenant-UUID": "tenant-boi-south"}
    request.path_params = {}
    db = AsyncMock()

    with pytest.raises(ForbiddenError) as exc_info:
        await get_current_authorized_tenant(request=request, token_payload=token_payload, db=db)

    assert "TENANT_CROSS_ACCESS_VIOLATION" in str(exc_info.value)


# Verifies platform super admin can access any tenant partition
@pytest.mark.asyncio
async def test_platform_super_admin_omni_tenant_access():
    token_payload = {
        "sub": "usr_super_1",
        "tenant_uuid": "platform_master",
        "role": "SUPER_ADMIN",
        "governance_level": "PLATFORM",
    }

    request = MagicMock(spec=Request)
    request.headers = {"X-Tenant-UUID": "tenant-boi-south"}
    request.path_params = {}
    db = AsyncMock()

    target_tenant = await get_current_authorized_tenant(request=request, token_payload=token_payload, db=db)
    assert target_tenant == "tenant-boi-south"
