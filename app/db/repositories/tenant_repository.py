from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.tenant import TenantModel, TenantStatusHistoryModel
from app.db.repositories.base_repository import BaseRepository

# Repository for channel tenant lifecycle management and status queries
class TenantRepository(BaseRepository[TenantModel]):
    def __init__(self, db: AsyncSession):
        super().__init__(TenantModel, db)

    # Looks up tenant by human-readable unique slug code
    async def get_by_code(self, code: str) -> Optional[TenantModel]:
        stmt = select(TenantModel).where(TenantModel.code == code)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # Looks up tenant by dynamic routing UUID
    async def get_by_uuid(self, tenant_uuid: str) -> Optional[TenantModel]:
        stmt = select(TenantModel).where(TenantModel.tenant_uuid == tenant_uuid)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # Appends immutable lifecycle transition audit record
    async def record_status_change(self, history: TenantStatusHistoryModel) -> TenantStatusHistoryModel:
        self.db.add(history)
        await self.db.flush()
        return history
