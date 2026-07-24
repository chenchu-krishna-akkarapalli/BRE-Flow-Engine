.PHONY: help dev test build up down migrate seed check-sla status logs

help:
	@echo "FlowBRE Engine Infrastructure Commands:"
	@echo "  make build       - Build docker container images"
	@echo "  make up          - Start stack with 127.0.0.1 port bindings"
	@echo "  make down        - Stop and remove running containers"
	@echo "  make status      - Check container status and health probes"
	@echo "  make logs        - Tail container logs"
	@echo "  make migrate     - Run database migrations via Alembic"
	@echo "  make dev         - Run local uvicorn development server"
	@echo "  make test        - Execute pytest test suite"
	@echo "  make check-sla   - Run performance latency SLA benchmarks"

build:
	docker-compose build

up:
	docker-compose up -d --build

down:
	docker-compose down

status:
	docker-compose ps

logs:
	docker-compose logs -f --tail=100

migrate:
	docker-compose exec web alembic upgrade head

dev:
	uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

test:
	uv run --with fastapi --with uvicorn --with pydantic --with pydantic-settings --with sqlalchemy --with asyncpg --with redis --with pytest --with httpx --with pyjwt pytest app/tests/ -v

check-sla:
	uv run --with fastapi --with uvicorn --with pydantic --with pydantic-settings --with sqlalchemy --with asyncpg --with redis --with pytest --with httpx --with pyjwt pytest app/tests/test_bre_engine.py -k "test_latency_sla" -v
