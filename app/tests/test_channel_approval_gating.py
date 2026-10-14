from unittest.mock import AsyncMock, MagicMock
import pytest

from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel
from app.services.uas_service import uas_service


@pytest.mark.asyncio
async def test_pending_channel_blocks_challenge_when_user_exists():
    """When a UserModel exists for a pending tenant, create_challenge must raise ForbiddenError."""
    tenant = TenantModel(
        id="t-pending-1",
        name="Pending Corp",
        code="pending-corp",
        status="pending",
        is_active=False,
    )
    user = UserModel(
        id="u-pending-1",
        username="pending@corp.com",
        email="pending@corp.com",
        role="CHANNEL_ADMIN",
        tenant_id=tenant.id,
        is_active=False,
    )

    db = MagicMock()
    # Mock UserRepository.get_user_with_context
    with pytest.MonkeyPatch.context() as mp:
        async def mock_get_context(self, identifier):
            return user, tenant, None
        mp.setattr("app.db.repositories.user_repository.UserRepository.get_user_with_context", mock_get_context)

        with pytest.raises(ForbiddenError) as exc:
            await uas_service.create_challenge(db=db, username="pending@corp.com")
        assert "pending Super Admin approval" in str(exc.value)


@pytest.mark.asyncio
async def test_unregistered_email_matching_pending_tenant_blocks_challenge():
    """When no user exists, but contact_email matches a pending tenant, block with ForbiddenError."""
    pending_tenant = TenantModel(
        id="t-pending-2",
        name="Apex Loans",
        code="apex-loans",
        status="pending",
        contact_email="unregistered@apex.com",
        is_active=False,
    )

    db = AsyncMock()
    mock_scalars = MagicMock()
    mock_scalars.first.return_value = pending_tenant
    mock_res = MagicMock()
    mock_res.scalars.return_value = mock_scalars
    db.execute.return_value = mock_res

    with pytest.MonkeyPatch.context() as mp:
        async def mock_get_context(self, identifier):
            return None, None, None
        mp.setattr("app.db.repositories.user_repository.UserRepository.get_user_with_context", mock_get_context)

        with pytest.raises(ForbiddenError) as exc:
            await uas_service.create_challenge(db=db, username="unregistered@apex.com")
        assert "pending Super Admin approval" in str(exc.value)


@pytest.mark.asyncio
async def test_verify_challenge_blocks_pending_tenant():
    """verify_challenge must raise ForbiddenError if tenant is not active."""
    tenant = TenantModel(
        id="t-pending-3",
        name="Blocked Channel",
        status="pending",
        is_active=False,
    )
    user = UserModel(
        id="u-pending-3",
        username="blocked@channel.com",
        role="CHANNEL_ADMIN",
        tenant_id=tenant.id,
        is_active=True,
    )

    db = MagicMock()
    with pytest.MonkeyPatch.context() as mp:
        async def mock_get_context(self, identifier):
            return user, tenant, None
        mp.setattr("app.db.repositories.user_repository.UserRepository.get_user_with_context", mock_get_context)

        with pytest.raises(ForbiddenError) as exc:
            await uas_service.verify_challenge(
                db=db,
                username="blocked@channel.com",
                nonce_id="n-123",
                proof_signature="sig-123",
            )
        assert "pending Super Admin approval" in str(exc.value)


@pytest.mark.asyncio
async def test_active_channel_allows_challenge():
    """Active approved channel admin is granted a challenge nonce."""
    tenant = TenantModel(
        id="t-active-1",
        name="Active Partner",
        code="active-partner",
        status="active",
        is_active=True,
    )
    user = UserModel(
        id="u-active-1",
        username="active@partner.com",
        email="active@partner.com",
        role="CHANNEL_ADMIN",
        tenant_id=tenant.id,
        is_active=True,
        salt="testsalt12345678",
        password_hash="testhash12345678",
    )

    db = AsyncMock()
    with pytest.MonkeyPatch.context() as mp:
        async def mock_get_context(self, identifier):
            return user, tenant, None
        mp.setattr("app.db.repositories.user_repository.UserRepository.get_user_with_context", mock_get_context)

        challenge = await uas_service.create_challenge(db=db, username="active@partner.com")
        assert challenge["nonce_id"] is not None
        assert challenge["role"] == "CHANNEL_ADMIN"
        assert challenge["email"] == "active@partner.com"
