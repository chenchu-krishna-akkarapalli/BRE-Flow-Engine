import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest

from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel
from app.services.tenant_provisioning_service import tenant_provisioning_service


# Verifies tenant signup, operational review, activation, and navigation seeding
@pytest.mark.asyncio
async def test_tenant_full_onboarding_lifecycle():
    tenant = TenantModel(
        id="t-123",
        name="HDFC Auto Partner North",
        code="tenant-hdfc-auto-north",
        tenant_uuid="e4d9b2a1-6789-4a0b-9912-3456789abcde",
        status="pending",
        is_active=False,
    )
    user = UserModel(
        id="u-123",
        tenant_id="t-123",
        username="rajesh.hdfc",
        email="admin@hdfc-north.in",
        role="CHANNEL_ADMIN",
        is_active=False,
    )

    db_session = MagicMock()
    added_entities = []

    def mock_add(entity):
        added_entities.append(entity)

    async def mock_commit():
        pass

    async def mock_flush():
        pass

    async def mock_refresh(instance):
        pass

    def mock_execute(stmt):
        stmt_lower = str(stmt).lower()
        res = MagicMock()
        if "user_account" in stmt_lower:
            res.scalars.return_value.all.return_value = [user]
            res.scalars.return_value.first.return_value = user
        elif "tenant" in stmt_lower:
            res.scalars.return_value.all.return_value = [tenant]
            # For signup check: return None on first check (no existing tenant), then return tenant
            res.scalars.return_value.first.return_value = None if len(added_entities) == 0 else tenant
        else:
            res.scalars.return_value.all.return_value = []
            res.scalars.return_value.first.return_value = None

        fut = asyncio.Future()
        fut.set_result(res)
        return fut

    db_session.add.side_effect = mock_add
    db_session.commit.side_effect = mock_commit
    db_session.flush.side_effect = mock_flush
    db_session.refresh.side_effect = mock_refresh
    db_session.execute.side_effect = mock_execute

    # 1. Signup Channel
    signup_res = await tenant_provisioning_service.signup_tenant(
        db=db_session,
        channel_name="HDFC Auto Partner North",
        channel_code="tenant-hdfc-auto-north",
        channel_type="DSA",
        contact_email="admin@hdfc-north.in",
        contact_phone="9876543210",
        admin_username="rajesh.hdfc",
        admin_password="Password@123",
        cibil_overlay=10,
    )
    assert signup_res["status"] == "pending"
    assert signup_res["admin_username"] == "rajesh.hdfc"
    tenant_uuid = signup_res["tenant_uuid"]

    # 2. Review Channel
    review_res = await tenant_provisioning_service.review_tenant(
        db=db_session,
        tenant_uuid=tenant_uuid,
        reviewer_id="super_admin_01",
        reason="KYC documents verified against MCA registry.",
    )
    assert review_res["current_status"] == "under_review"

    # 3. Approve and Activate Channel
    approval_res = await tenant_provisioning_service.approve_and_activate_tenant(
        db=db_session,
        tenant_uuid=tenant_uuid,
        approver_id="super_admin_01",
        cibil_overlay=15,
        reason="All credentials signed off by Operations Head.",
    )
    assert approval_res["current_status"] == "active"
    assert approval_res["is_active"] is True
    assert approval_res["seeded_navigation_nodes_count"] > 0
    assert approval_res["cibil_overlay"] == 15

    # 4. Suspend Tenant
    suspend_res = await tenant_provisioning_service.suspend_tenant(
        db=db_session,
        tenant_uuid=tenant_uuid,
        actor_id="super_admin_01",
        reason="Periodic compliance audit trigger.",
    )
    assert suspend_res["current_status"] == "suspended"
    assert suspend_res["is_active"] is False
