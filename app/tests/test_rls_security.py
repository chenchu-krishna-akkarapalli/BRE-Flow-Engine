from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.api import deps
from app.api.deps import get_current_authorized_tenant, get_current_tenant, get_tenant_db
from app.db.rls import set_tenant_rls_context


@pytest.mark.asyncio
async def test_rls_context_is_parameterized() -> None:
    session = AsyncMock()

    await set_tenant_rls_context(session, "tenant-alpha")

    statement, parameters = session.execute.await_args.args
    assert "set_config" in str(statement)
    assert "tenant_uuid = :tenant_id" in str(statement)
    assert "WHEN id = :tenant_id THEN 0" in str(statement)
    assert parameters == {"tenant_id": "tenant-alpha"}


@pytest.mark.asyncio
async def test_rls_context_rejects_empty_tenant() -> None:
    session = AsyncMock()

    with pytest.raises(ValueError, match="tenant_id is required"):
        await set_tenant_rls_context(session, "")

    session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_rls_context_failure_is_not_silenced() -> None:
    session = AsyncMock()
    session.execute.side_effect = RuntimeError("database unavailable")

    with pytest.raises(RuntimeError, match="database unavailable"):
        await set_tenant_rls_context(session, "tenant-alpha")


@pytest.mark.asyncio
async def test_authorized_tenant_uses_bound_rls_context() -> None:
    malicious_tenant = "tenant'; SELECT pg_sleep(10); --"
    request = SimpleNamespace(
        headers={"X-Tenant-ID": malicious_tenant},
        path_params={},
    )
    session = AsyncMock()

    tenant_id = await get_current_authorized_tenant(
        request=request,
        token_payload={
            "tenant_uuid": "platform-master",
            "role": "SUPER_ADMIN",
            "governance_level": "PLATFORM",
        },
        db=session,
    )

    statement, parameters = session.execute.await_args.args
    assert tenant_id == malicious_tenant
    assert malicious_tenant not in str(statement)
    assert parameters == {"tenant_id": malicious_tenant}


@pytest.mark.asyncio
async def test_production_tenant_context_requires_authentication(monkeypatch) -> None:
    monkeypatch.setattr(deps.settings, "REQUIRE_AUTHENTICATED_TENANT_CONTEXT", True, raising=False)

    with pytest.raises(deps.UnauthorizedError):
        await get_current_tenant(x_tenant_id="tenant-alpha", auth=None)


@pytest.mark.asyncio
async def test_production_tenant_context_rejects_token_tenant_mismatch(monkeypatch) -> None:
    monkeypatch.setattr(deps.settings, "REQUIRE_AUTHENTICATED_TENANT_CONTEXT", True, raising=False)
    monkeypatch.setattr(
        deps,
        "verify_token",
        lambda _token: {
            "tenant_uuid": "tenant-alpha",
            "role": "TRANSACTIONAL_USER",
            "governance_level": "TENANT",
        },
    )

    with pytest.raises(deps.ForbiddenError):
        await get_current_tenant(
            x_tenant_id="tenant-beta",
            auth=HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid"),
        )


@pytest.mark.asyncio
async def test_tenant_database_dependency_binds_context_before_return(monkeypatch) -> None:
    session = AsyncMock()
    bind_context = AsyncMock()
    monkeypatch.setattr(deps, "set_tenant_rls_context", bind_context)

    result = await get_tenant_db(tenant_id="tenant-alpha", db=session)

    assert result is session
    bind_context.assert_awaited_once_with(session, "tenant-alpha")
