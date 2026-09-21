import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_cors_preflight_options_for_evaluate_form():
    """Verify CORS preflight OPTIONS request returns 200 and required CORS headers for localhost:3000."""
    response = client.options(
        "/api/v1/onboarding/evaluate/form",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-tenant-id",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"
    allow_methods = response.headers.get("access-control-allow-methods", "")
    assert "POST" in allow_methods or "*" in allow_methods


def test_cors_preflight_options_for_127_0_0_1():
    """Verify CORS preflight OPTIONS request returns 200 for 127.0.0.1:3000."""
    response = client.options(
        "/api/v1/onboarding/evaluate/form",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,x-tenant-id",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_post_response_has_allow_origin():
    """Verify POST request from origin http://localhost:3000 includes Access-Control-Allow-Origin."""
    response = client.post(
        "/api/v1/onboarding/evaluate/form",
        json={"invalid": "payload"},
        headers={
            "Origin": "http://localhost:3000",
            "X-Tenant-ID": "default",
        },
    )
    # Even on validation failure (422), CORS headers MUST be present
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"
