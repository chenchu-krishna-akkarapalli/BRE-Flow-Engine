import asyncio
import time
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

from app.api.deps import get_db, get_redis
import app.core.redis as redis_module
from app.main import app
from app.services.bre_engine import bre_engine_service

# Mock Database Session for unit tests
async def mock_get_db():
    session = MagicMock()
    future = asyncio.Future()
    future.set_result(MagicMock())
    session.execute.return_value = future
    session.flush.return_value = future
    session.commit.return_value = future
    session.rollback.return_value = future
    yield session

# Mock Redis Client for unit tests
mock_redis = AsyncMock()
mock_redis.incr.return_value = 1
mock_redis.expire.return_value = True
mock_redis.get.return_value = None
mock_redis.setex.return_value = True
redis_module.redis_client = mock_redis

async def mock_get_redis():
    return mock_redis

app.dependency_overrides[get_db] = mock_get_db
app.dependency_overrides[get_redis] = mock_get_redis
client = TestClient(app)


def test_ideal_salaried_evaluation():
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "BOI",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [0, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    result = asyncio.run(bre_engine_service.evaluate_application(payload))
    assert result["status"] == "APPROVED"
    assert result["overall_eligible"] is True
    assert len(result["rejection_reasons"]) == 0


def test_high_dpd_rejection():
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "BOI",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [120, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    result = asyncio.run(bre_engine_service.evaluate_application(payload))
    assert result["status"] == "REJECTED"
    assert result["overall_eligible"] is False
    assert any(r["rule_id"] == "BUR-402" for r in result["rejection_reasons"])


def test_indian_bank_zero_dpd_strictness():
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "INDIAN_BANK",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [15, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    result = asyncio.run(bre_engine_service.evaluate_application(payload))
    assert result["status"] == "REJECTED"
    assert any(r["rule_id"] == "BUR-403" for r in result["rejection_reasons"])


def test_latency_sla():
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "BOI",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [0, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    # asyncio.run() builds an event loop and evaluate_application's first
    # to_thread call spawns a pool worker: 5-14 ms of startup that is not rule
    # evaluation. Timing it cold measures the interpreter, not the SLA.
    asyncio.run(bre_engine_service.evaluate_application(payload))

    start = time.perf_counter()
    result = asyncio.run(bre_engine_service.evaluate_application(payload))
    elapsed_ms = (time.perf_counter() - start) * 1000

    # Rule evaluation SLA target: < 10 ms
    assert elapsed_ms < 10.0, f"Zen RAM evaluation latency exceeded 10 ms budget: {elapsed_ms:.2f} ms"
    assert result["execution_time_ms"] < 10.0


def test_api_health_endpoint():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    # Simple GET SLA target: < 30 ms
    assert data["execution_time_ms"] < 30.0


def test_api_onboarding_evaluation_endpoint():
    payload = {
        "entity_type": "Individual",
        "occupation": "Salaried",
        "applicant_name": "Jane Doe",
        "net_monthly_salary": 60000.0,
        "age": 32,
        "selected_bank": "BOI",
        "credit_bureau": {
            "cibil_score": 750,
            "dpd_history": [0, 0, 0],
            "write_off_amount": 0.0,
        },
    }
    # Warm up client
    client.get("/api/v1/health")

    start = time.perf_counter()
    response = client.post("/api/v1/onboarding/evaluate", json=payload, headers={"X-Tenant-ID": "tenant_alpha"})
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    # CRUD / Evaluation SLA target: < 80 ms
    assert elapsed_ms < 80.0, f"End-to-end evaluation latency exceeded 80 ms budget: {elapsed_ms:.2f} ms"
