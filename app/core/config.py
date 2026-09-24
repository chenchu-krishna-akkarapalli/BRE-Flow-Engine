from typing import Any, List, Optional
from urllib.parse import parse_qs, urlsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "FlowBRE Onboarding BRE Engine"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # PostgreSQL Database Settings
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "bre_user"
    POSTGRES_PASSWORD: str = "bre_password_secure"
    POSTGRES_DB: str = "bre_db"
    POSTGRES_PORT: int = 5432
    POSTGRES_MIGRATION_USER: Optional[str] = None
    POSTGRES_MIGRATION_PASSWORD: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    MIGRATION_DATABASE_URL: Optional[str] = None
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600

    @property
    def ASYNC_DATABASE_URI(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def MIGRATION_DATABASE_URI(self) -> str:
        if self.MIGRATION_DATABASE_URL:
            return self.MIGRATION_DATABASE_URL
        if self.POSTGRES_MIGRATION_USER and self.POSTGRES_MIGRATION_PASSWORD:
            return (
                f"postgresql+asyncpg://{self.POSTGRES_MIGRATION_USER}:{self.POSTGRES_MIGRATION_PASSWORD}"
                f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
            )
        return self.ASYNC_DATABASE_URI

    # Redis Settings
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Security Settings
    SECRET_KEY: str = "super-secret-jwt-key-flowbre-enterprise-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REQUIRE_AUTHENTICATED_TENANT_CONTEXT: bool = False

    # Document OCR. Off by default so a host without the stack still serves
    # uploads; set OCR_REQUIRE_REAL=true where a simulated extraction must
    # never be mistaken for a reading of the applicant's card.
    OCR_REQUIRE_REAL: bool = False

    # CIBIL report parsing. Empty resolves to the workspace release build, then
    # PATH; the endpoint 503s naming the missing half when neither is present.
    CIBIL_ENGINE_BINARY: str = ""
    CIBIL_ENGINE_TIMEOUT_S: float = 25.0

    # Payslip report parsing. Empty resolves to the workspace release build, then PATH.
    PAYSLIP_ENGINE_BINARY: str = ""
    PAYSLIP_ENGINE_TIMEOUT_S: float = 25.0

    # COI report parsing. Empty resolves to the workspace release build, then PATH.
    COI_ENGINE_BINARY: str = ""
    COI_ENGINE_TIMEOUT_S: float = 25.0

    # ITR report parsing. Empty resolves to the workspace release build, then PATH.
    ITR_ENGINE_BINARY: str = ""
    ITR_ENGINE_TIMEOUT_S: float = 25.0

    # Document Extraction Subprocess Concurrency Limit
    DOC_EXTRACTION_MAX_CONCURRENCY: int = 10

    # Latency SLA Targets (ms)
    SLA_GET_LOOKUP_MS: float = 30.0
    SLA_CRUD_EVAL_MS: float = 80.0
    SLA_ZEN_RAM_EVAL_MS: float = 10.0

    # Resend & Email Notification Settings
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "FlowBRE Onboarding <onboarding@resend.dev>"
    FRONTEND_LOGIN_URL: str = "http://localhost:3000/auth/login"

    # SMTP Settings (e.g. Gmail SMTP)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:9000",
        "http://127.0.0.1:9000",
    ]
    CORS_ORIGIN_REGEX: Optional[str] = r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        return v

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        if self.ENVIRONMENT.lower() not in {"production", "prod"}:
            return self

        unsafe_secrets = {"", "super-secret-jwt-key-flowbre-enterprise-2026"}
        if self.SECRET_KEY in unsafe_secrets or len(self.SECRET_KEY) < 32:
            raise ValueError("production SECRET_KEY must be a non-default secret of at least 32 characters")
        if not self.DATABASE_URL or not self.MIGRATION_DATABASE_URL:
            raise ValueError("production requires separate DATABASE_URL and MIGRATION_DATABASE_URL values")

        runtime_url = urlsplit(self.DATABASE_URL)
        migration_url = urlsplit(self.MIGRATION_DATABASE_URL)
        for label, parsed in (("DATABASE_URL", runtime_url), ("MIGRATION_DATABASE_URL", migration_url)):
            if parsed.scheme != "postgresql+asyncpg":
                raise ValueError(f"production {label} must use postgresql+asyncpg")
            if not parsed.hostname or not parsed.username or not parsed.password:
                raise ValueError(f"production {label} requires host, username, and password")
            tls = parse_qs(parsed.query)
            ssl_mode = (tls.get("ssl") or tls.get("sslmode") or [""])[0]
            if ssl_mode not in {"require", "verify-ca", "verify-full"}:
                raise ValueError(f"production {label} must require TLS")
        if runtime_url.username == migration_url.username:
            raise ValueError("production runtime and migration database users must be different")
        if not self.REQUIRE_AUTHENTICATED_TENANT_CONTEXT:
            raise ValueError("production requires authenticated tenant context")
        return self

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )


settings = Settings()
