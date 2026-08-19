import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_db, get_redis
from app.core.security import compute_challenge_proof, derive_password_hash
from app.db.models.role import NavigationNodeModel, RoleModel
from app.db.models.tenant import TenantModel
from app.db.models.user import UserModel
from app.main import app

# Test client instance
client = TestClient(app)

# Nonce storage for tests
mock_redis_store = {}

# Mock redis generator
def get_mock_redis():
    mock_redis = AsyncMock()
    async def _get(key):
        return mock_redis_store.get(key)
    async def _set(key, val, ex=None):
        mock_redis_store[key] = val
        return True
    async def _delete(key):
        return mock_redis_store.pop(key, None)
    mock_redis.get = AsyncMock(side_effect=_get)
    mock_redis.set = AsyncMock(side_effect=_set)
    mock_redis.delete = AsyncMock(side_effect=_delete)
    return mock_redis

# Verifies complete UAS challenge-response token exchange with database-persisted role_nodes
@pytest.mark.asyncio
async def test_uas_challenge_response_with_role_nodes():
    salt = "testsalt12345678"
    password = "FlowBRE@2026!"
    pwd_hash = derive_password_hash(password, salt)
    tenant_uuid_val = "e4d9b2a1-87c3-4d8e-9f12-3a5b7c8d9e0f"
    tenant = TenantModel(
        id=tenant_uuid_val,
        name="Bank of India Channel",
        code="boi-channel-north",
        tenant_uuid=tenant_uuid_val,
        status="active",
        is_active=True,
    )
    role = RoleModel(
        id="r-chan-admin",
        name="CHANNEL_ADMIN",
        display_name="Channel Partner Admin",
        governance_level="TENANT",
    )
    user = UserModel(
        id="usr-test-1234",
        username="channel.admin@boi.com",
        email="channel.admin@boi.com",
        salt=salt,
        password_hash=pwd_hash,
        role="CHANNEL_ADMIN",
        tenant_id=tenant_uuid_val,
        is_active=True,
    )

    db_nav_nodes = [
        NavigationNodeModel(
            role_name="CHANNEL_ADMIN",
            section_title="Portal Navigation",
            item_name="Dashboard",
            path="dashboard",
            icon="LayoutDashboard",
            sort_order=1,
            is_global=False,
        ),
        NavigationNodeModel(
            role_name="CHANNEL_ADMIN",
            section_title="Portal Navigation",
            item_name="Onboarding Wizard",
            path="",
            icon="FileText",
            badge="Steps 1–6",
            badge_type="brand",
            sort_order=2,
            is_global=False,
        ),
    ]

    async def override_get_db():
        session = MagicMock()

        def mock_execute(stmt):
            stmt_lower = str(stmt).lower()
            res = MagicMock()
            if "navigation_node" in stmt_lower:
                res.scalars.return_value.all.return_value = db_nav_nodes
                res.scalars.return_value.first.return_value = db_nav_nodes[0]
            elif "role_permission" in stmt_lower or "permission" in stmt_lower:
                res.scalars.return_value.all.return_value = ["onboarding:evaluate", "applications:read"]
                res.scalars.return_value.first.return_value = None
            elif "user_account" in stmt_lower:
                res.scalars.return_value.first.return_value = user
                res.scalars.return_value.all.return_value = [user]
            elif "tenant" in stmt_lower:
                res.scalars.return_value.first.return_value = tenant
                res.scalars.return_value.all.return_value = [tenant]
            elif "role" in stmt_lower:
                res.scalars.return_value.first.return_value = role
                res.scalars.return_value.all.return_value = [role]
            else:
                res.scalars.return_value.first.return_value = user
                res.scalars.return_value.all.return_value = []

            fut = asyncio.Future()
            fut.set_result(res)
            return fut

        session.execute.side_effect = mock_execute
        session.flush.return_value = asyncio.Future()
        session.flush.return_value.set_result(None)
        session.add = lambda x: None
        yield session

    mock_r = get_mock_redis()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = lambda: mock_r

    try:
        # Step 1: User gives Gmail / Work email -> Request Challenge Token & Resolve Tenant
        resp1 = client.post("/api/v1/auth/challenge", json={"username": "channel.admin@boi.com"})
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert "nonce_id" in data1
        assert "nonce" in data1
        assert data1["salt"] == salt
        assert data1["tenant_uuid"] == tenant_uuid_val
        assert data1["tenant_name"] == "Bank of India Channel"
        assert data1["role"] == "CHANNEL_ADMIN"

        # Step 2: Client computes zero-password proof
        nonce = data1["nonce"]
        nonce_id = data1["nonce_id"]
        proof = compute_challenge_proof(pwd_hash, nonce)

        # Step 3: Verify Challenge Proof with Password -> Assert Token Exchange returns db-loaded role_nodes
        resp2 = client.post("/api/v1/auth/verify", json={
            "username": "channel.admin@boi.com",
            "nonce_id": nonce_id,
            "proof_signature": proof,
        })
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert "access_token" in data2
        assert data2["role"] == "CHANNEL_ADMIN"
        assert data2["tenant_uuid"] == tenant_uuid_val
        assert "role_nodes" in data2
        assert len(data2["role_nodes"]) > 0

        # Check that role_nodes contain tenant-scoped hrefs loaded from database
        first_group = data2["role_nodes"][0]
        assert first_group["title"] == "Portal Navigation"
        dashboard_item = next((item for item in first_group["items"] if item["name"] == "Dashboard"), None)
        assert dashboard_item is not None
        assert dashboard_item["href"] == f"/{tenant_uuid_val}/dashboard"

        wizard_item = next((item for item in first_group["items"] if item["name"] == "Onboarding Wizard"), None)
        assert wizard_item is not None
        assert wizard_item["href"] == f"/{tenant_uuid_val}"
        assert wizard_item["badge"] == "Steps 1–6"

        access_token = data2["access_token"]
        refresh_token = data2["refresh_token"]

        # Step 4: Verify /auth/me returns role_nodes
        resp3 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert resp3.status_code == 200
        me_data = resp3.json()
        assert me_data["role"] == "CHANNEL_ADMIN"
        assert "role_nodes" in me_data
        assert len(me_data["role_nodes"]) > 0

        # Step 5: Verify /auth/refresh returns role_nodes
        resp4 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert resp4.status_code == 200
        assert "access_token" in resp4.json()
        assert "role_nodes" in resp4.json()

        # Step 6: Verify single-use nonce prevents replay attack
        resp_replay = client.post("/api/v1/auth/verify", json={
            "username": "channel.admin@boi.com",
            "nonce_id": nonce_id,
            "proof_signature": proof,
        })
        assert resp_replay.status_code == 401
    finally:
        app.dependency_overrides.clear()

