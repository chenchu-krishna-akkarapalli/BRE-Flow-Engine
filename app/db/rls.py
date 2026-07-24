from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def set_tenant_rls_context(session: AsyncSession, tenant_id: str) -> None:
    """Enforce PostgreSQL Row-Level Security by setting app.current_tenant_id session variable."""
    if tenant_id:
        await session.execute(
            text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
            {"tenant_id": tenant_id},
        )
