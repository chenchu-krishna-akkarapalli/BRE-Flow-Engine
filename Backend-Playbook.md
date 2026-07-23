# 🚀 Backend Playbook: Onboarding Business Rule Engine (BRE)

This playbook defines the architecture, folder structure, and performance
guardrails for the loan-onboarding BRE backend: **FastAPI (async) + Zen-Engine
+ PostgreSQL + Docker**, engineered for **< 100 ms end-to-end evaluation
latency**.

---

## 1. Directory Structure

```
onboarding-bre-engine/
├── .dockerignore
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── Makefile
├── README.md
├── CLAUDE.md
├── Rules.md
├── SKILL.md
├── alembic.ini
├── requirements/
│   ├── base.in
│   ├── base.txt
│   └── scripts/
│       └── compile_requirements.sh
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial_schema.py
└── app/
    ├── __init__.py
    ├── main.py
    ├── core/
    │   ├── __init__.py
    │   ├── config.py
    │   ├── database.py
    │   ├── exceptions.py
    │   ├── logging.py
    │   └── redis.py
    ├── api/
    │   ├── __init__.py
    │   ├── router.py
    │   └── v1/
    │       ├── __init__.py
    │       ├── endpoints/
    │       │   ├── __init__.py
    │       │   ├── health.py
    │       │   ├── onboarding.py
    │       │   ├── rules.py
    │       │   └── bureau.py
    │       └── schemas/
    │           ├── __init__.py
    │           ├── onboarding.py
    │           ├── rules.py
    │           └── bureau.py
    ├── db/
    │   ├── __init__.py
    │   ├── base_class.py
    │   └── models/
    │       ├── __init__.py
    │       ├── application.py
    │       ├── rule_execution.py
    │       └── audit_log.py
    ├── services/
    │   ├── __init__.py
    │   ├── bre_engine.py
    │   ├── bureau_parser.py
    │   └── pincode_service.py
    └── zen_rules/
        ├── applicant_eligibility.json
        ├── employment_income_rules.json
        ├── credit_bureau_rules.json
        ├── bank_policy_matrix.json
        └── co_applicant_rules.json
```

---

## 2. Low-Latency Architecture Strategy & SLA Targets

### API Latency SLA Targets

| Request Type | SLA Target | Scope & Target Benchmark |
|---|---|---|
| **Simple GET Requests** | **< 30 ms** | Health checks (`GET /health`), pincode lookups, bank metadata, parameter queries served from RAM/Redis |
| **Full BRE / Application CRUD Transactions** | **< 80 ms** | Onboarding application evaluation (`POST /evaluate`), policy assessment, DB insertion, audit log persistence |

### Architecture Strategy Breakdown

| Layer | Strategy | Budget |
|---|---|---|
| **Rule evaluation** | Zen-Engine (Rust core) executes pre-compiled JSON decision graphs in RAM — no disk I/O per request. | < 10 ms |
| **Database** | `asyncpg` driver under SQLAlchemy 2.0 async engine, connection pool warmed at boot. | < 15 ms |
| **Network / serialization** | Pydantic v2 models, HTTP/2, minimal payload shape. | < 15 ms |
| **Simple GET Latency** | Pincode → City/State and bank-metadata lookups served from Redis / in-process LRU cache. | **< 30 ms** |
| **CRUD End-to-End Latency** | Combined pipeline for `POST /api/v1/onboarding/evaluate` including DB persistence. | **< 80 ms** |

Connection pool tuning: `pool_size=20`, `max_overflow=10`, `pool_recycle=3600`,
`pool_pre_ping=True`. Application evaluation + audit log write happen in a
single DB transaction to avoid a second round trip.

---

### 2.1 Memory Lifetime Lifecycle Flow

To guarantee strict compliance with the **< 30 ms GET** and **< 80 ms CRUD** latency benchmarks, memory management within the FastAPI / CPython execution model adheres to a deterministic 5-stage lifecycle flow:

