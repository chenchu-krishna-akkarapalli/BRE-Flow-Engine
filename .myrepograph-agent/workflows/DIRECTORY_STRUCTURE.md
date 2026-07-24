# `.myrepograph-agent/workflows/` Directory Structure Blueprint

This document defines the master index, purpose, ownership, and target file mapping for all workflow namespaces inside `.myrepograph-agent/workflows/`.

---

## 📂 Master Workflow Layout Map

```text
.myrepograph-agent/workflows/
├── DIRECTORY_STRUCTURE.md            # Master map & indexing of all workflows
├── onboarding/                       # Onboarding UI-to-API mapping workflows
│   └── individual_company_huf_api.md # Mapping entity types and validations
├── bureau/                           # Credit Bureau Parsing & Data extraction
│   └── cibil_pdf_parser_checks.md    # DPD array extraction & STD-to-0 conversion
├── rules/                            # Zen-Engine Rule Engine & Policy Matrix updates
│   └── rule_updates_checklist.md     # 8-bank matrix update & parameter sync routines
├── database/                         # Database schema migrations & connection pooling
│   └── alembic_migration_guide.md    # Schema updates, seeds, & pool tuning
├── performance/                      # SLA latency checks & cache management
│   └── sla_benchmarks_swr.md         # GET <30ms / CRUD <80ms / SWR test scripts
└── deployment/                       # Container orchestration & CI/CD workflows
    └── docker_bootstrap_guide.md     # Docker Compose & Uvicorn clustering setup
```

---

## 🏛️ Namespace Index & Purpose

### 1. `onboarding/`
- **Primary Goal**: Map `flow.html` frontend fields to FastAPI polymorphic discriminated union schemas.
- **Key File**: [onboarding/individual_company_huf_api.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/onboarding/individual_company_huf_api.md)
- **Target Components**: `app/api/onboarding.py`, `flow.html`

### 2. `bureau/`
- **Primary Goal**: Parse raw bureau reports, extract DPD arrays, standardize `"STD"` -> `0`, and mask PII fields.
- **Key File**: [bureau/cibil_pdf_parser_checks.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/bureau/cibil_pdf_parser_checks.md)
- **Target Components**: `app/services/bureau_parser.py`, `credit_bureau_rules.json`

### 3. `rules/`
- **Primary Goal**: Rule AST synchronization and 8-partner bank matrix parameter updates (`BOI`, `INDIAN_BANK`, `IOB`, `BOB`, `BOM`, `HDFC`, `AXIS`, `KOTAK`).
- **Key File**: [rules/rule_updates_checklist.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/rules/rule_updates_checklist.md)
- **Target Components**: `Rules.md`, `bank_policy_matrix.json`, `app/services/bre_engine.py`

### 4. `database/`
- **Primary Goal**: Manage PostgreSQL Row-Level Security (RLS) policies, Alembic migrations, and SQLAlchemy connection pools (`pool_size=20`, `max_overflow=10`).
- **Key File**: [database/alembic_migration_guide.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/database/alembic_migration_guide.md)
- **Target Components**: `alembic/`, `app/database.py`, `app/models.py`

### 5. `performance/`
- **Primary Goal**: SLA latency checks (`GET < 30 ms`, `CRUD < 80 ms`, `Zen-Engine < 10 ms`), Stale-While-Revalidate (SWR) caching, and memory profiling.
- **Key File**: [performance/sla_benchmarks_swr.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/performance/sla_benchmarks_swr.md)
- **Target Components**: `app/main.py`, `Backend-Playbook.md`

### 6. `deployment/`
- **Primary Goal**: Container orchestration, Uvicorn worker clustering, and production environment bootstrapping.
- **Key File**: [deployment/docker_bootstrap_guide.md](file:///c:/Projects/onboarding-bre-engine/.myrepograph-agent/workflows/deployment/docker_bootstrap_guide.md)
- **Target Components**: `docker-compose.yml`, `requirements/base.txt`

---

## ⚙️ Mandatory Compliance Pillars Across All Workflows

Every workflow document in this directory must strictly enforce three non-negotiable pillars:

1. **Anti-Assumption & Fact Verification**: Inspect source files (`zen_rules/*.json`, `Rules.md`, `app/services/`) before making code modifications.
2. **Performance SLA Gates**:
   - `Simple GET Requests`: **`< 30 ms`**
   - `CRUD & Transactions`: **`< 80 ms`**
   - `Zen-Engine RAM Rules`: **`< 10 ms`**
3. **5-Stage Request Memory Lifecycle**:
   `Request Starts` ➔ `Allocate Memory` ➔ `Use Memory` ➔ `Garbage Collection` ➔ `Memory Released`
