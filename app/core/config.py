from typing import Optional
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
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE: int = 3600

    @property
    def ASYNC_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

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

    # Document OCR. Off by default so a host without the stack still serves
    # uploads; set OCR_REQUIRE_REAL=true where a simulated extraction must
    # never be mistaken for a reading of the applicant's card.
    OCR_REQUIRE_REAL: bool = False

    # CIBIL report parsing. Empty resolves to the workspace release build, then
    # PATH; the endpoint 503s naming the missing half when neither is present.
    CIBIL_ENGINE_BINARY: str = ""
    CIBIL_ENGINE_TIMEOUT_S: float = 25.0

    # Latency SLA Targets (ms)
    SLA_GET_LOOKUP_MS: float = 30.0
    SLA_CRUD_EVAL_MS: float = 80.0
    SLA_ZEN_RAM_EVAL_MS: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", case_sensitive=True, extra="ignore"
    )


settings = Settings()
