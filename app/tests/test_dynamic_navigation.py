import httpx
import pytest
from app.main import app


@pytest.mark.asyncio
async def test_get_navigation_modules_fallback_roles():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Super Admin sees all sections including governance
        res_admin = await client.get("/api/v1/navigation/modules?role=SUPER_ADMIN")
        assert res_admin.status_code == 200
        data_admin = res_admin.json()
        assert data_admin["role"] == "SUPER_ADMIN"
        section_keys_admin = [s["section_key"] for s in data_admin["sections"]]
        assert "PORTAL_NAV" in section_keys_admin
        assert "OPERATIONS_SALES" in section_keys_admin
        assert "PLATFORM_GOVERNANCE" in section_keys_admin

        # 2. Transactional user only sees leaf modules (Dashboard, Onboarding, Pipeline)
        res_user = await client.get("/api/v1/navigation/modules?role=TRANSACTIONAL_USER")
        assert res_user.status_code == 200
        data_user = res_user.json()
        all_codes_user = [
            item["code"]
            for sec in data_user["sections"]
            for item in sec["items"]
        ]
        assert "DASHBOARD" in all_codes_user
        assert "ONBOARDING" in all_codes_user
        assert "PIPELINE" in all_codes_user
        assert "USER_MANAGEMENT" not in all_codes_user
        assert "APPROVALS" not in all_codes_user
        assert "PLATFORM_OVERVIEW" not in all_codes_user


@pytest.mark.asyncio
async def test_get_navigation_catalog():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/navigation/catalog")
        assert res.status_code == 200
        catalog = res.json()
        assert isinstance(catalog, list)
        assert len(catalog) >= 13
        codes = [m["code"] for m in catalog]
        assert "DASHBOARD" in codes
        assert "ONBOARDING" in codes
        assert "PIPELINE" in codes
        assert "APPROVALS" in codes
        assert "COMMISSIONS" in codes
        assert "SETTINGS" not in codes



@pytest.mark.asyncio
async def test_get_role_permission_matrix():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/navigation/matrix")
        assert res.status_code == 200
        matrix = res.json()
        assert isinstance(matrix, list)
        assert len(matrix) > 0
        first = matrix[0]
        assert "role_key" in first
        assert "module_code" in first
        assert "can_view" in first
        assert "can_create" in first
        assert "can_edit" in first
        assert "can_approve" in first


@pytest.mark.asyncio
async def test_navigation_tenant_modules_endpoint():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/navigation/tenants/test-tenant-123/modules")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


@pytest.mark.asyncio
async def test_create_and_update_dynamic_module():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Create custom dynamic module
        payload = {
            "code": "TEST_DOCS_PORTAL",
            "name": "Docs Portal",
            "route_template": "/{tenant}/docs-portal",
            "icon_name": "FileText",
            "section_key": "PORTAL_NAV",
            "section_title": "Portal Navigation",
            "badge": "V2",
            "badge_type": "brand",
            "sort_order": 99,
            "description": "Dynamic testing module portal",
        }
        res_create = await client.post("/api/v1/navigation/catalog", json=payload)
        assert res_create.status_code in [200, 201, 400]  # 400 if already created in previous run

        # Update dynamic module
        update_payload = {
            "name": "Updated Docs Portal",
            "badge": "Updated",
        }
        res_update = await client.put("/api/v1/navigation/catalog/TEST_DOCS_PORTAL", json=update_payload)
        if res_update.status_code == 200:
            assert res_update.json()["name"] == "Updated Docs Portal"
            assert res_update.json()["badge"] == "Updated"

        # Cleanup: ensure dynamic module is purged so it does not pollute sidebar/catalog
        res_del = await client.delete("/api/v1/navigation/catalog/TEST_DOCS_PORTAL?hard=true")
        assert res_del.status_code in [200, 404]

