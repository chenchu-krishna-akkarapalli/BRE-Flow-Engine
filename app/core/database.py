import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.ASYNC_DATABASE_URI,
    echo=False,
    future=True,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
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
    """Provide an async database session wrapped in a transaction manager."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            if session.is_active and session.in_transaction():
                try:
                    await session.commit()
                except Exception as commit_err:
                    if session.is_active and session.in_transaction():
                        await session.rollback()
                    logger.warning(f"Database session commit deferred/failed: {commit_err}")
        except Exception:
            if session.is_active and session.in_transaction():
                try:
                    await session.rollback()
                except Exception:
                    pass
            raise