```
Memory Lifetime
Request Starts
      ↓
Allocate Memory
      ↓
  Use Memory
      ↓
Garbage Collection
      ↓
Memory Released
```

1. **Request Starts**: ASGI event loop dispatches incoming HTTP connection to the FastAPI endpoint handler.
2. **Allocate Memory**: Transient Pydantic v2 models, request contexts, and evaluation payloads are allocated in CPython's private heap.
3. **Use Memory**: Zen-Engine Rust core and Python decision handlers process candidate metrics against pre-compiled rules in RAM. Reference counts for evaluation objects increment.
4. **Garbage Collection**: Upon endpoint completion, scope terminates. Reference counts drop to zero, and CPython's generational GC sweeps temporary circular references.
5. **Memory Released**: Allocated memory pools are returned to CPython arena allocators, ensuring zero memory accumulation across high-throughput evaluation loops.

---

## 3. Dependency Management

### `requirements/base.in`

```
# Base runtime dependencies (shared by every service)
# Compile to base.txt with scripts/compile_requirements.sh.
fastapi>=0.111,<0.116
uvicorn[standard]>=0.30,<0.36
gunicorn>=22,<24
sqlalchemy[asyncio]>=2.0,<2.1
alembic>=1.13,<2.0
asyncpg>=0.29,<0.31
pydantic>=2.7,<3.0
pydantic-settings>=2.3,<3.0
httpx>=0.27,<0.29
python-multipart>=0.0.9,<0.1
zen-engine>=0.4,<1.0
redis>=5.0,<6.0
```

### `requirements/scripts/compile_requirements.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail

pip install --quiet pip-tools
pip-compile requirements/base.in --output-file requirements/base.txt
echo "✅ Requirements compiled successfully to requirements/base.txt"
```

---

## 4. Core Implementation Files

### `app/core/config.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Onboarding BRE Engine"
    API_V1_STR: str = "/api/v1"

    # Database
    POSTGRES_SERVER: str = "postgres"
    POSTGRES_USER: str = "bre_user"
    POSTGRES_PASSWORD: str = "bre_password_secure"
    POSTGRES_DB: str = "bre_db"
    POSTGRES_PORT: int = 5432

    @property
    def ASYNC_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Performance & pool settings
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()
```

### `app/core/database.py`

```python
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    echo=False,
    future=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

---

## 5. Rule Engine Service — `app/services/bre_engine.py`

Loads every JSON rule set in `zen_rules/` once at boot and evaluates all of
them per application in a single pass.

```python
import time
from pathlib import Path
from typing import Any, Dict

import zen

ZEN_RULES_DIR = Path(__file__).parent.parent / "zen_rules"

RULE_FILES = {
    "applicant": "applicant_eligibility.json",
    "employment_income": "employment_income_rules.json",
    "bureau": "credit_bureau_rules.json",
    "bank_policy": "bank_policy_matrix.json",
    "co_applicant": "co_applicant_rules.json",
}


class BREEngineService:
    def __init__(self):
        self.engine = zen.ZenEngine()
        self._decisions: Dict[str, Any] = {}
        self._load_rule_files()

    def _load_rule_files(self):
        for key, filename in RULE_FILES.items():
            path = ZEN_RULES_DIR / filename
            if path.exists():
                with open(path, "r") as f:
                    self._decisions[key] = self.engine.create_decision(f.read())

    async def evaluate_application(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.perf_counter()

        bureau = payload.get("credit_bureau", {})
        dpd_values = bureau.get("dpd_history", [])
        evaluation_input = {
            "entity_type": payload.get("entity_type"),
            "occupation": payload.get("occupation"),
            "current_company_tenure_months": payload.get("current_company_tenure_months", 0),
            "business_experience_years": payload.get("business_experience_years", 0),
            "current_itr": payload.get("current_itr", 0),
            "previous_itr": payload.get("previous_itr", 0),
            "cibil_score": bureau.get("cibil_score", 0),
            "has_dpd_over_90": any(v > 90 for v in dpd_values if isinstance(v, int)),
            "has_indian_bank_dpd": bureau.get("indian_bank_dpd", 0) > 0,
            "has_write_off": bureau.get("write_off_amount", 0) > 0,
            "selected_bank": payload.get("selected_bank"),
        }

        results = {}
        for key, decision in self._decisions.items():
            results[key] = decision.evaluate(evaluation_input).get("result", {})

        execution_time_ms = (time.perf_counter() - start_time) * 1000
        rejection_reasons = [
            r for res in results.values() for r in res.get("reasons", [])
        ]

        return {
            "results": results,
            "is_eligible": len(rejection_reasons) == 0,
            "rejection_reasons": rejection_reasons,
            "execution_time_ms": round(execution_time_ms, 3),
        }


bre_service = BREEngineService()
```

