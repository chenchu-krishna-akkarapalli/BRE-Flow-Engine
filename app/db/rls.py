from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def set_tenant_rls_context(session: AsyncSession, tenant_id: str) -> None:
    """Enforce PostgreSQL Row-Level Security by setting app.current_tenant_id session variable."""
    if not tenant_id:
        raise ValueError("tenant_id is required for database access")
    await session.execute(
        text(
            """SELECT set_config(
                'app.current_tenant_id',
                COALESCE(
                    (SELECT id FROM tenant
                     WHERE id = :tenant_id OR tenant_uuid = :tenant_id OR code = :tenant_id
                     ORDER BY CASE
                         WHEN id = :tenant_id THEN 0
                         WHEN tenant_uuid = :tenant_id THEN 1
                         ELSE 2
                     END
                     LIMIT 1),
                    :tenant_id
                ),
                true
            )"""
        ),
        {"tenant_id": tenant_id},
    )
