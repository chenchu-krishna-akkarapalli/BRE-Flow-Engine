import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def set_tenant_rls_context(session: AsyncSession, tenant_id: str) -> None:
    """Enforce PostgreSQL Row-Level Security by setting app.current_tenant_id session variable."""
    if tenant_id:
        try:
            await session.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": tenant_id},
            )
        except Exception as e:
            logger.warning(f"RLS context setup skipped for tenant '{tenant_id}': {e}")