---

## 6. API Endpoint — `app/api/v1/endpoints/onboarding.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.onboarding import OnboardingEvaluationRequest, OnboardingEvaluationResponse
from app.core.database import get_db
from app.services.bre_engine import bre_service

router = APIRouter()


@router.post("/evaluate", response_model=OnboardingEvaluationResponse)
async def evaluate_onboarding_application(
    payload: OnboardingEvaluationRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        data_dict = payload.model_dump()
        evaluation = await bre_service.evaluate_application(data_dict)

        return OnboardingEvaluationResponse(
            success=True,
            status="APPROVED" if evaluation["is_eligible"] else "REJECTED",
            rejection_reasons=evaluation["rejection_reasons"],
            execution_time_ms=evaluation["execution_time_ms"],
            data=evaluation["results"],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rule Evaluation Error: {str(e)}",
        )
```

---

## 7. Docker & Containerization

### `Dockerfile`

```dockerfile
# Multi-stage build for minimal image size and fast cold start
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim as runner

WORKDIR /app

COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

COPY . .

EXPOSE 8000

CMD ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "--timeout", "30"]
```

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bre_fastapi_app
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_SERVER=postgres
      - POSTGRES_USER=bre_user
      - POSTGRES_PASSWORD=bre_password_secure
      - POSTGRES_DB=bre_db
      - POSTGRES_PORT=5432
    depends_on:
      postgres:
        condition: service_healthy
    restart: always

  postgres:
    image: postgres:16-alpine
    container_name: bre_postgres_db
    environment:
      - POSTGRES_USER=bre_user
      - POSTGRES_PASSWORD=bre_password_secure
      - POSTGRES_DB=bre_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bre_user -d bre_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## 8. Performance Optimization & Latency SLA Checklist

| Metric / Checkpoint | SLA Target | Mechanism |
|---|---|---|
| **Simple GET Requests** | **< 30 ms** | Served directly from Redis / LRU memory cache, Pydantic v2 serialization |
| **Full BRE / CRUD Transactions** | **< 80 ms** | Zen-Engine RAM rule execution + single-pass `asyncpg` audit transaction |
| Rule evaluation time | **< 10 ms** | Zen-Engine Rust core, rules pre-compiled in RAM |
| Database transaction time | **< 15 ms** | Async `asyncpg` + pre-warmed pool |
| Network & transport latency | **< 15 ms** | Pydantic v2 serialization + HTTP/2 |
| **Memory Lifetime Safety** | **Clean Release** | 5-stage flow (`Request Starts` → `Allocate` → `Use` → `GC` → `Released`) post-request cleanup |

---

## 9. Quickstart

```bash
# 1. Compile dependencies
bash requirements/scripts/compile_requirements.sh

# 2. Start services
docker-compose up --build -d

# 3. Check API health
curl http://localhost:8000/api/v1/health

# 4. Interactive API docs
open http://localhost:8000/docs
```
