import pytest
from pydantic import ValidationError

from app.core.config import Settings


def _production_settings(**overrides):
    values = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": "a-production-jwt-secret-with-at-least-32-characters",
        "DATABASE_URL": "postgresql+asyncpg://flowbre_app:runtime@db/bre?ssl=require",
        "MIGRATION_DATABASE_URL": "postgresql+asyncpg://flowbre_migrator:migrate@db/bre?ssl=require",
        "REQUIRE_AUTHENTICATED_TENANT_CONTEXT": True,
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


@pytest.mark.parametrize(
    "override",
    [
        {"SECRET_KEY": "super-secret-jwt-key-flowbre-enterprise-2026"},
        {"DATABASE_URL": "postgresql+asyncpg://flowbre_app:runtime@db/bre"},
        {"DATABASE_URL": "mysql://flowbre_app:runtime@db/bre?ssl=require"},
        {"DATABASE_URL": "postgresql+asyncpg://flowbre_app@db/bre?ssl=require"},
        {"MIGRATION_DATABASE_URL": None},
        {"MIGRATION_DATABASE_URL": "postgresql+asyncpg://flowbre_app:runtime@db/bre?ssl=require"},
        {"REQUIRE_AUTHENTICATED_TENANT_CONTEXT": False},
    ],
)
def test_production_rejects_unsafe_database_configuration(override) -> None:
    with pytest.raises(ValidationError):
        _production_settings(**override)


def test_production_accepts_separate_tls_database_credentials() -> None:
    settings = _production_settings()

    assert settings.ASYNC_DATABASE_URI == settings.DATABASE_URL
    assert settings.MIGRATION_DATABASE_URI == settings.MIGRATION_DATABASE_URL


def test_development_keeps_component_database_configuration() -> None:
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="development",
        POSTGRES_SERVER="postgres",
        POSTGRES_USER="bre_user",
        POSTGRES_PASSWORD="bre_password",
        POSTGRES_DB="bre_db",
    )

    assert settings.ASYNC_DATABASE_URI.endswith("@postgres:5432/bre_db")
    assert settings.MIGRATION_DATABASE_URI == settings.ASYNC_DATABASE_URI
