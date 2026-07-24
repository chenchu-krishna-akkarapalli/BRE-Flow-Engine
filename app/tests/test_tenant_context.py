from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_tenant_context_header_injection():
    response = client.get("/api/v1/health", headers={"X-Tenant-ID": "tenant_alpha"})
    assert response.status_code == 200
    assert response.headers.get("X-Tenant-ID") == "tenant_alpha"


def test_tenant_context_default_fallback():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.headers.get("X-Tenant-ID") == "default"