# Verifies rejection when proof signature is incorrect
@pytest.mark.asyncio
async def test_uas_invalid_proof_rejection():
    salt = "testsalt12345678"
    password = "FlowBRE@2026!"
    pwd_hash = derive_password_hash(password, salt)
    user = UserModel(
        id="usr-test-1234",
        username="super.admin@flowbre.com",
        email="super.admin@flowbre.com",
        salt=salt,
        password_hash=pwd_hash,
        role="SUPER_ADMIN",
        is_active=True,
    )
    role = RoleModel(
        id="r-super-admin",
        name="SUPER_ADMIN",
        display_name="Super Admin (Platform Owner)",
        governance_level="PLATFORM",
    )

    async def override_get_db():
        session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.side_effect = [user, role, user, role]
        mock_result.scalars.return_value.all.return_value = []
        future = asyncio.Future()
        future.set_result(mock_result)
        session.execute.return_value = future
        session.flush.return_value = asyncio.Future()
        session.flush.return_value.set_result(None)
        yield session

    app.dependency_overrides[get_db] = override_get_db

    try:
        resp1 = client.post("/api/v1/auth/challenge", json={"username": "super.admin@flowbre.com"})
        assert resp1.status_code == 200
        data1 = resp1.json()
        nonce_id = data1["nonce_id"]

        # Submit forged proof
        resp2 = client.post("/api/v1/auth/verify", json={
            "username": "super.admin@flowbre.com",
            "nonce_id": nonce_id,
            "proof_signature": "invalid_forged_proof_signature",
        })
        assert resp2.status_code == 401
    finally:
        app.dependency_overrides.clear()

# Verifies rejection when user is not present in PostgreSQL database
@pytest.mark.asyncio
async def test_uas_unknown_user_rejected():
    async def override_get_db():
        session = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        future = asyncio.Future()
        future.set_result(mock_result)
        session.execute.return_value = future
        yield session

    app.dependency_overrides[get_db] = override_get_db

    try:
        resp = client.post("/api/v1/auth/challenge", json={"username": "unknown.user@external.com"})
        assert resp.status_code == 401
    finally:
        app.dependency_overrides.clear()
