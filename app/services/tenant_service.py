from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import TenantModel
from app.core.exceptions import TenantNotFoundError


class TenantService:
    """Service handling tenant registry and configurations."""

    async def get_tenant_by_code(self, db: AsyncSession, tenant_code: str) -> TenantModel:
        stmt = select(TenantModel).where(TenantModel.code == tenant_code, TenantModel.is_active == True)
        result = await db.execute(stmt)
        tenant = result.scalar_one_or_none()
        if not tenant and tenant_code != "default":
            raise TenantNotFoundError(tenant_code)
        return tenant or TenantModel(id="default", name="Default Tenant", code="default", is_active=True)

    async def get_all_tenants(self, db: AsyncSession) -> List[TenantModel]:
        stmt = select(TenantModel)
        result = await db.execute(stmt)
        return list(result.scalars().all())


tenant_service = TenantService()
